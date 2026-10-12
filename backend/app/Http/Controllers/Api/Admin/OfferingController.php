<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Section;
use App\Support\AdminScope;
use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Models\ClassOffering;
use App\Models\User;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Assign a teacher to teach a subject to a section. */
class OfferingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $offerings = AdminScope::offerings(ClassOffering::query())
            ->with(['teacher', 'subject', 'section', 'semester'])
            ->when($request->integer('semester_id'), fn ($q, $id) => $q->where('semester_id', $id))
            ->when($request->integer('teacher_id'), fn ($q, $id) => $q->where('teacher_id', $id))
            ->when($request->integer('section_id'), fn ($q, $id) => $q->where('section_id', $id))
            ->orderBy('section_id')
            ->get()
            ->map(fn (ClassOffering $o) => Present::offering($o) + [
                'teacher' => Present::person($o->teacher),
                'semester' => $o->semester?->name,
            ]);

        return response()->json(['data' => $offerings]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $offering = ClassOffering::create($data)->load(['teacher', 'subject', 'section']);
        Audit::log('class.assigned', "Assigned {$offering->teacher->name} to {$offering->subject->code} for {$offering->section->label}.", $offering);

        return response()->json(['offering' => Present::offering($offering) + ['teacher' => Present::person($offering->teacher)]], 201);
    }

    public function update(Request $request, ClassOffering $offering): JsonResponse
    {
        $this->inScope($offering);
        $offering->update($this->validated($request, $offering));
        $offering->load(['teacher', 'subject', 'section']);

        return response()->json(['offering' => Present::offering($offering) + ['teacher' => Present::person($offering->teacher)]]);
    }

    public function destroy(ClassOffering $offering): JsonResponse
    {
        $this->inScope($offering);
        abort_if(\App\Models\Evaluation::where('class_offering_id', $offering->id)->exists(), 422, 'Students already evaluated this class, so it stays for the reports. It disappears from dashboards when its semester ends.');
        Audit::log('class.removed', "Removed a class assignment.", null, ['offering_id' => $offering->id]);
        $offering->delete();

        return response()->json(['message' => 'Class assignment removed.']);
    }

    private function validated(Request $request, ?ClassOffering $offering = null): array
    {
        $data = $request->validate([
            'teacher_id' => ['required', 'integer', Tenant::exists('users')],
            'subject_id' => ['required', 'integer', Tenant::exists('subjects')],
            'section_id' => ['required', 'integer', Tenant::exists('sections')],
            'semester_id' => ['nullable', 'integer', Tenant::exists('semesters')],
            'schedule' => ['nullable', 'string', 'max:60'],
        ]);

        $teacher = User::find($data['teacher_id']);
        abort_unless($teacher?->isTeacher(), 422, 'The selected user is not a teacher.');
        if (AdminScope::limited()) {
            $ownSection = AdminScope::sections(Section::whereKey($data['section_id']))->exists();
            abort_unless($ownSection || $teacher->department_id === AdminScope::departmentId(), 422, 'Choose a section or a teacher from your department.');
        }

        $duplicate = ClassOffering::query()
            ->where(collect($data)->only(['teacher_id', 'subject_id', 'section_id'])->all())
            ->where('semester_id', $data['semester_id'] ?? null)
            ->when($offering, fn ($q) => $q->whereKeyNot($offering->id))
            ->exists();
        abort_if($duplicate, 422, 'This teacher is already assigned to that subject and section.');

        return $data;
    }

    private function inScope(ClassOffering $offering): void
    {
        AdminScope::check(AdminScope::offerings(ClassOffering::whereKey($offering->id))->exists());
    }
}
