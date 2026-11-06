<?php

namespace Tests\Live;

use App\Support\Tenant;
use Tests\Feature\ApiTestCase;

/** Run explicitly with PHPUnit tests/Live/WiseLiveTest.php; uses Ollama and an in-memory DB. */
class WiseLiveTest extends ApiTestCase
{
    public function test_student_guidance_follow_up_and_retry_against_real_ollama(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        $body = ['message' => 'I feel overwhelmed. My math homework is due at 9 AM tomorrow and history essay at 5 PM. Help me choose one first step.', 'request_id' => 'live-student-concern'];
        $first = $this->postJson('/api/wise/messages', $body)->assertCreated()->assertJsonPath('source', 'ollama');
        echo "\nSTUDENT: ".$first->json('reply.content')."\n";
        $this->postJson('/api/wise/messages', $body)->assertCreated()->assertExactJson($first->json());
        $follow = $this->postJson('/api/wise/messages', ['message' => 'Why that assignment first?', 'request_id' => 'live-student-followup'])
            ->assertCreated()->assertJsonPath('source', 'ollama');
        echo "\nFOLLOW-UP: ".$follow->json('reply.content')."\n";
        $this->getJson('/api/wise/messages')->assertJsonCount(4, 'messages');
    }

    public function test_teacher_can_get_guidance_without_visible_feedback(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('lsantos');
        $school = Tenant::school();
        $school->update(['settings' => array_replace($school->settings ?? [], ['min_responses' => 10000])]);
        $reply = $this->postJson('/api/wise/messages', ['message' => 'My class is quiet and I feel discouraged. How can I encourage questions?'])
            ->assertCreated()->assertJsonPath('source', 'ollama');
        echo "\nTEACHER: ".$reply->json('reply.content')."\n";
    }

    public function test_filipino_academic_feedback_is_distinct_from_faculty_evaluation(): void
    {
        config(['services.ollama.enabled' => true]);
        $this->actingAsUsername('aisha');
        $reply = $this->withHeader('X-Lang', 'fil')->postJson('/api/wise/messages', ['message' => 'Kinakabahan ako sa feedback ng teacher ko tungkol sa essay na isinulat ko. Paano ko ito haharapin?'])
            ->assertCreated()->assertJsonPath('source', 'ollama');
        echo "\nFILIPINO: ".$reply->json('reply.content')."\n";
    }
}
