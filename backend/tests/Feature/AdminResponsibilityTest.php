<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Program;
use App\Models\Question;
use App\Models\Section;
use App\Models\Semester;
use App\Models\User;

class AdminResponsibilityTest extends ApiTestCase
{
    public function test_school_admin_manages_framework_and_admins_but_cannot_manage_department_people_or_classes(): void
    {
        $this->actingAsUsername('admin');
        foreach (['whitelist', 'subjects', 'sections', 'offerings'] as $resource) {
            $this->getJson('/api/admin/'.$resource)->assertForbidden();
            $this->postJson('/api/admin/'.$resource, [])->assertForbidden();
        }
        $this->postJson('/api/admin/import/classes', [])->assertForbidden();
        $this->postJson('/api/admin/reminders')->assertForbidden();
        $teacher = User::where('username', 'lsantos')->firstOrFail();
        $student = User::where('username', 'aisha')->firstOrFail();
        foreach ([$teacher, $student] as $person) {
            $this->getJson("/api/admin/users/{$person->id}")->assertNotFound();
            $this->putJson("/api/admin/users/{$person->id}", ['name' => 'Changed'])->assertNotFound();
            $this->deleteJson("/api/admin/users/{$person->id}")->assertNotFound();
            $this->postJson("/api/admin/users/{$person->id}/temporary-password")->assertNotFound();
        }
        $this->getJson('/api/admin/users?role=teacher')->assertJsonCount(0, 'data');
        $accounts = $this->getJson('/api/admin/users')->assertOk()->json('data');
        $this->assertTrue(collect($accounts)->every(fn ($u) => $u['role'] === 'admin'));
        $this->postJson('/api/admin/invites', ['role' => 'teacher', 'people' => [[]]])->assertUnprocessable();
        $code = $this->postJson('/api/admin/invites', ['role' => 'admin', 'department_id' => $teacher->department_id, 'people' => [['name' => 'New Dean']]])->assertCreated()->json('data.0.code');
        $this->assertNotEmpty($code);
        foreach (['departments', 'questions', 'semesters', 'periods'] as $resource) $this->getJson('/api/admin/'.$resource)->assertOk();
        $this->getJson("/api/admin/reports/faculty/{$teacher->id}")->assertOk();
    }

    public function test_dean_manages_own_people_and_can_only_read_shared_framework(): void
    {
        $dean = $this->actingAsUsername('ccsdean');
        $teacher = User::where('username', 'lsantos')->firstOrFail();
        $foreign = User::where('username', 'mlopez')->firstOrFail();
        $this->putJson("/api/admin/users/{$teacher->id}", ['name' => $teacher->name])->assertOk();
        $this->getJson("/api/admin/users/{$foreign->id}")->assertNotFound();
        $this->getJson("/api/admin/users/{$dean->id}")->assertNotFound();
        $this->putJson("/api/admin/users/{$teacher->id}", ['role' => 'admin'])->assertUnprocessable();
        $this->putJson("/api/admin/users/{$teacher->id}", ['department_id' => $foreign->department_id])->assertUnprocessable();
        $this->postJson('/api/admin/invites', ['role' => 'admin', 'people' => [[]]])->assertUnprocessable();
        foreach (['questions', 'semesters', 'periods', 'departments'] as $resource) {
            $this->getJson('/api/admin/'.$resource)->assertOk();
            $this->postJson('/api/admin/'.$resource, [])->assertForbidden();
        }
        $this->putJson('/api/admin/school', ['settings' => ['scale' => ['x']]])->assertForbidden();
        foreach (['whitelist', 'subjects', 'sections', 'offerings'] as $resource) $this->getJson('/api/admin/'.$resource)->assertOk();
        $this->getJson("/api/admin/reports/faculty/{$teacher->id}")->assertOk();
        $this->getJson("/api/admin/reports/faculty/{$foreign->id}")->assertNotFound();
    }

    public function test_account_requests_and_support_go_to_the_responsible_dean(): void
    {
        $dean = User::where('username', 'ccsdean')->firstOrFail();
        $schoolAdmin = User::where('username', 'admin')->firstOrFail();
        $this->postJson('/api/auth/password-requests', ['login' => 'aisha'])->assertOk();
        $this->assertSame(1, $dean->appNotifications()->where('title', 'Password reset request')->count());
        $this->assertSame(0, $schoolAdmin->appNotifications()->where('title', 'Password reset request')->count());
        $this->actingAsUsername('aisha');
        $messageId = $this->postJson('/api/support', ['kind' => 'contact', 'message' => 'Please correct my assigned class.'])->assertCreated()->json('id');
        $this->actingAsUsername('admin');
        $this->getJson('/api/admin/password-requests')->assertJsonPath('pending', 0);
        $this->getJson('/api/admin/inbox')->assertJsonPath('open_count', 0);
        $this->postJson("/api/admin/inbox/{$messageId}/close")->assertNotFound();
        $this->actingAsUsername('ccsdean');
        $requestId = $this->getJson('/api/admin/password-requests')->assertJsonPath('pending', 1)->json('data.0.id');
        $this->getJson('/api/admin/inbox')->assertJsonPath('open_count', 1);
        $this->postJson("/api/admin/inbox/{$messageId}/close")->assertOk();
        $this->postJson("/api/admin/password-requests/{$requestId}/resolve")->assertOk();
    }

