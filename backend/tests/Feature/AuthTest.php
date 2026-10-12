<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\User;
use App\Models\WhitelistedId;

class AuthTest extends ApiTestCase
{
    public function test_user_can_log_in_with_username_or_id_number(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'initials', 'role', 'section']])
            ->assertJsonPath('user.role', 'student')
            ->assertJsonPath('user.section.label', 'BSIT 4-A');

        $this->postJson('/api/auth/login', ['login' => 'T-002', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Prof. Liza Santos');
    }

    public function test_wrong_password_is_rejected_and_logged(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'nope'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('login');

        $this->assertDatabaseHas('login_attempts', ['login' => 'aisha', 'reason' => 'invalid_credentials']);
    }

    public function test_deactivated_user_cannot_log_in(): void
    {
        User::where('username', 'aisha')->update(['is_active' => false]);

        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertStatus(422);
    }

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'bad']);
        }

        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertStatus(429);
    }

    public function test_token_works_and_logout_revokes_it(): void
    {
        $token = $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->json('token');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.username', 'aisha');
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_registration_requires_whitelisted_id(): void
    {
        $section = Section::first();
        $payload = [
            'school_id' => $this->demoId(),
            'id_number' => '2026-9999', 'name' => 'New Student', 'username' => 'newstudent',
            'section_id' => $section->id, 'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ];

        $this->postJson('/api/auth/register', $payload)->assertStatus(422)->assertJsonValidationErrors('id_number');

        WhitelistedId::create(['id_number' => '2026-9999']);
        $this->postJson('/api/auth/register', $payload)->assertCreated()->assertJsonPath('user.role', 'student');
    }

    public function test_check_id_explains_each_case(): void
    {
        $this->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '2023-0101'])->assertOk()->assertJsonPath('ok', true);
        $this->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '2023-0001'])->assertJsonPath('reason', 'taken');
        $this->postJson('/api/auth/check-id', ['school_id' => $this->demoId(), 'id_number' => '9999-9999'])->assertJsonPath('reason', 'not_listed');
    }

    public function test_guests_and_wrong_roles_are_blocked(): void
    {
        $this->getJson('/api/student/dashboard')->assertUnauthorized();

        $this->actingAsUsername('aisha');
        $this->getJson('/api/admin/dashboard')->assertForbidden();
        $this->getJson('/api/teacher/dashboard')->assertForbidden();
    }
}
