<?php

namespace Tests\Feature;

use App\Models\ClassOffering;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\Section;
use App\Models\Semester;
use App\Models\SupportMessage;
use App\Models\Subject;
use App\Models\User;

/** Rules that keep the app consistent: records with history are kept, forms don't change mid-period, messages reach someone who can act. */
class ConsistencyRulesTest extends ApiTestCase
{
    public function test_school_data_with_history_cannot_be_deleted(): void
    {
        $this->actingAsUsername('admin');
        $aishaSection = User::where('username', 'aisha')->first()->studentProfile->section_id;
        $evaluated = ClassOffering::whereHas('evaluations')->first();
        $midterm = EvaluationPeriod::where('name', 'Midterm')->first();

        $this->deleteJson("/api/admin/sections/{$aishaSection}")->assertStatus(422);
        $this->deleteJson('/api/admin/subjects/'.Subject::where('code', 'IT 301')->value('id'))->assertStatus(422);
        $this->deleteJson('/api/admin/semesters/'.Semester::where('is_active', true)->value('id'))->assertStatus(422);
        $this->deleteJson("/api/admin/periods/{$midterm->id}")->assertStatus(422);
        $this->deleteJson("/api/admin/offerings/{$evaluated->id}")->assertStatus(422);

        // An empty section made by mistake can go.
        $empty = Section::create(['course' => 'BSIT', 'year_level' => 5, 'name' => 'Z']);
        $this->deleteJson("/api/admin/sections/{$empty->id}")->assertOk();
    }

    public function test_the_form_is_locked_while_its_period_is_open(): void
    {
        $this->actingAsUsername('admin');
        $q = Question::for('student')->first();

        $this->putJson("/api/admin/questions/{$q->id}", ['text' => 'Something else entirely?'])->assertStatus(422);
        $this->postJson('/api/admin/questions', ['audience' => 'student', 'text' => 'New question?', 'type' => 'rating'])->assertStatus(422);
        $this->putJson("/api/admin/questions/{$q->id}", ['text_fil' => 'Bagong salin ng tanong?'])->assertOk();   // translations are fine

        EvaluationPeriod::where('type', 'student')->update(['closes_at' => now()->subMinute()]);
        $this->postJson('/api/admin/questions', ['audience' => 'student', 'text' => 'New question?', 'type' => 'rating'])->assertCreated();
    }

    public function test_admin_messages_go_to_teachwise_and_student_messages_to_the_school(): void
    {
        $this->actingAsUsername('aisha');
        $this->postJson('/api/support', ['kind' => 'contact', 'message' => 'My class is missing.'])->assertCreated();
        $this->actingAsUsername('admin');
        $this->postJson('/api/support', ['kind' => 'problem', 'message' => 'Import keeps failing.'])->assertCreated()
            ->assertJsonPath('message', 'Thanks! Your message was sent to TeachWise support.');

        $this->getJson('/api/admin/inbox')->assertOk()->assertJsonPath('open_count', 1)->assertJsonPath('data.0.message', 'My class is missing.');
        $this->actingAsUsername('owner');
        $this->getJson('/api/platform/messages')->assertOk()->assertJsonPath('open_count', 1)->assertJsonPath('data.0.school.code', 'DEMO');
        $this->postJson('/api/platform/messages/'.SupportMessage::withoutGlobalScopes()->where('message', 'Import keeps failing.')->value('id').'/close')->assertOk();
    }

    public function test_deletion_requests_reach_someone_who_can_act(): void
    {
        $this->actingAsUsername('owner');
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertStatus(422);

        // The school's only school admin: the request goes to TeachWise.
        $this->actingAsUsername('admin');
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertStatus(202);
        $this->actingAsUsername('owner');
        $this->getJson('/api/platform/messages')->assertJsonPath('data.0.meta.type', 'account_deletion');

        // A teacher's request goes to the school admin (not to department admins, who can't open the inbox).
        $dean = User::where('username', 'ccsdean')->first();
        $this->actingAsUsername('lsantos');
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertStatus(202);
        $this->assertSame(0, $dean->appNotifications()->where('title', 'Account deletion request')->count());
        $this->assertSame(1, User::where('username', 'admin')->first()->appNotifications()->where('title', 'Account deletion request')->count());
    }
}
