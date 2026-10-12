<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SemesterController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Semester::orderByDesc('starts_on')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $semester = DB::transaction(fn () => $this->save(new Semester, $this->validated($request)));

        return response()->json(['semester' => $semester], 201);
    }

    public function update(Request $request, Semester $semester): JsonResponse
    {
        DB::transaction(fn () => $this->save($semester, $this->validated($request)));

        return response()->json(['semester' => $semester->fresh()]);
    }

    public function destroy(Semester $semester): JsonResponse
    {
        $used = \App\Models\ClassOffering::where('semester_id', $semester->id)->exists() || \App\Models\EvaluationPeriod::where('semester_id', $semester->id)->exists();
        abort_if($used, 422, 'This semester has classes or evaluation periods. Keep it so past reports stay complete.');
        $semester->delete();

        return response()->json(['message' => 'Semester deleted.']);
    }

    /** Only one semester can be active at a time. */
    private function save(Semester $semester, array $data): Semester
    {
        if (! empty($data['is_active'])) {
            Semester::where('is_active', true)->when($semester->exists, fn ($q) => $q->whereKeyNot($semester->id))->update(['is_active' => false]);
        }
        $semester->fill($data)->save();

        return $semester;
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
