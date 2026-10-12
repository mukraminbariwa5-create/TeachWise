<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;

class WiseTest extends ApiTestCase
{
    public function test_student_gets_greeting_suggestions_and_answers_from_real_data(): void
    {
        config(['services.ollama.enabled' => false]);
        $this->actingAsUsername('aisha');

        $this->getJson('/api/wise/messages')
            ->assertOk()
            ->assertJsonPath('messages', [])
            ->assertJsonCount(4, 'suggestions');
        $this->assertStringContainsString('2 pending', $this->getJson('/api/wise/messages')->json('greeting'));
        $this->assertStringContainsString('2 teachers', $this->getJson('/api/wise/messages')->json('tip'));

        $this->postJson('/api/wise/messages', ['message' => 'Is my evaluation anonymous?'])
            ->assertCreated()
            ->assertJsonPath('source', 'rules')
            ->assertJsonPath('reply.role', 'assistant');

        $reply = $this->postJson('/api/wise/messages', ['message' => 'Which teachers are left?'])->json('reply.content');
        $this->assertStringContainsString('Prof. Ramon Dela Cruz', $reply);
        $this->assertStringContainsString('Prof. Liza Santos', $reply);

        $this->getJson('/api/wise/messages')->assertJsonCount(4, 'messages');
        $this->deleteJson('/api/wise/messages')->assertOk();
        $this->getJson('/api/wise/messages')->assertJsonCount(0, 'messages');
    }

    public function test_teacher_and_admin_answers(): void
    {
        config(['services.ollama.enabled' => false]);

        $this->actingAsUsername('lsantos');
        $this->assertStringContainsString('Your lowest area is', $this->postJson('/api/wise/messages', ['message' => 'What is my weakest area?'])->json('reply.content'));

        $this->actingAsUsername('admin');
        $this->assertStringContainsString('completion', $this->postJson('/api/wise/messages', ['message' => 'Which section is behind?'])->json('reply.content'));
    }

    public function test_uses_ollama_when_enabled_and_falls_back_when_it_fails(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');

        Http::fake(['*/api/chat' => Http::sequence()
            ->push(['message' => ['role' => 'assistant', 'content' => 'Hello from the model.']])
            ->push('down', 500)]);
        $this->postJson('/api/wise/messages', ['message' => 'Hi'])
            ->assertJsonPath('source', 'ollama')
            ->assertJsonPath('reply.content', 'Hello from the model.');

        $this->postJson('/api/wise/messages', ['message' => 'When is the deadline?'])
            ->assertJsonPath('source', 'rules');
    }
}
