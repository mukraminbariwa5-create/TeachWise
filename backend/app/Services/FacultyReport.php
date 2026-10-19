<?php

namespace App\Services;

use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\User;
use App\Support\Present;

/**
 * Everything about one teacher's results, used by the admin's faculty report and the
 * teacher's own printable report: student and peer ratings, ratings per class,
 * the trend across evaluation periods, and anonymous comments.
 */
class FacultyReport
{
    public static function build(User $teacher, ?int $periodId = null): array
    {
        $student = new RatingStats($teacher->id, $periodId, 'student');
        $peer = new RatingStats($teacher->id, $periodId, 'teacher');

        $perClass = Evaluation::query()
            ->where('teacher_id', $teacher->id)
            ->where('evaluator_role', 'student')
            ->when($periodId, fn ($q) => $q->where('evaluation_period_id', $periodId))
            ->whereNotNull('class_offering_id')
            ->with('offering.subject', 'offering.section')
            ->get()
            ->groupBy('class_offering_id')
            ->map(fn ($group) => [
                'subject_code' => $group->first()->offering?->subject?->code,
                'subject_name' => $group->first()->offering?->subject?->name,
                'section' => $group->first()->offering?->section?->label,
                'responses' => $group->count(),
                'average' => round($group->avg('overall_rating'), 2),
            ])->values();

        return [
            'teacher' => Present::person($teacher),
            'period' => $periodId ? Present::period(EvaluationPeriod::find($periodId)) : null,
            'generated_at' => now()->toIso8601String(),
            'student_ratings' => ['overall' => $student->overall(), 'criteria' => $student->byCriteria(), 'distribution' => $student->distribution()],
            'department_average' => self::departmentAverage($teacher, $periodId),
            'peer_ratings' => ['overall' => $peer->overall(), 'criteria' => $peer->byCriteria()],
            'classes' => $perClass,
            'trend' => self::trend($teacher),
            'comments' => $student->recentComments(50),
        ];
    }

    /**
     * Average student rating across every teacher in the same department (same period filter),
     * for context: "3.80 vs department 3.95". Null without a department or ratings.
     */
    public static function departmentAverage(User $teacher, ?int $periodId = null): ?float
    {
        if (! $teacher->department_id) {
            return null;
        }
        $avg = Evaluation::query()
            ->where('evaluator_role', 'student')
            ->when($periodId, fn ($q) => $q->where('evaluation_period_id', $periodId))
            ->whereIn('teacher_id', User::where('role', User::ROLE_TEACHER)->where('department_id', $teacher->department_id)->select('id'))
            ->avg('overall_rating');

        return $avg !== null ? round((float) $avg, 2) : null;
    }

    /** Average student rating per evaluation period, oldest first. */
    public static function trend(User $teacher): array
    {
        return Evaluation::query()
            ->join('evaluation_periods', 'evaluation_periods.id', '=', 'evaluations.evaluation_period_id')
            ->where('evaluations.teacher_id', $teacher->id)
            ->where('evaluations.evaluator_role', 'student')
            ->groupBy('evaluation_periods.id', 'evaluation_periods.name', 'evaluation_periods.opens_at')
            ->orderBy('evaluation_periods.opens_at')
            ->selectRaw('evaluation_periods.id, evaluation_periods.name, evaluation_periods.opens_at, AVG(evaluations.overall_rating) as avg_rating, COUNT(*) as total')
            ->get()
            ->map(fn ($r) => ['period_id' => $r->id, 'period' => $r->name, 'average' => round((float) $r->avg_rating, 2), 'responses' => (int) $r->total])
            ->all();
    }
}
