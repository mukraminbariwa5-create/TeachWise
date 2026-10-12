<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\AuditLog;
use App\Models\ClientError;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\PushToken;
use App\Models\SupportMessage;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Http;

class PublishReadyTest extends ApiTestCase
{
    private function signIn(string $username, array $extra = []): string
    {
        return $this->postJson('/api/auth/login', ['login' => $username, 'password' => 'password'] + $extra)->assertOk()->json('token');
    }

    public function test_settings_have_defaults_and_save_partially(): void
    {
        $this->actingAsUsername('aisha');
        $this->getJson('/api/me/settings')->assertOk()->assertJsonPath('settings.tips', true)->assertJsonPath('settings.notify.reminders', true);

        $this->putJson('/api/me/settings', ['notify' => ['reminders' => false]])
            ->assertOk()
            ->assertJsonPath('settings.notify.reminders', false)
            ->assertJsonPath('settings.notify.periods', true);

        $this->postJson('/api/me/tips/dashboard/seen')->assertOk();
        $this->postJson('/api/me/tips/dashboard/seen')->assertJsonPath('seen_tips', ['dashboard']);
        $this->getJson('/api/auth/me')->assertJsonPath('settings.seen_tips', ['dashboard']);
    }

    public function test_profile_contact_details(): void
    {
        $this->actingAsUsername('aisha');
        $this->putJson('/api/me/profile', ['email' => 'aisha@school.edu', 'phone_number' => '0917 123 4567'])
            ->assertOk()->assertJsonPath('user.email', 'aisha@school.edu');
        $this->putJson('/api/me/profile', ['email' => 'not-an-email'])->assertStatus(422);
    }

    public function test_sessions_can_be_listed_renewed_and_signed_out(): void
    {
        $phone = $this->signIn('aisha', ['device_name' => 'Android phone']);
        $laptop = $this->signIn('aisha', ['device_name' => 'Chrome on Windows', 'remember' => false]);

        $this->withToken($laptop)->getJson('/api/me/sessions')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['device' => 'Android phone', 'current' => false])
            ->assertJsonFragment(['device' => 'Chrome on Windows', 'current' => true]);

        // Renewal keeps the short-session choice and retires the old token.
        $renewed = $this->withToken($laptop)->postJson('/api/auth/refresh')->assertOk()->json();
        $this->assertTrue(now()->addHours(13)->greaterThan($renewed['expires_at']));
        $this->app['auth']->forgetGuards();
        $this->withToken($laptop)->getJson('/api/auth/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($renewed['token'])->deleteJson('/api/me/sessions/others')->assertOk()->assertJsonPath('count', 1);
        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_changing_password_signs_out_other_devices(): void
    {
        $other = $this->signIn('aisha', ['device_name' => 'Old phone']);
        $current = $this->signIn('aisha');
        $this->withToken($current)->putJson('/api/auth/password', ['current_password' => 'password', 'password' => 'newpass123', 'password_confirmation' => 'newpass123'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/auth/me')->assertUnauthorized();
        $this->assertTrue(AuditLog::where('action', 'password.changed')->exists());
    }

    public function test_push_tokens_and_notifications_respect_settings(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => [['status' => 'ok']]])]);
        $aisha = $this->actingAsUsername('aisha');
        $this->postJson('/api/me/push-tokens', ['token' => 'not-a-token'])->assertStatus(422);
        $this->postJson('/api/me/push-tokens', ['token' => 'ExponentPushToken[abc123]', 'platform' => 'android'])->assertCreated();
        $this->assertSame(1, PushToken::where('user_id', $aisha->id)->count());

