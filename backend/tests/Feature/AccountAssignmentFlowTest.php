<?php

namespace Tests\Feature;

use App\Models\ClassOffering;
use App\Models\EvaluationPeriod;
use App\Models\Invite;
use App\Models\Question;
use App\Models\Section;
use App\Models\Semester;
use App\Models\User;

class AccountAssignmentFlowTest extends ApiTestCase
{
    public function test_roster_signup_leads_to_only_the_assigned_sections_classes(): void
    {
        $wrongSection = Section::where('year_level', 1)->firstOrFail();
        $signup = $this->postJson('/api/auth/register', [
            'school_id' => $this->demoId(), 'id_number' => '2023-0101',
            'name' => 'Changed Identity', 'username' => 'rosterflow', 'section_id' => $wrongSection->id,
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.name', 'Nadia Hassan')->assertJsonPath('user.section.label', 'BSIT 4-A');

        $this->withToken($signup->json('token'));
        $dashboard = $this->getJson('/api/student/dashboard')->assertOk()->assertJsonCount(4, 'teachers');
        $offering = $dashboard->json('teachers.0.offering_id');
        $answers = Question::for('student')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        $this->postJson('/api/student/evaluations', ['class_offering_id' => $offering, 'answers' => $answers])->assertCreated();
        $this->getJson('/api/student/history')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/student/evaluations', ['class_offering_id' => $offering, 'answers' => $answers])->assertUnprocessable();
    }

    public function test_old_semester_and_inactive_teachers_cannot_be_evaluated_by_direct_url(): void
    {
        $student = $this->actingAsUsername('aisha');
        $current = ClassOffering::where('section_id', $student->studentProfile->section_id)->firstOrFail();
        $oldSemester = Semester::create(['name' => 'Past term', 'starts_on' => now()->subYear(), 'ends_on' => now()->subMonths(6), 'is_active' => false]);
        $old = $current->replicate();
        $old->semester_id = $oldSemester->id;
        $old->save();
        $answers = Question::for('student')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        $this->getJson("/api/student/offerings/{$old->id}/form")->assertForbidden();
        $this->postJson('/api/student/evaluations', ['class_offering_id' => $old->id, 'answers' => $answers])->assertForbidden();
        $current->teacher->update(['is_active' => false]);
        $this->getJson("/api/student/offerings/{$current->id}/form")->assertForbidden();
        $this->postJson('/api/student/evaluations', ['class_offering_id' => $current->id, 'answers' => $answers])->assertForbidden();
        $ids = collect($this->getJson('/api/student/dashboard')->assertOk()->json('teachers'))->pluck('offering_id');
        $this->assertNotContains($old->id, $ids);
        $this->assertNotContains($current->id, $ids);
    }

    public function test_a_dated_period_from_an_inactive_semester_does_not_open_current_evaluations(): void
    {
        $this->actingAsUsername('aisha');
        $oldSemester = Semester::create(['name' => 'Past term', 'starts_on' => now()->subYear(), 'ends_on' => now()->subMonths(6), 'is_active' => false]);
        EvaluationPeriod::query()->update(['opens_at' => now()->subDays(2), 'closes_at' => now()->subMinute()]);
        EvaluationPeriod::create(['semester_id' => $oldSemester->id, 'name' => 'Stale open period', 'type' => 'student', 'opens_at' => now()->subDay(), 'closes_at' => now()->addDay()]);
        $this->getJson('/api/student/dashboard')->assertOk()->assertJsonPath('period', null);
        $this->assertNull(EvaluationPeriod::openNow('student'));
    }

    public function test_staff_invitation_preserves_school_identity_and_department(): void
    {
        $admin = $this->actingAsUsername('ccsdean');
        $code = $this->postJson('/api/admin/invites', ['role' => 'teacher', 'people' => [[
            'name' => 'Professor Roster', 'id_number' => 'T-ROSTER', 'email' => 'roster@dsu.test',
        ]]])->assertCreated()->json('data.0.code');
        $this->app['auth']->forgetGuards();
        $response = $this->postJson('/api/auth/accept-invite', [
            'code' => $code, 'name' => 'Changed Identity', 'id_number' => 'T-CHANGED', 'email' => 'changed@dsu.test',
            'username' => 'staffflow', 'department_id' => null, 'role' => 'admin',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.name', 'Professor Roster')
            ->assertJsonPath('user.id_number', 'T-ROSTER')->assertJsonPath('user.email', 'roster@dsu.test')
            ->assertJsonPath('user.role', 'teacher')->assertJsonPath('user.department_id', $admin->department_id);
        $this->assertDatabaseHas('users', ['id' => $response->json('user.id'), 'school_id' => $admin->school_id]);
        $this->postJson('/api/auth/accept-invite', ['code' => $code])->assertUnprocessable();
        $this->assertNotNull(Invite::where('code', $code)->value('used_at'));
    }

    public function test_department_peers_do_not_need_a_shared_subject_and_cannot_cross_departments(): void
    {
        $teacher = $this->actingAsUsername('lsantos');
        $colleague = User::factory()->teacher()->create(['department_id' => $teacher->department_id]);
        $inactive = User::factory()->teacher()->create(['department_id' => $teacher->department_id, 'is_active' => false]);
        $outsider = User::where('username', 'mlopez')->firstOrFail();
        $foreign = User::withoutGlobalScopes()->where('username', 'jreyes')->firstOrFail();
        $ids = collect($this->getJson('/api/teacher/dashboard')->assertOk()->json('peers'))->pluck('teacher.id');
        $this->assertContains($colleague->id, $ids);
        foreach ([$teacher->id, $inactive->id, $outsider->id, $foreign->id] as $id) {
            $this->assertNotContains($id, $ids);
        }
        $this->getJson("/api/teacher/peers/{$colleague->id}/form")->assertOk();
        $this->getJson("/api/teacher/peers/{$foreign->id}/form")->assertNotFound();
        $answers = Question::for('peer')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        foreach ([$teacher->id, $inactive->id, $outsider->id] as $id) {
            $this->getJson("/api/teacher/peers/{$id}/form")->assertForbidden();
            $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $id, 'answers' => $answers])->assertForbidden();
        }
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $colleague->id, 'answers' => $answers])->assertCreated();
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $colleague->id, 'answers' => $answers])->assertUnprocessable();
    }

    public function test_unassigned_teacher_cannot_evaluate_any_colleague(): void
    {
        $teacher = $this->actingAsUsername('lsantos');
        $teacher->update(['department_id' => null]);
        $colleague = User::where('username', 'mlopez')->firstOrFail();
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonPath('peers', []);
        $this->getJson("/api/teacher/peers/{$colleague->id}/form")->assertForbidden();
        $answers = Question::for('peer')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $colleague->id, 'answers' => $answers])->assertForbidden();
        $foreign = User::withoutGlobalScopes()->where('username', 'jreyes')->firstOrFail();
        $this->getJson("/api/teacher/peers/{$foreign->id}/form")->assertNotFound();
    }
}
