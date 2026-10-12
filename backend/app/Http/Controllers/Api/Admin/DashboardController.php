<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\AdminScope;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\Notifier;
use App\Models\ClassOffering;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Section;
use App\Models\Semester;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $period = EvaluationPeriod::currentOrNext('student');
        $semester = Semester::current();

        // Department admins see their department; school admins the whole school.
        $evaluations = fn () => Evaluation::where('evaluator_role', 'student')
            ->when(AdminScope::limited(), fn ($q) => $q->whereIn('class_offering_id', AdminScope::offerings(ClassOffering::query())->select('id')));
        $submitted = $period ? $evaluations()->where('evaluation_period_id', $period->id)->count() : 0;

        $faculty = AdminScope::users(User::query())
            ->where('role', User::ROLE_TEACHER)
            ->withCount(['evaluationsReceived as responses' => fn ($q) => $q->where('evaluator_role', 'student')])
            ->withAvg(['evaluationsReceived as average' => fn ($q) => $q->where('evaluator_role', 'student')], 'overall_rating')
            ->orderBy('name')
            ->get()
            ->map(fn (User $t) => Present::person($t) + [
                'responses' => (int) $t->responses,
                'average' => $t->average !== null ? round((float) $t->average, 2) : null,
            ]);

        $bySection = $this->completionBySection($period, $semester);
        $expected = $bySection->sum('expected');
        $done = $bySection->sum('completed');

        return response()->json([
            'semester' => $semester?->only(['id', 'name']),
            'period' => Present::period($period),
            'stats' => [
                'faculty' => AdminScope::users(User::query())->where('role', User::ROLE_TEACHER)->where('is_active', true)->count(),
                'students' => AdminScope::users(User::query())->where('role', User::ROLE_STUDENT)->where('is_active', true)->count(),
                'evaluations_submitted' => $submitted,
                'average_rating' => ($avg = $evaluations()->avg('overall_rating')) !== null ? round((float) $avg, 2) : null,
            ],
            'completion' => [
                'completed' => $done,
                'expected' => $expected,
                'percent' => $expected ? (int) round($done / $expected * 100) : 0,
                'by_section' => $bySection->values(),
            ],
            'faculty' => $faculty,
            'periods' => EvaluationPeriod::orderBy('opens_at')->get()->map(fn ($p) => Present::period($p)),
        ]);
    }

    /** Notify every student who still has pending evaluations in the open period. */
    public function sendReminders(): JsonResponse
    {
        $period = EvaluationPeriod::openNow('student');
        abort_unless($period, 422, 'There is no open evaluation period.');

        $count = 0;
        StudentProfile::query()->whereNotNull('section_id')->whereHas('user')->with('user')->chunkById(200, function ($profiles) use ($period, &$count) {
            foreach ($profiles as $profile) {
                $offeringIds = ClassOffering::where('section_id', $profile->section_id)->pluck('id');
                $done = Evaluation::where('evaluator_id', $profile->user_id)
                    ->where('evaluation_period_id', $period->id)
                    ->whereIn('class_offering_id', $offeringIds)->count();
                $pending = $offeringIds->count() - $done;

                if ($pending > 0 && $profile->user) {
                    Notifier::send($profile->user, 'reminders', "{$period->name} evaluation reminder", "You have {$pending} pending evaluation(s). The period closes on {$period->closes_at->format('M j, g:i A')}.", ['screen' => 'home']);
                    $count++;
                }
            }
        });

        Audit::log('reminders.sent', "Sent a {$period->name} reminder to {$count} student(s).", $period);

        return response()->json(['message' => "Reminder sent to {$count} student(s).", 'sent' => $count]);
    }

    private function completionBySection(?EvaluationPeriod $period, ?Semester $semester): Collection
    {
        return AdminScope::sections(Section::query())
            ->withCount('students')
            ->orderBy('course')->orderBy('year_level')->orderBy('name')
            ->get()
            ->map(function (Section $section) use ($period, $semester) {
                $offeringIds = ClassOffering::where('section_id', $section->id)
                    ->when($semester, fn ($q) => $q->where(fn ($w) => $w->where('semester_id', $semester->id)->orWhereNull('semester_id')))
                    ->pluck('id');
                $expected = $offeringIds->count() * $section->students_count;
                $completed = $period
                    ? Evaluation::where('evaluation_period_id', $period->id)->where('evaluator_role', 'student')->whereIn('class_offering_id', $offeringIds)->count()
                    : 0;

                return [
                    'section_id' => $section->id,
                    'label' => $section->label,
                    'completed' => $completed,
                    'expected' => $expected,
                    'percent' => $expected ? (int) round($completed / $expected * 100) : 0,
                ];
            })
            ->filter(fn ($s) => $s['expected'] > 0);
    }
}
