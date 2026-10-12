<?php

namespace App\Services;

use App\Models\Evaluation;
use App\Models\EvaluationAnswer;
use App\Support\Say;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Aggregated rating numbers for teacher dashboards and admin reports.
 * Only student evaluations are counted unless $role is changed.
 */
class RatingStats
{
    public function __construct(
        private int $teacherId,
        private ?int $periodId = null,
        private string $role = 'student',
    ) {}

    private function evaluations(): Builder
    {
        return Evaluation::query()
            ->where('teacher_id', $this->teacherId)
            ->where('evaluator_role', $this->role)
            ->when($this->periodId, fn ($q) => $q->where('evaluation_period_id', $this->periodId));
    }

    /** @return array{average: float|null, responses: int} */
    public function overall(): array
    {
        $row = $this->evaluations()->selectRaw('AVG(overall_rating) as avg_rating, COUNT(*) as total')->first();

        return [
            'average' => $row->avg_rating !== null ? round((float) $row->avg_rating, 2) : null,
            'responses' => (int) $row->total,
        ];
    }

    /** Average per question category, in form order. */
    public function byCriteria(): Collection
    {
        return EvaluationAnswer::query()
            ->join('questions', 'questions.id', '=', 'evaluation_answers.question_id')
            ->whereIn('evaluation_answers.evaluation_id', $this->evaluations()->select('id'))
            ->whereNotNull('evaluation_answers.rating')
            ->groupBy('questions.id', 'questions.category', 'questions.category_fil', 'questions.text', 'questions.text_fil', 'questions.sort_order')
            ->orderBy('questions.sort_order')
            ->selectRaw('questions.id, questions.category, questions.category_fil, questions.text, questions.text_fil, AVG(evaluation_answers.rating) as avg_rating, COUNT(*) as total')
            ->get()
            ->map(fn ($r) => [
                'question_id' => $r->id,
                'category' => (Say::fil() ? ($r->category_fil ?: $r->text_fil) : null) ?: ($r->category ?? $r->text),
                'text' => Say::fil() && $r->text_fil ? $r->text_fil : $r->text,
                'average' => round((float) $r->avg_rating, 2),
                'responses' => (int) $r->total,
            ]);
    }

    /** Most recent written comments, without any evaluator identity. */
    public function recentComments(int $limit = 5): Collection
    {
        return $this->evaluations()
            ->whereNotNull('comment')
            ->with('offering.subject')
            ->latest('submitted_at')
            ->limit($limit)
            ->get()
            ->map(fn (Evaluation $e) => [
                'comment' => $e->comment,
                'rating' => $e->overall_rating,
                'subject_code' => $e->offering?->subject?->code,
                'submitted_at' => $e->submitted_at?->toIso8601String(),
            ]);
    }
}
