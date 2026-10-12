<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\User;

class TeacherTest extends ApiTestCase
{
    public function test_dashboard_has_ratings_and_never_reveals_evaluators(): void
    {
        $this->actingAsUsername('lsantos');

        $response = $this->getJson('/api/teacher/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'overall' => ['average', 'responses'],
                'criteria' => [['category', 'average']],
                'recent_feedback',
                'subjects' => [['id', 'subject', 'section', 'responses', 'average']],
                'peers' => [['teacher', 'shared_subjects', 'status']],
            ]);

        $this->assertGreaterThan(0, $response->json('overall.responses'));
        $this->assertStringNotContainsString('evaluator', $response->getContent());
    }

    public function test_feedback_is_paginated_and_anonymous(): void
    {
        $this->actingAsUsername('lsantos');

        $response = $this->getJson('/api/teacher/feedback')->assertOk()->assertJsonStructure(['data', 'current_page', 'total']);
        $this->assertStringNotContainsString('evaluator', $response->getContent());
    }

    public function test_teacher_can_evaluate_a_peer_who_shares_a_subject(): void
    {
        $this->actingAsUsername('lsantos');
        $peer = collect($this->getJson('/api/teacher/dashboard')->json('peers'))->first();
        $this->assertNotNull($peer, 'Liza should have at least one peer.');

        $answers = Question::for('peer')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();

        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $peer['teacher']['id'], 'answers' => $answers])
            ->assertCreated();
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $peer['teacher']['id'], 'answers' => $answers])
            ->assertStatus(422);
    }

    public function test_teacher_cannot_evaluate_someone_who_is_not_a_peer(): void
    {
        $stranger = User::factory()->teacher()->create();   // teaches nothing Liza teaches
        $this->actingAsUsername('lsantos');

        $this->getJson("/api/teacher/peers/{$stranger->id}/form")->assertForbidden();
    }
}
