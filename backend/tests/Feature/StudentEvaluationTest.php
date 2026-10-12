<?php

namespace Tests\Feature;

use App\Models\ClassOffering;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\Section;

class StudentEvaluationTest extends ApiTestCase
{
    private function answers(int $rating = 4): array
    {
        return Question::for('student')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => $rating])->all();
    }

    private function pendingOfferingFor(string $username): ClassOffering
    {
        $this->actingAsUsername($username);
        $pending = collect($this->getJson('/api/student/dashboard')->json('teachers'))->firstWhere('status', 'pending');

        return ClassOffering::findOrFail($pending['offering_id']);
    }

    public function test_dashboard_shows_teachers_and_progress(): void
    {
        $this->actingAsUsername('aisha');

        $this->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('period.name', 'Midterm')
            ->assertJsonPath('period.is_open', true)
            ->assertJsonCount(4, 'teachers')
            ->assertJsonPath('progress.completed', 2)
            ->assertJsonPath('progress.total', 4)
            ->assertJsonPath('progress.percent', 50)
            ->assertJsonPath('teachers.0.status', 'pending');
    }

    public function test_student_can_submit_an_evaluation(): void
    {
        $offering = $this->pendingOfferingFor('aisha');

        $this->getJson("/api/student/offerings/{$offering->id}/form")
            ->assertOk()
            ->assertJsonPath('already_submitted', false)
            ->assertJsonCount(5, 'questions');

        $this->postJson('/api/student/evaluations', [
            'class_offering_id' => $offering->id,
            'answers' => $this->answers(5),
            'comment' => 'Great class.',
        ])->assertCreated();

        $this->assertDatabaseHas('evaluations', [
            'class_offering_id' => $offering->id, 'overall_rating' => 5, 'comment' => 'Great class.',
        ]);
        $this->getJson('/api/student/dashboard')->assertJsonPath('progress.completed', 3);
    }

    public function test_cannot_submit_twice(): void
    {
        $offering = $this->pendingOfferingFor('aisha');
        $payload = ['class_offering_id' => $offering->id, 'answers' => $this->answers()];

        $this->postJson('/api/student/evaluations', $payload)->assertCreated();
        $this->postJson('/api/student/evaluations', $payload)->assertStatus(422)->assertJsonValidationErrors('evaluation');
    }

    public function test_every_rating_question_must_be_answered(): void
    {
        $offering = $this->pendingOfferingFor('aisha');
        $answers = $this->answers();
        array_pop($answers);

        $this->postJson('/api/student/evaluations', ['class_offering_id' => $offering->id, 'answers' => $answers])
            ->assertStatus(422);
    }

    public function test_cannot_evaluate_a_class_outside_own_section(): void
    {
        $aisha = $this->actingAsUsername('aisha');
        $other = ClassOffering::where('section_id', '!=', $aisha->studentProfile->section_id)->first();

        $this->postJson('/api/student/evaluations', ['class_offering_id' => $other->id, 'answers' => $this->answers()])
            ->assertForbidden();
    }

    public function test_cannot_submit_when_period_is_closed(): void
    {
        $offering = $this->pendingOfferingFor('aisha');
        EvaluationPeriod::where('type', 'student')->update(['closes_at' => now()->subMinute()]);

        $this->postJson('/api/student/evaluations', ['class_offering_id' => $offering->id, 'answers' => $this->answers()])
            ->assertStatus(422);
    }

    public function test_history_lists_own_submissions(): void
    {
        $this->actingAsUsername('aisha');

        $this->getJson('/api/student/history')->assertOk()->assertJsonCount(2, 'data');
    }
}
