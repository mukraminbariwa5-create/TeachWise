<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Support\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use App\Support\WisePrompt;

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
        $this->postJson('/api/wise/messages', ['message' => 'Can you help me plan my schoolwork?'])
            ->assertJsonPath('source', 'ollama')
            ->assertJsonPath('reply.content', 'Hello from the model.');

        $this->postJson('/api/wise/messages', ['message' => 'When is the deadline?'])
            ->assertJsonPath('source', 'rules');
    }

    public function test_guidance_receives_private_conversation_context_and_verified_product_knowledge(): void
    {
        config(['services.ollama.enabled' => true]);
        $other = $this->actingAsUsername('lsantos');
        ChatMessage::create(['user_id' => $other->id, 'role' => 'user', 'content' => 'Private other-user concern']);
        $student = $this->actingAsUsername('aisha');
        for ($i = 0; $i < 14; $i++) {
            ChatMessage::create(['user_id' => $student->id, 'role' => 'user', 'content' => "Concern {$i}"]);
            ChatMessage::create(['user_id' => $student->id, 'role' => 'assistant', 'content' => "Discussion {$i}"]);
        }
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Let us work through that together.']])]);
        $this->postJson('/api/wise/messages', ['message' => 'Can we continue with that concern?'])
            ->assertCreated()->assertJsonPath('source', 'ollama');

        Http::assertSent(function ($request) {
            $messages = $request['messages'];
            $this->assertCount(26, $messages);
            $this->assertSame('system', $messages[0]['role']);
            $this->assertStringContainsString('professional judgment', $messages[0]['content']);
            $this->assertStringContainsString('not automatic training or permanent memory', $messages[0]['content']);
            $this->assertStringContainsString('VERIFIED CONTEXT', $messages[0]['content']);
            $this->assertStringContainsString('Aisha', $messages[0]['content']);
            $this->assertSame('Concern 2', $messages[1]['content']);
            $this->assertSame('Can we continue with that concern?', $messages[25]['content']);
            $this->assertStringNotContainsString('Private other-user concern', json_encode($messages));
            return $request['options']['num_ctx'] === 8192;
        });
    }

    public function test_empty_model_reply_discloses_limited_mode_and_still_saves_the_conversation(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => '  ']])]);
        $this->postJson('/api/wise/messages', ['message' => 'What is TeachWise for?'])
            ->assertCreated()
            ->assertJsonPath('source', 'rules')
            ->assertJsonPath('reply.content', fn ($text) => str_contains($text, 'limited built-in answer') && str_contains($text, 'guidance assistant'));
        $this->getJson('/api/wise/messages')->assertJsonCount(2, 'messages');
    }

    public function test_teacher_feedback_below_privacy_threshold_is_not_sent_to_the_model(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('lsantos');
        $school = Tenant::school();
        $school->update(['settings' => array_replace($school->settings ?? [], ['min_responses' => 10000])]);
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'We can work on general teaching strategies.']])]);
        $this->postJson('/api/wise/messages', ['message' => 'What do students say about me?'])->assertCreated();
        Http::assertSent(function ($request) {
            $system = $request['messages'][0]['content'];
            $this->assertStringContainsString('"privacy_locked": true', $system);
            $this->assertStringContainsString('"comments": []', $system);
            $this->assertStringContainsString('"average": null', $system);
            return true;
        });
    }

    public function test_department_admin_context_does_not_include_other_departments(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('ccsdean');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Here is your department summary.']])]);
        $this->postJson('/api/wise/messages', ['message' => 'Who needs support?'])->assertCreated();
        Http::assertSent(function ($request) {
            $this->assertStringNotContainsString('Lopez', $request['messages'][0]['content']);
            $this->assertStringContainsString('"faculty_count": 4', $request['messages'][0]['content']);
            return true;
        });
    }

    public function test_retry_reuses_saved_reply_and_rejects_reusing_an_id_for_a_different_message(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Let us plan one small step.']])]);
        $body = ['message' => 'I need help planning.', 'request_id' => 'repeatable-request'];
        $first = $this->postJson('/api/wise/messages', $body)->assertCreated()->json();
        $this->postJson('/api/wise/messages', $body)->assertCreated()->assertExactJson($first);
        $this->postJson('/api/wise/messages', ['message' => 'A different concern.', 'request_id' => 'repeatable-request'])->assertStatus(409);
        Http::assertSentCount(1);
        $this->getJson('/api/wise/messages')->assertJsonCount(2, 'messages');
    }

    public function test_pending_response_prevents_a_second_send_or_clear_and_releases_the_lock(): void
    {
        config(['services.ollama.enabled' => true]);
        $user = $this->actingAsUsername('aisha');
        $lock = Cache::lock('wise:conversation:'.$user->id, 180);
        $this->assertTrue($lock->get());
        $this->postJson('/api/wise/messages', ['message' => 'Can you help with my workload?'])->assertStatus(409);
        $this->deleteJson('/api/wise/messages')->assertStatus(409);
        $lock->release();
        Http::fake(['*/api/chat' => Http::response('down', 503)]);
        $this->postJson('/api/wise/messages', ['message' => 'Can you help with my workload?'])->assertCreated()->assertJsonPath('source', 'rules');
        $this->deleteJson('/api/wise/messages')->assertOk();
        $this->getJson('/api/wise/messages')->assertJsonCount(0, 'messages');
    }

    public function test_context_recovers_after_incomplete_old_turns_without_repeating_fallback_answers(): void
    {
        config(['services.ollama.enabled' => true]);
        $user = $this->actingAsUsername('aisha');
        ChatMessage::create(['user_id' => $user->id, 'role' => 'user', 'content' => 'Old incomplete turn']);
        ChatMessage::create(['user_id' => $user->id, 'role' => 'user', 'content' => 'I am worried about math.']);
        ChatMessage::create(['user_id' => $user->id, 'role' => 'assistant', 'content' => 'Canned answer that should not be repeated', 'source' => 'rules']);
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'What part of math is worrying you?']])]);
        $this->postJson('/api/wise/messages', ['message' => 'Can we talk about that?'])->assertCreated();
        Http::assertSent(function ($request) {
            $json = json_encode($request['messages']);
            $this->assertStringContainsString('worried about math', $json);
            $this->assertStringNotContainsString('Canned answer', $json);
            $this->assertStringNotContainsString('Old incomplete turn', $json);
            return true;
        });
    }

    public function test_long_multilingual_messages_preserve_current_question_and_reject_oversize_input(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        $message = str_repeat('学', 4999).'終';
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Let us talk about that.']])]);
        $this->postJson('/api/wise/messages', ['message' => $message])->assertCreated()->assertJsonPath('question.content', $message);
        Http::assertSent(function ($request) use ($message) {
            $messages = $request['messages'];
            $this->assertSame($message, $messages[array_key_last($messages)]['content']);
            $this->assertGreaterThan(8192, $request['options']['num_ctx']);
            return true;
        });
        $this->postJson('/api/wise/messages', ['message' => str_repeat('x', 5001)])->assertUnprocessable();
        $this->postJson('/api/wise/messages', ['message' => '   '])->assertUnprocessable();
        Http::assertSentCount(1);
    }

    public function test_malformed_model_response_falls_back_and_length_limit_is_disclosed(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake(['*/api/chat' => Http::sequence()
            ->push(['message' => ['content' => ['invalid']]])
            ->push(['done' => false, 'message' => ['content' => 'Partial network response']])
            ->push(['done' => true, 'done_reason' => 'length', 'message' => ['content' => 'Here is the first part.']])]);
        $this->postJson('/api/wise/messages', ['message' => 'Can you help with my workload?'])->assertCreated()->assertJsonPath('source', 'rules');
        $this->postJson('/api/wise/messages', ['message' => 'Hello again'])->assertCreated()->assertJsonPath('source', 'rules');
        $this->postJson('/api/wise/messages', ['message' => 'Explain more'])->assertCreated()->assertJsonPath('source', 'ollama')
            ->assertJsonPath('reply.content', fn ($reply) => str_contains($reply, 'Ask me to continue'));
    }

    public function test_prompt_limits_large_feedback_without_losing_verified_counts(): void
    {
        $user = $this->actingAsUsername('lsantos');
        $prompt = WisePrompt::system($user, ['comments' => array_fill(0, 30, str_repeat('Very long comment. ', 2000)), 'responses' => 500]);
        $this->assertLessThan(16000, strlen($prompt));
        $this->assertStringContainsString('"responses": 500', $prompt);
        $this->assertStringContainsString('Never claim a shortened list or comment is complete', $prompt);
    }

    public function test_filipino_mode_reaches_the_model_and_clear_removes_its_context(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Pag-usapan natin ang alalahanin mo.']])]);
        $this->withHeader('X-Lang', 'fil')->postJson('/api/wise/messages', ['message' => 'Kinakabahan ako sa essay.'])->assertCreated();
        Http::assertSent(fn ($request) => str_contains($request['messages'][0]['content'], 'Use natural Filipino'));
        $this->deleteJson('/api/wise/messages')->assertOk();
        $this->postJson('/api/wise/messages', ['message' => 'Bagong usapan.'])->assertCreated();
        $last = Http::recorded()->last()[0];
        $this->assertCount(2, $last['messages']);
        $this->assertStringNotContainsString('Kinakabahan ako sa essay.', json_encode($last['messages']));
    }

    public function test_outage_answers_respect_chat_privacy_custom_rating_labels_and_edit_intent(): void
    {
        config(['services.ollama.enabled' => false]);
        $this->actingAsUsername('aisha');
        $school = Tenant::school();
        $school->update(['settings' => array_replace($school->settings ?? [], ['scale' => ['Needs support', 'Developing', 'Satisfactory', 'Strong', 'Outstanding']])]);
        $this->postJson('/api/wise/messages', ['message' => 'Is this conversation anonymous?'])->assertCreated()
            ->assertJsonPath('reply.content', fn ($reply) => str_contains($reply, 'saved to your signed-in account'));
        $this->postJson('/api/wise/messages', ['message' => 'What does the rating scale mean?'])->assertCreated()
            ->assertJsonPath('reply.content', fn ($reply) => str_contains($reply, '5 Outstanding'));
        $this->postJson('/api/wise/messages', ['message' => 'How can I change my rating?'])->assertCreated()
            ->assertJsonPath('reply.content', fn ($reply) => str_contains($reply, 'cannot be edited'));
        $this->postJson('/api/wise/messages', ['message' => 'How do I evaluate my teachers?'])->assertCreated()
            ->assertJsonPath('reply.content', fn ($reply) => str_contains($reply, 'tap Evaluate'));
    }

    public function test_wise_diagnostic_detects_a_missing_model_and_can_warm_an_installed_model(): void
    {
        config(['services.ollama.enabled' => true, 'services.ollama.model' => 'gemma3:4b']);
        Http::fake([
            '*/api/tags' => Http::sequence()->push(['models' => []])->push(['models' => [['name' => 'gemma3:4b']]]),
            '*/api/generate' => Http::response(['done' => true]),
        ]);
        $this->artisan('wise:check')->expectsOutputToContain('model is missing')->assertFailed();
        $this->artisan('wise:check --warm')->expectsOutputToContain('Wise is ready')->assertSuccessful();
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/api/generate') && $request['prompt'] === '');
    }
}
