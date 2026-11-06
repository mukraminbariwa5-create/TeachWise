<?php

namespace Tests\Feature;

use App\Models\EvaluationPeriod;
use App\Models\Program;
use App\Models\Section;
use App\Models\Semester;
use App\Models\User;
use App\Models\WhitelistedId;

class FinalWorkflowReviewTest extends ApiTestCase
{
    public function test_enrolled_student_corrections_keep_the_approved_record_in_sync(): void
    {
        $this->actingAsUsername('ccsdean');
        $student = User::where('username', 'aisha')->firstOrFail();
        $oldId = $student->id_number;
        $section = Section::where('course', 'BSIT')->where('year_level', 2)->where('name', 'A')->firstOrFail();
        $this->putJson("/api/admin/users/{$student->id}", ['id_number' => '2026-REVIEW', 'name' => 'Aisha Updated', 'section_id' => $section->id])->assertOk();
        $this->assertDatabaseMissing('whitelisted_ids', ['school_id' => $student->school_id, 'id_number' => $oldId]);
        $this->assertDatabaseHas('whitelisted_ids', ['id_number' => '2026-REVIEW', 'name' => 'Aisha Updated', 'section_id' => $section->id]);
        $approved = WhitelistedId::where('id_number', '2023-0101')->firstOrFail();
        $this->putJson("/api/admin/users/{$student->id}", ['id_number' => $approved->id_number])->assertUnprocessable();
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => '2026-REVIEW', 'name' => 'Wrong Identity', 'section_id' => $section->id]]])->assertUnprocessable();
        $this->assertSame('Aisha Updated', $student->fresh()->name);
        $this->assertSame('Aisha Updated', WhitelistedId::where('id_number', '2026-REVIEW')->value('name'));
    }

    public function test_a_missing_approved_record_does_not_allow_another_department_to_claim_an_enrolled_id(): void
    {
        $student = User::where('username', 'aisha')->firstOrFail();
        WhitelistedId::where('id_number', $student->id_number)->delete();
        $program = Program::where('code', 'BSED')->firstOrFail();
        $section = Section::create(['program_id' => $program->id, 'course' => 'BSED', 'year_level' => 2, 'name' => 'A']);
        $dean = User::factory()->admin()->create(['department_id' => $program->department_id]);
        $this->actingAsUsername($dean->username);
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => $student->id_number, 'name' => $student->name, 'section_id' => $section->id]]])->assertUnprocessable();
        $this->assertDatabaseMissing('whitelisted_ids', ['school_id' => $student->school_id, 'id_number' => $student->id_number]);
        $teacher = User::where('username', 'mlopez')->firstOrFail();
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => $teacher->id_number, 'name' => $teacher->name, 'section_id' => $section->id]]])->assertUnprocessable();
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => str_repeat('1', 31), 'name' => 'Long ID', 'section_id' => $section->id]]])->assertUnprocessable();
    }

    public function test_periods_with_saved_evaluations_keep_their_type_and_semester(): void
    {
        $this->actingAsUsername('admin');
        $period = EvaluationPeriod::whereHas('evaluations')->where('type', 'student')->firstOrFail();
        $semester = Semester::create(['name' => 'Future review semester', 'is_active' => false]);
        $payload = ['name' => $period->name, 'type' => $period->type, 'semester_id' => $period->semester_id,
            'opens_at' => $period->opens_at->toIso8601String(), 'closes_at' => $period->closes_at->toIso8601String()];
        $this->putJson("/api/admin/periods/{$period->id}", array_replace($payload, ['type' => 'peer']))->assertUnprocessable();
        $this->putJson("/api/admin/periods/{$period->id}", array_replace($payload, ['semester_id' => $semester->id]))->assertUnprocessable();
        $this->putJson("/api/admin/periods/{$period->id}", array_replace($payload, ['semester_id' => null]))->assertUnprocessable();
        $this->putJson("/api/admin/periods/{$period->id}", array_replace($payload, ['closes_at' => $period->closes_at->copy()->addDay()->toIso8601String()]))->assertOk();
        $this->assertSame('student', $period->fresh()->type);
    }

    public function test_department_transfer_invalidates_the_previous_session(): void
    {
        $student = User::where('username', 'aisha')->firstOrFail();
        $token = $student->createToken('Before transfer')->plainTextToken;
        $program = Program::where('code', 'BSED')->firstOrFail();
        $section = Section::create(['program_id' => $program->id, 'course' => 'BSED', 'year_level' => 2, 'name' => 'A']);
        $this->actingAsUsername('admin');
        $this->postJson('/api/admin/transfers', ['id_number' => $student->id_number, 'role' => 'student', 'department_id' => $program->department_id,
            'section_id' => $section->id, 'reason' => 'Approved by both offices for enrollment.', 'confirmed' => true])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
        $login = $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])->assertOk()->assertJsonPath('user.section.label', 'BSED 2-A');
        $this->withToken($login->json('token'))->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.section.id', $section->id);
    }
}
