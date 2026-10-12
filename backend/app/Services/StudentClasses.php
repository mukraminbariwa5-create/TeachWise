<?php

namespace App\Services;

use App\Models\ClassOffering;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/** Which classes a student has and which of them they already evaluated. */
class StudentClasses
{
    /** Classes taught to the student's section in the active semester. */
    public static function offerings(User $student): Collection
    {
        $sectionId = $student->studentProfile?->section_id;
        if (! $sectionId) {
            return new Collection;
        }
        $semester = Semester::current();

        return ClassOffering::query()
            ->where('section_id', $sectionId)
            ->when($semester, fn ($q) => $q->where(fn ($w) => $w->where('semester_id', $semester->id)->orWhereNull('semester_id')))
            ->with(['teacher', 'subject', 'section'])
            ->orderBy('id')
            ->get();
    }

    /** @return int[] offering ids the student already evaluated in this period */
    public static function evaluatedIds(User $student, ?EvaluationPeriod $period): array
    {
        if (! $period) {
            return [];
        }

        return Evaluation::query()
            ->where('evaluator_id', $student->id)
            ->where('evaluation_period_id', $period->id)
            ->pluck('class_offering_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
