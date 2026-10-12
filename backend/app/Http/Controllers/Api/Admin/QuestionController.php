<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\EvaluationPeriod;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Models\EvaluationAnswer;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The evaluation form builder. */
class QuestionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Question::query()
                ->when($request->query('audience'), fn ($q, $a) => $q->where('audience', $a))
                ->orderBy('audience')->orderBy('sort_order')->orderBy('id')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $this->formLocked($data['audience']);
        $question = Question::create($data);
        Audit::log('question.created', "Added a {$question->audience} question: {$question->text}", $question);

        return response()->json(['question' => $question], 201);
    }

    public function update(Request $request, Question $question): JsonResponse
    {
        $data = $this->validated($request, true);
        // Translations and categories can be fixed any time; the questions themselves only between periods.
        if (collect($data)->except(['text_fil', 'category_fil', 'category'])->filter(fn ($v, $k) => $question->{$k} != $v)->isNotEmpty()) {
            $this->formLocked($question->audience);
        }
        $question->update($data);
        Audit::log('question.updated', "Edited a question: {$question->text}", $question);

        return response()->json(['question' => $question]);
    }

    /** Questions with answers are deactivated instead of deleted, to keep old reports intact. */
    public function destroy(Question $question): JsonResponse
    {
        $this->formLocked($question->audience);
        Audit::log('question.removed', "Removed a question: {$question->text}", $question);
        if (EvaluationAnswer::where('question_id', $question->id)->exists()) {
            $question->update(['is_active' => false]);

            return response()->json(['message' => 'Question has answers, so it was deactivated instead of deleted.']);
        }
        $question->delete();

        return response()->json(['message' => 'Question deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        $req = $updating ? 'sometimes' : 'required';

        return $request->validate([
            'audience' => [$req, Rule::in(['student', 'peer'])],
            'category' => ['nullable', 'string', 'max:80'],
            'category_fil' => ['nullable', 'string', 'max:80'],
            'text' => [$req, 'string', 'max:500'],
            'text_fil' => ['nullable', 'string', 'max:500'],
            'type' => [$req, Rule::in(['rating', 'text'])],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    /** Everyone in one period answers the same form, so it can't change while that form is in use. */
    private function formLocked(string $audience): void
    {
        $open = EvaluationPeriod::openNow($audience);
        abort_if($open, 422, "The {$open?->name} evaluation is open. Change the questions after it closes, so everyone answers the same form. (Filipino wording and categories can be fixed now.)");
    }
}
