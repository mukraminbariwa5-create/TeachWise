<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Models\EvaluationPeriod;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PeriodController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => EvaluationPeriod::orderByDesc('opens_at')->get()->map(fn ($p) => Present::period($p) + ['semester_id' => $p->semester_id])]);
    }

    public function store(Request $request): JsonResponse
    {
        $period = EvaluationPeriod::create($this->validated($request));
        Audit::log('period.created', "Created the {$period->name} {$period->type} evaluation period.", $period);

        return response()->json(['period' => Present::period($period)], 201);
    }

    public function update(Request $request, EvaluationPeriod $period): JsonResponse
    {
        $period->update($this->validated($request));
        Audit::log('period.updated', "Changed the {$period->name} evaluation period ({$period->opens_at->format('M j')} to {$period->closes_at->format('M j')}).", $period);

        return response()->json(['period' => Present::period($period)]);
    }

    public function destroy(EvaluationPeriod $period): JsonResponse
    {
        $count = \App\Models\Evaluation::where('evaluation_period_id', $period->id)->count();
        abort_if($count > 0, 422, "This period already has {$count} evaluation(s). It stays so reports and trends remain correct; change its dates instead.");
        Audit::log('period.deleted', "Deleted the {$period->name} evaluation period.", null, ['period_id' => $period->id]);
        $period->delete();

        return response()->json(['message' => 'Evaluation period deleted.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'semester_id' => ['nullable', 'integer', Tenant::exists('semesters')],
            'name' => ['required', 'string', 'max:60'],
            'type' => ['required', Rule::in(['student', 'peer'])],
            'opens_at' => ['required', 'date'],
            'closes_at' => ['required', 'date', 'after:opens_at'],
        ]);
        abort_if(($data['type'] ?? null) === 'peer' && ! \App\Support\Tenant::school()->peerEvaluationOn(), 422, 'Peer evaluation is turned off in School settings.');

        return $data;
    }
}
