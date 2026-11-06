<?php

namespace Tests\Feature;

class SchoolAdminIdentityTest extends ApiTestCase
{
    public function test_school_admin_can_use_a_school_or_managing_office_name_without_a_department_identity(): void
    {
        $admin = $this->actingAsUsername('admin');
        $admin->update(['name' => 'CCS Admin', 'department' => "Dean's Office"]);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.admin_scope', 'school')->assertJsonPath('user.department', null);
        $this->putJson('/api/me/profile', ['name' => 'ICTC Database Management Office'])->assertOk()
            ->assertJsonPath('user.name', 'ICTC Database Management Office')
            ->assertJsonPath('user.department', null)->assertJsonPath('user.department_id', null)->assertJsonPath('user.admin_scope', 'school');
        $this->assertNull($admin->fresh()->department);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('school.name', 'Demo State University');
        $this->putJson('/api/me/profile', ['name' => ''])->assertUnprocessable();
    }

    public function test_department_and_participant_identities_remain_school_controlled(): void
    {
        foreach (['ccsdean', 'lsantos', 'aisha'] as $username) {
            $user = $this->actingAsUsername($username);
            $original = $user->name;
            $this->putJson('/api/me/profile', ['name' => 'School-wide office'])->assertUnprocessable();
            $this->assertSame($original, $user->fresh()->name);
        }
        $this->actingAsUsername('ccsdean');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.admin_scope', 'department')
            ->assertJsonPath('user.department', 'College of Computer Studies');
    }
}
