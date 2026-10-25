<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\User;

/** Public demo mode: shared demo accounts can't be locked or broken by visitors. */
class PublicDemoTest extends ApiTestCase
{
    private function demoOn(): void
    {
        config(['teachwise.public_demo' => true]);
    }

    public function test_off_by_default_so_password_changes_work(): void
    {
        $this->actingAsUsername('aisha');

        $this->putJson('/api/auth/password', [])->assertStatus(422);   // validation runs: not blocked
    }

    public function test_demo_password_and_account_stay_as_they_are(): void
    {
        $this->demoOn();
        $this->actingAsUsername('aisha');

        $this->putJson('/api/auth/password', ['current_password' => 'password', 'password' => 'Hijacked-99', 'password_confirmation' => 'Hijacked-99'])
            ->assertForbidden()
            ->assertJsonPath('demo', true);
        $this->putJson('/api/me/profile', ['name' => 'Someone Else'])->assertForbidden();
        $this->postJson('/api/me/delete', ['password' => 'password'])->assertForbidden();

        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertOk();
        $this->assertSame('Aisha', explode(' ', User::where('username', 'aisha')->value('name'))[0]);
    }

    public function test_admin_cannot_lock_out_people_or_change_the_school(): void
    {
        $this->demoOn();
        $this->actingAsUsername('admin');
        $teacher = User::where('username', 'lsantos')->firstOrFail();

        $this->postJson("/api/admin/users/{$teacher->id}/temporary-password")->assertForbidden();
        $this->putJson("/api/admin/users/{$teacher->id}", ['is_active' => false])->assertForbidden();
        $this->deleteJson("/api/admin/users/{$teacher->id}")->assertForbidden();
        $this->putJson('/api/admin/school', ['code' => 'GONE'])->assertForbidden();

        $this->assertTrue((bool) User::where('username', 'lsantos')->value('is_active'));
        $this->assertSame('DEMO', School::whereKey($this->demoId())->value('code'));
    }

    public function test_owner_cannot_pause_or_remove_schools(): void
    {
        $this->demoOn();
        $this->actingAsUsername('owner');

        $this->postJson("/api/platform/schools/{$this->demoId()}/suspend")->assertForbidden();
        $this->deleteJson("/api/platform/schools/{$this->demoId()}")->assertForbidden();
        $this->assertNotNull(School::find($this->demoId()));
    }

    public function test_everything_else_still_works(): void
    {
        $this->demoOn();

        $this->postJson('/api/auth/login', ['login' => 'admin', 'password' => 'password'])->assertOk();
        $this->actingAsUsername('admin');
        $this->getJson('/api/admin/dashboard')->assertOk();
        $this->actingAsUsername('aisha');
        $this->getJson('/api/student/dashboard')->assertOk();
    }
}
