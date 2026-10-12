<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\PasswordResetRequest;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SignupAndRecoveryTest extends ApiTestCase
{
    public function test_check_id_returns_details_from_the_college_list(): void
    {
        $this->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '2023-0101'])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('name', 'Nadia Hassan')
            ->assertJsonPath('section.label', 'BSIT 4-A');

        $this->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '2026-0101'])
            ->assertJsonPath('ok', true)
            ->assertJsonPath('name', null)
            ->assertJsonPath('section', null);
    }

    public function test_registration_uses_listed_name_and_section_and_needs_privacy_consent(): void
    {
        $other = Section::where('year_level', 1)->first();
        $payload = [
            'school_id' => $this->demoId(),
            'id_number' => '2023-0101', 'name' => 'Someone Else', 'username' => 'nadia',
            'section_id' => $other->id, 'password' => 'secret123', 'password_confirmation' => 'secret123',
        ];

        $this->postJson('/api/auth/register', $payload)->assertStatus(422)->assertJsonValidationErrors('accepted_privacy');

        $this->postJson('/api/auth/register', $payload + ['accepted_privacy' => true])
            ->assertCreated()
            ->assertJsonPath('user.name', 'Nadia Hassan')
            ->assertJsonPath('user.section.label', 'BSIT 4-A');

        $this->assertNotNull(User::where('username', 'nadia')->value('privacy_accepted_at'));
    }

    public function test_username_check_suggests_free_names(): void
    {
        $this->postJson('/api/auth/check-username', ['username' => 'brandnew'])->assertJsonPath('ok', true);
        $this->postJson('/api/auth/check-username', ['username' => 'a!'])->assertJsonPath('reason', 'invalid');

        $res = $this->postJson('/api/auth/check-username', ['username' => 'Aisha', 'id_number' => '2023-0101', 'name' => 'Nadia Hassan'])
            ->assertJsonPath('ok', false)
            ->assertJsonPath('reason', 'taken');

        $suggestions = $res->json('suggestions');
        $this->assertNotEmpty($suggestions);
        $this->assertContains('aisha23', $suggestions);
        foreach ($suggestions as $s) {
            $this->assertFalse(User::where('username', $s)->exists());
        }
    }

    public function test_wrong_passwords_count_down_then_lock(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad'])->assertStatus(422)->assertJsonPath('attempts_left', 4);
        $this->postJson('/api/auth/login', ['login' => 'AISHA', 'password' => 'bad'])->assertJsonPath('attempts_left', 3);
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad'])->assertJsonPath('attempts_left', 2);
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad'])->assertJsonPath('attempts_left', 1);

        $locked = $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad'])->assertStatus(429)->assertJsonPath('locked', true);
        $this->assertGreaterThan(500, $locked->json('retry_after'));

        // Even the right password waits until the lock ends.
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertStatus(429);

        $this->travel(11)->minutes();
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertOk();
    }

    public function test_a_successful_sign_in_resets_the_count(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad']);
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad']);
        $this->travel(2)->seconds();
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertOk();
        $this->travel(2)->seconds();
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad'])->assertJsonPath('attempts_left', 4);
    }

    public function test_stay_signed_in_controls_how_long_the_token_lasts(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password', 'remember' => false])->assertOk();
        $short = User::where('username', 'aisha')->first()->tokens()->latest('id')->first();
        $this->assertTrue($short->expires_at->between(now()->addHours(11), now()->addHours(13)));

        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password', 'remember' => true])->assertOk();
        $long = User::where('username', 'aisha')->first()->tokens()->latest('id')->first();
        $this->assertTrue($long->expires_at->greaterThan(now()->addDays(29)));
    }

    public function test_forgot_password_request_reaches_the_admin_who_resets_it(): void
    {
        $generic = $this->postJson('/api/auth/password-requests', ['login' => 'nobody-here'])->assertOk()->json('message');
        $this->postJson('/api/auth/password-requests', ['login' => '2023-0001', 'note' => 'Forgot it'])->assertOk()->assertJsonPath('message', $generic);
        $this->postJson('/api/auth/password-requests', ['login' => 'aisha'])->assertOk();

        $this->assertSame(1, PasswordResetRequest::count());
        $admin = User::where('role', 'admin')->first();
        $this->assertTrue(AppNotification::where('user_id', $admin->id)->where('title', 'Password reset request')->exists());

        $this->actingAsUsername($admin->username);
        $request = PasswordResetRequest::first();
        $this->getJson('/api/admin/password-requests')->assertOk()->assertJsonPath('pending', 1)->assertJsonPath('data.0.user.username', 'aisha');

        $temporary = $this->postJson("/api/admin/password-requests/{$request->id}/resolve")->assertOk()->json('temporary_password');
        $this->assertTrue(Hash::check($temporary, User::where('username', 'aisha')->value('password')));
        $this->postJson("/api/admin/password-requests/{$request->id}/resolve")->assertStatus(422);
    }

    public function test_filipino_is_used_when_the_app_asks_for_it(): void
    {
        $this->withHeaders(['X-Lang' => 'fil'])
            ->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '9999-9999'])
            ->assertJsonPath('message', 'Wala pa sa listahan ng Demo State University ang ID na ito. I-check ang paaralan, o pakisabi sa admin na idagdag ito.');

        $this->actingAsUsername('aisha');
        $this->withHeaders(['X-Lang' => 'fil'])->getJson('/api/wise/messages')->assertJsonPath('suggestions.0', 'Paano mag-evaluate?');
        $this->withHeaders(['X-Lang' => 'fil'])->postJson('/api/wise/messages', ['message' => 'Anonymous ba ito? Makikita ba ang pangalan ko?'])
            ->assertCreated()
            ->assertSee('Oo, anonymous');
    }
}
