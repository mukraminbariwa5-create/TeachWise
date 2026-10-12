<?php

namespace App\Services;

use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves a submitted evaluation (student-to-teacher or teacher-to-teacher).
 */
class EvaluationService
{
    /**
     * @param  array<int, array{question_id:int, rating?:int|null, answer_text?:string|null}>  $answers
     */
    public function submit(
        User $evaluator,
        User $teacher,
        string $audience,              // 'student' or 'peer'
        EvaluationPeriod $period,
        array $answers,
        ?string $comment,
        ?int $offeringId = null,
    ): Evaluation {
        if (! $period->is_open) {
            throw ValidationException::withMessages(['period' => 'This evaluation period is closed.']);
        }

        $exists = Evaluation::query()
            ->where('evaluator_id', $evaluator->id)
            ->where('teacher_id', $teacher->id)
            ->where('evaluation_period_id', $period->id)
            ->when($offeringId, fn ($q) => $q->where('class_offering_id', $offeringId), fn ($q) => $q->whereNull('class_offering_id'))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['evaluation' => 'You already submitted this evaluation.']);
        }

        $questions = Question::for($audience)->get()->keyBy('id');
        $given = collect($answers)->keyBy('question_id');

        $this->validateAnswers($questions, $given);

        $ratings = $given->filter(fn ($a) => isset($questions[$a['question_id']]) && $questions[$a['question_id']]->type === 'rating')
            ->pluck('rating')->map(fn ($r) => (int) $r);

        return DB::transaction(function () use ($evaluator, $teacher, $period, $offeringId, $comment, $questions, $given, $ratings, $audience) {
            $evaluation = Evaluation::create([
                'evaluation_period_id' => $period->id,
                'class_offering_id' => $offeringId,
                'teacher_id' => $teacher->id,
                'evaluator_id' => $evaluator->id,
                'evaluator_role' => $audience === 'peer' ? 'teacher' : 'student',
                'overall_rating' => $ratings->isEmpty() ? null : round($ratings->avg(), 2),
                'comment' => filled($comment) ? trim($comment) : null,
                'submitted_at' => now(),
            ]);

            foreach ($questions as $question) {
                $answer = $given->get($question->id);
                if (! $answer) {
                    continue;
                }
                $evaluation->answers()->create([
                    'question_id' => $question->id,
                    'rating' => $question->type === 'rating' ? (int) $answer['rating'] : null,
                    'answer_text' => $question->type === 'text' ? ($answer['answer_text'] ?? null) : null,
                ]);
            }

            return $evaluation;
        });
    }

    private function validateAnswers(Collection $questions, Collection $given): void
    {
        $errors = [];

        foreach ($given->keys() as $id) {
            if (! $questions->has($id)) {
                $errors["answers.$id"] = 'This question is not part of the evaluation form.';
            }
        }

        foreach ($questions as $question) {
            if ($question->type !== 'rating') {
                continue;
            }
            $rating = $given->get($question->id)['rating'] ?? null;
            if (! is_numeric($rating) || $rating < 1 || $rating > 5) {
                $errors["answers.{$question->id}"] = 'Please rate this item from 1 to 5.';
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }
}
