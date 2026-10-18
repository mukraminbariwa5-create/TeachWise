<?php

namespace App\Http\Controllers\Api\Student;

use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Models\ClassOffering;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\User;
use App\Services\EvaluationService;
use App\Services\StudentClasses;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    /** Everything the student home screen needs in one request. */
    public function dashboard(Request $request): JsonResponse
    {
        $student = $request->user()->load('studentProfile.section');
        $period = EvaluationPeriod::currentOrNext('student');
        $offerings = StudentClasses::offerings($student);
        $done = StudentClasses::evaluatedIds($student, $period);

        $teachers = $offerings->map(fn (ClassOffering $o) => [
            'offering_id' => $o->id,
            'teacher' => Present::person($o->teacher),
            'subject' => ['code' => $o->subject->code, 'name' => $o->subject->name],
            'schedule' => $o->schedule,
            'status' => in_array($o->id, $done, true) ? 'completed' : 'pending',
        ])->sortBy(fn ($t) => $t['status'] === 'completed')->values();

        $completed = count(array_intersect($done, $offerings->pluck('id')->all()));
        $total = $offerings->count();

        return response()->json([
            'student' => Present::user($student),
            'period' => Present::period($period),
            'teachers' => $teachers,
            'subjects' => $offerings->map(fn (ClassOffering $o) => [
                'code' => $o->subject->code,
                'name' => $o->subject->name,
                'units' => $o->subject->units,
            ])->unique('code')->values(),
            'progress' => [
                'completed' => $completed,
                'total' => $total,
                'percent' => $total ? (int) round($completed / $total * 100) : 0,
            ],
        ]);
    }

    /** Questions for evaluating one teacher/class. */
    public function form(Request $request, ClassOffering $offering): JsonResponse
    {
        $student = $request->user()->load('studentProfile');
        $this->authorizeOffering($student, $offering);

        $period = EvaluationPeriod::openNow('student');
        $offering->load('teacher', 'subject', 'section');

        return response()->json([
            'offering' => Present::offering($offering),
            'teacher' => Present::person($offering->teacher),
            'period' => Present::period($period),
            'already_submitted' => $period && in_array($offering->id, StudentClasses::evaluatedIds($student, $period), true),
            'scale' => Tenant::school()->scaleLabels(),
            'questions' => Question::for('student')->get()->map->localized()->values(),
        ]);
    }

    public function submit(Request $request, EvaluationService $service): JsonResponse
    {
        $data = $request->validate([
            'class_offering_id' => ['required', 'integer', Tenant::exists('class_offerings')],
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.rating' => ['nullable', 'integer', 'between:1,5'],
            'answers.*.answer_text' => ['nullable', 'string', 'max:2000'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $student = $request->user()->load('studentProfile');
        $offering = ClassOffering::with('teacher')->findOrFail($data['class_offering_id']);
        $this->authorizeOffering($student, $offering);

        $period = EvaluationPeriod::openNow('student');
        abort_unless($period, 422, 'There is no open evaluation period right now.');

        $evaluation = $service->submit(
            $student, $offering->teacher, 'student', $period,
            $data['answers'], $data['comment'] ?? null, $offering->id,
        );

        return response()->json([
            'message' => 'Evaluation submitted. Thank you!',
            'evaluation_id' => $evaluation->id,
        ], 201);
    }

    /** The student's own past submissions. */
    public function history(Request $request): JsonResponse
    {
        $items = Evaluation::query()
            ->where('evaluator_id', $request->user()->id)
            ->with(['offering.subject', 'teacher', 'period'])
            ->latest('submitted_at')
            ->get()
            ->map(fn (Evaluation $e) => [
                'id' => $e->id,
                'teacher' => Present::person($e->teacher),
                'subject' => $e->offering ? ['code' => $e->offering->subject->code, 'name' => $e->offering->subject->name] : null,
                'period' => $e->period?->name,
                'overall_rating' => $e->overall_rating,
                'submitted_at' => $e->submitted_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $items]);
    }

    private function authorizeOffering(User $student, ClassOffering $offering): void
    {
        abort_unless(
            $student->studentProfile && (int) $offering->section_id === (int) $student->studentProfile->section_id,
            403,
            'You are not enrolled in this class.'
        );
    }
}
