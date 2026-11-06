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
        $student->loadMissing('studentProfile.section.program');
        $sectionId = $student->studentProfile?->section_id;
        if (! $sectionId || ! $student->studentProfile?->section?->program?->department_id) {
            return new Collection;
        }
        $semester = Semester::current();
        if (! $semester) {
            return new Collection;
        }

        return ClassOffering::query()
            ->where('section_id', $sectionId)
            ->whereHas('teacher', fn ($q) => $q->where('role', User::ROLE_TEACHER)->where('is_active', true)->whereHas('departmentRelation'))
            ->where('semester_id', $semester->id)
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