        \App\Support\Notifier::send($aisha, 'reminders', 'Hello', 'World');
        $this->assertTrue(AppNotification::where('user_id', $aisha->id)->where('title', 'Hello')->exists());
        $this->assertFalse(! $aisha->wantsNotification('reminders'));
    }

    public function test_data_export_contains_the_persons_own_data(): void
    {
        $this->actingAsUsername('aisha');
        $this->getJson('/api/me/export')
            ->assertOk()
            ->assertJsonPath('account.username', 'aisha')
            ->assertJsonStructure(['exported_at', 'account', 'settings', 'evaluations_submitted', 'notifications', 'professor_wise_chat']);
    }

    public function test_students_can_delete_their_account_and_evaluations_stay_anonymous(): void
    {
        $aisha = $this->actingAsUsername('aisha');
        $evaluations = Evaluation::where('evaluator_id', $aisha->id)->count();
        $this->assertGreaterThan(0, $evaluations);

        $this->postJson('/api/me/delete', ['password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertOk();

        $this->assertNull(User::find($aisha->id));
        $this->assertSame(0, Evaluation::where('evaluator_id', $aisha->id)->count());
        $this->assertGreaterThanOrEqual($evaluations, Evaluation::whereNull('evaluator_id')->count());
        $this->assertTrue(AuditLog::where('action', 'account.deleted')->exists());
    }

    public function test_teachers_request_deletion_through_the_admin(): void
    {
        $teacher = $this->actingAsUsername('lsantos');
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertStatus(202)->assertJsonPath('requested', true);
        $this->assertNotNull(User::find($teacher->id));
        $this->assertTrue(SupportMessage::where('user_id', $teacher->id)->exists());
    }

    public function test_help_messages_reach_the_admin_inbox(): void
    {
        $this->actingAsUsername('aisha');
        $this->withHeaders(['X-App-Version' => '1.0.0', 'X-Platform' => 'web'])
            ->postJson('/api/support', ['kind' => 'problem', 'message' => 'The page froze on submit.', 'screen' => '/student/evaluate/1'])
            ->assertCreated();

        $this->actingAsUsername('admin');
        $this->getJson('/api/admin/inbox')->assertOk()->assertJsonPath('open_count', 1)->assertJsonPath('data.0.meta.app_version', '1.0.0');
        $id = SupportMessage::first()->id;
        $this->postJson("/api/admin/inbox/{$id}/close")->assertOk();
        $this->getJson('/api/admin/inbox')->assertJsonPath('open_count', 0);
    }

    public function test_app_info_error_reports_and_security_headers(): void
    {
        $this->getJson('/api/app/info')
            ->assertOk()
            ->assertJsonStructure(['school_name', 'min_version', 'latest_version', 'store_url'])
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');

        $this->actingAsUsername('aisha');
        $this->postJson('/api/app/errors', ['message' => 'TypeError: x is undefined', 'screen' => '/student', 'platform' => 'web', 'app_version' => '1.0.0'])->assertCreated();
        $this->assertSame(1, ClientError::count());

        $this->actingAsUsername('admin');
        $this->getJson('/api/admin/app-errors')->assertOk()->assertJsonPath('data.0.screen', '/student');
    }

    public function test_admin_actions_are_logged(): void
    {
        $this->actingAsUsername('admin');
        $this->postJson('/api/admin/periods', ['name' => 'Finals', 'type' => 'student', 'opens_at' => now()->addWeek()->toDateTimeString(), 'closes_at' => now()->addWeeks(2)->toDateTimeString()])->assertCreated();
        $this->getJson('/api/admin/activity')->assertOk()->assertJsonPath('data.0.action', 'period.created');
        $this->getJson('/api/admin/activity?action=period')->assertJsonCount(1, 'data');
    }

    public function test_hourly_notifications_announce_and_remind_once(): void
    {
        $period = EvaluationPeriod::where('type', 'student')->first();
        $period->update(['opens_at' => now()->subHour(), 'closes_at' => now()->addHours(20), 'announced_at' => null, 'reminded_at' => null]);

        $this->artisan('teachwise:notify')->assertSuccessful();
        $aisha = User::where('username', 'aisha')->first();
        $this->assertTrue(AppNotification::where('user_id', $aisha->id)->where('title', 'like', '%is open')->exists());
        $this->assertTrue(AppNotification::where('user_id', $aisha->id)->where('title', 'like', '%closes in 24 hours')->exists());

        $before = AppNotification::count();
        $this->artisan('teachwise:notify')->assertSuccessful();
        $this->assertSame($before, AppNotification::count());
    }

    public function test_questions_come_in_filipino_when_asked(): void
    {
        $this->actingAsUsername('aisha');
        $offering = \App\Models\ClassOffering::whereHas('section', fn ($q) => $q->where('name', 'A')->where('year_level', 4))->first();
        $this->withHeaders(['X-Lang' => 'fil'])->getJson("/api/student/offerings/{$offering->id}/form")
            ->assertOk()
            ->assertJsonPath('questions.0.category', 'Kahusayan sa asignatura');
        $this->withHeaders(['X-Lang' => 'en'])->getJson("/api/student/offerings/{$offering->id}/form")->assertJsonPath('questions.0.category', 'Mastery of subject');
    }

    public function test_teacher_gets_trend_and_full_report(): void
    {
        $this->actingAsUsername('lsantos');
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonStructure(['trend', 'peer_overall']);
        $this->getJson('/api/teacher/report')->assertOk()->assertJsonStructure(['teacher', 'student_ratings', 'peer_ratings', 'classes', 'trend', 'comments']);
    }

    public function test_commands_create_admin_and_refuse_duplicate_demo(): void
    {
        $this->artisan('teachwise:create-admin', ['--school' => 'DEMO', '--name' => 'Dean Rivera', '--username' => 'dean', '--id' => 'ADMIN-009', '--password' => 'strongpass1', '--no-interaction' => true])->assertSuccessful();
        $this->assertTrue(User::where('username', 'dean')->where('role', 'admin')->exists());
        $this->artisan('teachwise:create-admin', ['--school' => 'DEMO', '--name' => 'X', '--username' => 'dean', '--id' => 'ADMIN-010', '--password' => 'strongpass1', '--no-interaction' => true])->assertFailed();

        $this->artisan('teachwise:demo')->expectsOutputToContain('already loaded')->assertSuccessful();
    }

    public function test_admin_lists_support_the_new_screens(): void
    {
        $this->actingAsUsername('admin');

        $ids = $this->getJson('/api/admin/whitelist')->assertOk()->json('data');
        $this->assertArrayHasKey('registered', $ids[0]);

        $this->getJson('/api/admin/users?role=teacher&per_page=500')->assertOk()->assertJsonPath('per_page', 500);

        $teacher = \App\Models\User::where('username', 'lsantos')->first();
        $this->getJson("/api/admin/reports/faculty/{$teacher->id}")->assertOk()->assertJsonStructure(['teacher', 'student_ratings' => ['overall', 'criteria'], 'trend', 'comments']);
        $this->get('/api/admin/reports/faculty.csv')->assertOk();
    }

    public function test_teacher_report_and_feedback(): void
    {
        $this->actingAsUsername('lsantos');
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonStructure(['overall', 'criteria', 'peer_overall', 'trend', 'recent_feedback', 'subjects', 'peers']);
        $this->getJson('/api/teacher/report')->assertOk()->assertJsonStructure(['student_ratings', 'peer_ratings', 'classes', 'trend']);
        $this->getJson('/api/teacher/feedback')->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page', 'total']);
        $this->withHeaders(['X-Lang' => 'fil'])->getJson('/api/teacher/dashboard')->assertOk();
    }
}
