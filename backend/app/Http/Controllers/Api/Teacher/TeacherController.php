<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Models\ClassOffering;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\Semester;
use App\Models\User;
use App\Services\EvaluationService;
use App\Services\FacultyReport;
use App\Services\RatingStats;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TeacherController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $teacher = $request->user();
        $stats = new RatingStats($teacher->id);
        $school = Tenant::school();
        $peerOn = $school->peerEvaluationOn();
        $peerPeriod = $peerOn ? EvaluationPeriod::currentOrNext('peer') : null;
        $min = $school->minResponses();
        $overall = $stats->overall();
        // Too few answers could reveal who said what: hold back the details until there are enough.
        $locked = $overall['responses'] < $min;

        $offerings = $this->myOfferings($teacher);
        $perOffering = Evaluation::query()
            ->where('teacher_id', $teacher->id)
            ->where('evaluator_role', 'student')
            ->whereIn('class_offering_id', $offerings->pluck('id'))
            ->groupBy('class_offering_id')
            ->selectRaw('class_offering_id, AVG(overall_rating) as avg_rating, COUNT(*) as total')
            ->get()
            ->keyBy('class_offering_id');

        return response()->json([
            'teacher' => Present::user($teacher),
            'semester' => Semester::current()?->only(['id', 'name']),
            'overall' => $locked ? ['average' => null, 'responses' => $overall['responses']] : $overall,
            'criteria' => $locked ? [] : $stats->byCriteria(),
            'peer_overall' => (new RatingStats($teacher->id, null, 'teacher'))->overall(),
            'trend' => $locked ? [] : FacultyReport::trend($teacher),
            'recent_feedback' => $locked ? [] : $stats->recentComments(3),
            'subjects' => $offerings->map(fn (ClassOffering $o) => Present::offering($o) + [
                'responses' => $n = (int) ($perOffering[$o->id]->total ?? 0),
                'average' => isset($perOffering[$o->id]) && $n >= $min ? round((float) $perOffering[$o->id]->avg_rating, 2) : null,
            ])->values(),
            'peer_evaluation' => $peerOn,
            'peer_period' => Present::period($peerPeriod),
            'peers' => $peerOn ? $this->peers($teacher, $peerPeriod) : [],
            'privacy' => ['min_responses' => $min, 'locked' => $locked],
        ]);
    }

    /** The teacher's own full report (printable / save as PDF). */
    public function report(Request $request): JsonResponse
    {
        $report = FacultyReport::build($request->user(), $request->integer('period_id') ?: null);
        $min = Tenant::school()->minResponses();
        if ($report['student_ratings']['overall']['responses'] < $min) {
            $report['student_ratings'] = ['overall' => ['average' => null, 'responses' => $report['student_ratings']['overall']['responses']], 'criteria' => []];
            $report['comments'] = [];
            $report['classes'] = [];
        } else {
            $report['classes'] = collect($report['classes'])->map(fn ($c) => $c['responses'] < $min ? ['average' => null] + $c : $c)->values();
        }
        $report['privacy'] = ['min_responses' => $min];

        return response()->json($report);
    }

    /** Paginated anonymous comments, optionally filtered by class. */
    public function feedback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'offering_id' => ['nullable', 'integer'],
            'period_id' => ['nullable', 'integer'],
        ]);

        $min = Tenant::school()->minResponses();
        $total = Evaluation::where('teacher_id', $request->user()->id)->where('evaluator_role', 'student')->count();
        if ($total < $min) {
            return response()->json(['data' => [], 'current_page' => 1, 'last_page' => 1, 'total' => 0, 'per_page' => 20, 'locked' => true, 'min_responses' => $min]);
        }

        $page = Evaluation::query()
            ->where('teacher_id', $request->user()->id)
            ->where('evaluator_role', 'student')
            ->whereNotNull('comment')
            ->when($data['offering_id'] ?? null, fn ($q, $id) => $q->where('class_offering_id', $id))
            ->when($data['period_id'] ?? null, fn ($q, $id) => $q->where('evaluation_period_id', $id))
            ->with(['offering.subject', 'period'])
            ->latest('submitted_at')
            ->paginate(20);

        $page->getCollection()->transform(fn (Evaluation $e) => [
            'id' => $e->id,
            'comment' => $e->comment,
            'rating' => $e->overall_rating,
            'subject_code' => $e->offering?->subject?->code,
            'period' => $e->period?->name,
            'submitted_at' => $e->submitted_at?->toIso8601String(),
        ]);

        return response()->json($page);
    }

    public function peerForm(Request $request, User $peer): JsonResponse
    {
        $teacher = $request->user();
        abort_unless(Tenant::school()->peerEvaluationOn(), 403, 'Peer evaluation is turned off at your school.');
        $this->authorizePeer($teacher, $peer);
        $period = EvaluationPeriod::openNow('peer');

        return response()->json([
            'teacher' => Present::person($peer),
            'period' => Present::period($period),
            'already_submitted' => $period && $this->peerDone($teacher, $peer, $period),
            'scale' => Tenant::school()->scaleLabels(),
            'questions' => Question::for('peer')->get()->map->localized()->values(),
        ]);
    }

    public function submitPeer(Request $request, EvaluationService $service): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => ['required', 'integer', Tenant::exists('users')],
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.rating' => ['nullable', 'integer', 'between:1,5'],
            'answers.*.answer_text' => ['nullable', 'string', 'max:2000'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $teacher = $request->user();
        abort_unless(Tenant::school()->peerEvaluationOn(), 403, 'Peer evaluation is turned off at your school.');
        $peer = User::findOrFail($data['teacher_id']);
        $this->authorizePeer($teacher, $peer);

        $period = EvaluationPeriod::openNow('peer');
        abort_unless($period, 422, 'There is no open peer evaluation period right now.');

        $evaluation = $service->submit($teacher, $peer, 'peer', $period, $data['answers'], $data['comment'] ?? null);

        return response()->json(['message' => 'Peer evaluation submitted.', 'evaluation_id' => $evaluation->id], 201);
    }

    private function myOfferings(User $teacher): Collection
    {
        $semester = Semester::current();

        return $teacher->offerings()
            ->when($semester, fn ($q) => $q->where(fn ($w) => $w->where('semester_id', $semester->id)->orWhereNull('semester_id')))
            ->with(['subject', 'section'])
            ->orderBy('subject_id')
            ->get();
    }

    /** Colleagues who teach at least one of the same subjects this semester. */
    private function peers(User $teacher, ?EvaluationPeriod $period): Collection
    {
        $mySubjectIds = $this->myOfferings($teacher)->pluck('subject_id')->unique();
        $semester = Semester::current();

        $theirs = ClassOffering::query()
            ->whereIn('subject_id', $mySubjectIds)
            ->where('teacher_id', '!=', $teacher->id)
            ->when($semester, fn ($q) => $q->where(fn ($w) => $w->where('semester_id', $semester->id)->orWhereNull('semester_id')))
            ->with(['teacher', 'subject', 'section'])
            ->get()
            ->groupBy('teacher_id');

        $done = $period
            ? Evaluation::where('evaluator_id', $teacher->id)->where('evaluation_period_id', $period->id)->pluck('teacher_id')->all()
            : [];

        return $theirs->map(function (Collection $offerings) use ($done) {
            $peer = $offerings->first()->teacher;

            return [
                'teacher' => Present::person($peer),
                'shared_subjects' => $offerings->map(fn ($o) => $o->subject->code)->unique()->values(),
                'status' => in_array($peer->id, $done) ? 'completed' : 'pending',
            ];
        })->sortBy(fn ($p) => $p['status'] === 'completed')->values();
    }

    private function authorizePeer(User $teacher, User $peer): void
    {
        $isPeer = $peer->isTeacher() && $peer->id !== $teacher->id
            && $this->peers($teacher, null)->contains(fn ($p) => $p['teacher']['id'] === $peer->id);

        abort_unless($isPeer, 403, 'You can only evaluate colleagues who share a subject with you.');
    }

    private function peerDone(User $teacher, User $peer, EvaluationPeriod $period): bool
    {
        return Evaluation::where('evaluator_id', $teacher->id)
            ->where('teacher_id', $peer->id)
            ->where('evaluation_period_id', $period->id)
            ->exists();
    }
}