    public function test_explicit_student_transfer_requires_school_authority_reason_and_preserves_evaluations(): void
    {
        $student = User::where('username', 'aisha')->firstOrFail();
        $program = Program::where('code', 'BSED')->firstOrFail();
        $section = Section::create(['program_id' => $program->id, 'course' => 'BSED', 'year_level' => 2, 'name' => 'A']);
        $history = Evaluation::where('evaluator_id', $student->id)->get()->toArray();
        $payload = ['id_number' => $student->id_number, 'role' => 'student', 'department_id' => $program->department_id, 'section_id' => $section->id, 'reason' => 'Approved by both department offices.', 'confirmed' => true];
        $this->actingAsUsername('ccsdean');
        $this->postJson('/api/admin/transfers', $payload)->assertForbidden();
        $this->actingAsUsername('admin');
        $this->postJson('/api/admin/transfers', array_replace($payload, ['reason' => '']))->assertUnprocessable();
        $this->postJson('/api/admin/transfers', array_replace($payload, ['confirmed' => false]))->assertUnprocessable();
        $this->postJson('/api/admin/transfers', $payload)->assertOk()->assertJsonPath('user.section.id', $section->id);
        $this->assertSame($history, Evaluation::where('evaluator_id', $student->id)->get()->toArray());
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.transferred']);
        $this->actingAsUsername('ccsdean');
        $this->getJson("/api/admin/users/{$student->id}")->assertNotFound();
    }

    public function test_teacher_transfer_requires_class_handover_and_preserves_old_ratings(): void
    {
        $teacher = User::where('username', 'lsantos')->firstOrFail();
        $destination = Department::where('code', 'COE')->firstOrFail();
        $ratings = Evaluation::where('teacher_id', $teacher->id)->get()->toArray();
        $this->actingAsUsername('admin');
        $payload = ['id_number' => $teacher->id_number, 'role' => 'teacher', 'department_id' => $destination->id, 'reason' => 'Approved transfer after semester completion.', 'confirmed' => true];
        $this->postJson('/api/admin/transfers', $payload)->assertUnprocessable();
        Semester::query()->update(['is_active' => false]);
        $this->postJson('/api/admin/transfers', $payload)->assertOk()->assertJsonPath('user.department_id', $destination->id);
        $this->assertSame($ratings, Evaluation::where('teacher_id', $teacher->id)->get()->toArray());
    }

    public function test_reports_and_existing_question_criteria_cannot_be_rewritten(): void
    {
        $teacher = User::where('username', 'lsantos')->firstOrFail();
        $ratings = Evaluation::where('teacher_id', $teacher->id)->get()->toArray();
        foreach (['admin', 'ccsdean'] as $username) {
            $this->actingAsUsername($username);
            $this->putJson("/api/admin/reports/faculty/{$teacher->id}", ['average' => 5])->assertStatus(405);
        }
        $this->actingAsUsername('admin');
        EvaluationPeriod::query()->update(['opens_at' => now()->subDays(2), 'closes_at' => now()->subMinute()]);
        $question = Question::whereIn('id', \App\Models\EvaluationAnswer::query()->select('question_id'))->firstOrFail();
        $this->putJson("/api/admin/questions/{$question->id}", ['text' => 'A different criterion'])->assertUnprocessable();
        $this->deleteJson("/api/admin/questions/{$question->id}")->assertOk();
        $csv = $this->get('/api/admin/reports/faculty.csv')->assertOk()->streamedContent();
        $this->assertStringContainsString($question->category ?: $question->text, $csv);
        $this->assertSame($ratings, Evaluation::where('teacher_id', $teacher->id)->get()->toArray());
    }

    public function test_school_structure_cannot_leave_people_without_a_dean_or_move_them_implicitly(): void
    {
        $dean = User::where('username', 'ccsdean')->firstOrFail();
        $destination = Department::where('code', 'COE')->firstOrFail();
        $program = Program::where('code', 'BSIT')->firstOrFail();
        $this->actingAsUsername('admin');
        $this->putJson("/api/admin/users/{$dean->id}", ['is_active' => false])->assertUnprocessable();
        $this->putJson("/api/admin/users/{$dean->id}", ['department_id' => $destination->id])->assertUnprocessable();
        $this->deleteJson("/api/admin/users/{$dean->id}")->assertUnprocessable();
        $this->putJson("/api/admin/programs/{$program->id}", ['name' => $program->name, 'code' => $program->code, 'department_id' => $destination->id])->assertUnprocessable();
        User::factory()->admin()->create(['department_id' => $dean->department_id]);
        $this->putJson("/api/admin/users/{$dean->id}", ['is_active' => false])->assertOk();
    }
}
