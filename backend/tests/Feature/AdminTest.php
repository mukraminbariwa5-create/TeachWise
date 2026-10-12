<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\Subject;
use App\Models\User;

class AdminTest extends ApiTestCase
{
    public function test_dashboard_summarises_the_college(): void
    {
        $this->actingAsUsername('admin');

        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.faculty', 5)
            ->assertJsonPath('stats.students', 10)
            ->assertJsonStructure([
                'completion' => ['percent', 'by_section' => [['label', 'percent']]],
                'faculty' => [['id', 'name', 'responses', 'average']],
                'periods',
            ]);
    }

    public function test_admins_correct_accounts_but_never_create_them(): void
    {
        $me = $this->actingAsUsername('admin');
        $aisha = User::where('username', 'aisha')->first();
        $liza = User::where('username', 'lsantos')->first();
        $other = Section::where('id', '!=', $aisha->studentProfile->section_id)->first();

        // People sign up or join with an invite; there is no "create account" for admins.
        $this->postJson('/api/admin/users', ['id_number' => '2026-0100', 'name' => 'Kim', 'username' => 'kim', 'role' => 'student', 'password' => 'secret123'])
            ->assertStatus(405);

        $this->putJson("/api/admin/users/{$aisha->id}", ['section_id' => $other->id, 'name' => 'Aisha M. Tan'])
            ->assertOk()->assertJsonPath('user.section.id', $other->id)->assertJsonPath('user.name', 'Aisha M. Tan');
        $this->putJson("/api/admin/users/{$aisha->id}", ['role' => 'admin'])->assertStatus(422);   // students stay students
        $this->putJson("/api/admin/users/{$me->id}", ['is_active' => false])->assertStatus(422);  // can't lock yourself out

        $temp = $this->postJson("/api/admin/users/{$aisha->id}/temporary-password")->assertOk()->json('temporary_password');
        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => $temp])->assertOk();

        // Teachers with classes or results are turned off, never deleted.
        $this->actingAsUsername('admin');
        $this->deleteJson("/api/admin/users/{$liza->id}")->assertStatus(422);
        $this->putJson("/api/admin/users/{$liza->id}", ['is_active' => false])->assertOk();
        $this->postJson('/api/auth/login', ['login' => 'lsantos', 'password' => 'password'])->assertStatus(422);
    }

    public function test_admin_can_assign_a_class_but_not_twice(): void
    {
        $this->actingAsUsername('admin');
        $payload = [
            'teacher_id' => User::where('username', 'lsantos')->value('id'),
            'subject_id' => Subject::where('code', 'IT 302')->value('id'),
            'section_id' => Section::first()->id,
        ];

        $this->postJson('/api/admin/offerings', $payload)->assertCreated();
        $this->postJson('/api/admin/offerings', $payload)->assertStatus(422);
    }

    public function test_only_one_semester_is_active(): void
    {
        $this->actingAsUsername('admin');

        $this->postJson('/api/admin/semesters', ['name' => '2nd Semester 2026-2027', 'is_active' => true])->assertCreated();

        $this->assertSame(1, \App\Models\Semester::where('is_active', true)->count());
    }

    public function test_reminders_go_to_students_with_pending_evaluations(): void
    {
        $this->actingAsUsername('admin');

        $sent = $this->postJson('/api/admin/reminders')->assertOk()->json('sent');
        $this->assertGreaterThan(0, $sent);

        $this->actingAsUsername('aisha');
        $this->getJson('/api/notifications')->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_faculty_report_and_csv(): void
    {
        $this->actingAsUsername('admin');
        $liza = User::where('username', 'lsantos')->first();

        $this->getJson("/api/admin/reports/faculty/{$liza->id}")
            ->assertOk()
            ->assertJsonStructure(['student_ratings' => ['overall', 'criteria'], 'peer_ratings', 'classes', 'comments']);

        $csv = $this->get('/api/admin/reports/faculty.csv')->assertOk()->streamedContent();
        $this->assertStringContainsString('Prof. Liza Santos', $csv);
    }
}
