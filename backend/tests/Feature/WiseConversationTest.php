<?php

namespace Tests\Feature;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class WiseConversationTest extends ApiTestCase
{
    public function test_simple_greetings_are_fast_without_model_or_evaluation_queries(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake();
        DB::flushQueryLog();
        DB::enableQueryLog();
        foreach (['Hello!', 'Hi', 'Good morning', 'Thanks', 'Hello 👋'] as $message) {
            $this->postJson('/api/wise/messages', ['message' => $message])->assertCreated()
                ->assertJsonPath('source', 'quick')
                ->assertJsonPath('reply.content', fn ($reply) => strlen($reply) > 10 && ! str_contains($reply, 'unavailable'));
        }
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' ');
        DB::disableQueryLog();
        $this->assertStringNotContainsString('from "evaluations"', $queries);
        Http::assertNothingSent();
    }

    public function test_new_topics_and_reopened_topics_have_separate_model_context(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Let us plan a small next step.']])]);
        $math = $this->postJson('/api/wise/conversations')->assertCreated()->json('conversation.id');
        $this->postJson('/api/wise/messages', ['conversation_id' => $math, 'message' => 'Help with my algebra homework.'])->assertCreated();
        $essay = $this->postJson('/api/wise/conversations')->assertCreated()->json('conversation.id');
        $this->postJson('/api/wise/messages', ['conversation_id' => $essay, 'message' => 'Help me outline my history essay.'])->assertCreated();
        $second = Http::recorded()->last()[0];
        $this->assertStringNotContainsString('algebra homework', json_encode($second['messages']));
        $this->assertCount(2, $second['messages']);
        $this->postJson('/api/wise/messages', ['conversation_id' => $math, 'message' => 'Can you expand on that step?'])->assertCreated();
        $third = Http::recorded()->last()[0];
        $this->assertStringContainsString('algebra homework', json_encode($third['messages']));
        $this->assertStringNotContainsString('history essay', json_encode($third['messages']));
        $this->getJson('/api/wise/messages?conversation_id='.$math)->assertOk()->assertJsonCount(4, 'messages');
        $this->getJson('/api/wise/messages?conversation_id='.$essay)->assertOk()->assertJsonCount(2, 'messages');
    }

    public function test_other_users_cannot_view_send_into_or_delete_a_conversation(): void
    {
        $this->actingAsUsername('aisha');
        $id = $this->postJson('/api/wise/conversations')->assertCreated()->json('conversation.id');
        $this->actingAsUsername('lsantos');
        $this->getJson('/api/wise/conversations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/wise/messages?conversation_id='.$id)->assertNotFound();
        $this->postJson('/api/wise/messages', ['conversation_id' => $id, 'message' => 'Hello'])->assertNotFound();
        $this->deleteJson('/api/wise/conversations/'.$id)->assertNotFound();
    }

    public function test_retry_cannot_cross_topics_and_delete_preserves_the_other_topic(): void
    {
        $this->actingAsUsername('aisha');
        $first = $this->postJson('/api/wise/conversations')->json('conversation.id');
        $body = ['conversation_id' => $first, 'message' => 'Hello', 'request_id' => 'same-turn'];
        $saved = $this->postJson('/api/wise/messages', $body)->assertCreated()->json();
        $second = $this->postJson('/api/wise/conversations')->json('conversation.id');
        $this->postJson('/api/wise/messages', ['conversation_id' => $second, 'message' => 'Hi'])->assertCreated();
        $this->postJson('/api/wise/messages', array_replace($body, ['conversation_id' => $second]))->assertStatus(409);
        $this->postJson('/api/wise/messages', $body)->assertCreated()->assertExactJson($saved);
        $this->deleteJson('/api/wise/conversations/'.$first)->assertOk();
        $this->getJson('/api/wise/messages?conversation_id='.$first)->assertNotFound();
        $this->getJson('/api/wise/messages?conversation_id='.$second)->assertOk()->assertJsonCount(2, 'messages');
        $this->assertSame(0, ChatMessage::where('conversation_id', $first)->count());
        $this->getJson('/api/wise/conversations')->assertJsonCount(1, 'data');
    }

    public function test_history_and_earlier_messages_are_paginated_without_losing_turns(): void
    {
        $user = $this->actingAsUsername('aisha');
        $conversation = ChatConversation::create(['user_id' => $user->id, 'title' => 'Long topic']);
        foreach (range(1, 60) as $number) {
            ChatMessage::create(['user_id' => $user->id, 'conversation_id' => $conversation->id, 'role' => $number % 2 ? 'user' : 'assistant', 'content' => 'Message '.$number]);
        }
        $recent = $this->getJson('/api/wise/messages?conversation_id='.$conversation->id)->assertOk()
            ->assertJsonCount(50, 'messages')->assertJsonPath('has_more_messages', true);
        $oldest = $recent->json('messages.0.id');
        $this->getJson('/api/wise/messages?conversation_id='.$conversation->id.'&before_id='.$oldest)
            ->assertOk()->assertJsonCount(10, 'messages')->assertJsonPath('has_more_messages', false)->assertJsonPath('messages.0.content', 'Message 1');
        foreach (range(1, 22) as $number) ChatConversation::create(['user_id' => $user->id, 'title' => 'Topic '.$number]);
        $this->getJson('/api/wise/conversations')->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('total', 23);
        $this->getJson('/api/wise/conversations?page=2')->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_a_greeting_does_not_become_the_permanent_topic_title(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        $greeting = $this->postJson('/api/wise/messages', ['message' => 'Hello'])->assertCreated()->assertJsonPath('source', 'quick');
        $id = $greeting->json('conversation.id');
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Let us find a study strategy.']])]);
        $this->postJson('/api/wise/messages', ['conversation_id' => $id, 'message' => 'Help me prepare for my chemistry exam.'])
            ->assertCreated()->assertJsonPath('source', 'ollama')->assertJsonPath('conversation.title', 'Help me prepare for my chemistry exam.');
    }
}
