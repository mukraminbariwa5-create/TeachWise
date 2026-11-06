<?php

namespace Tests\Feature;

use App\Models\ClassOffering;
use App\Models\Program;
use App\Models\Question;
use App\Models\Section;
use App\Models\Semester;
use App\Models\Subject;
use App\Models\User;
use App\Models\WhitelistedId;

class DepartmentClassAssignmentTest extends ApiTestCase
{
    public function test_dean_assigns_bsit_2a_and_signup_automatically_gets_only_its_current_semester_classes(): void
    {
        $this->actingAsUsername('ccsdean');
        $semester = Semester::current();
        $program = Program::where('code', 'BSIT')->firstOrFail();
        $teacher = User::where('username', 'lsantos')->firstOrFail();
        // Remove the unused section-picker fixtures so the dean creates these through the API.
        Section::where('course', 'BSIT')->where('year_level', 2)->whereIn('name', ['A', 'B'])->delete();
        $section = $this->postJson('/api/admin/sections', ['program_id' => $program->id, 'year_level' => 2, 'name' => 'A'])
            ->assertCreated()->json('section.id');
        $otherSection = $this->postJson('/api/admin/sections', ['program_id' => $program->id, 'year_level' => 2, 'name' => 'B'])
            ->assertCreated()->json('section.id');
        $subjects = [];
        $expected = [];
        foreach (['Programming Fundamentals', 'Database Fundamentals'] as $i => $name) {
            $subjects[] = $subject = $this->postJson('/api/admin/subjects', ['code' => 'FLOW-'.($i + 1), 'name' => $name, 'year_level' => 2])
                ->assertCreated()->json('subject.id');
            $expected[] = $this->postJson('/api/admin/offerings', ['teacher_id' => $teacher->id, 'subject_id' => $subject, 'section_id' => $section])
                ->assertCreated()->json('offering.id'); // omitted semester defaults to the school's current semester
        }
        $base = ['teacher_id' => $teacher->id, 'subject_id' => $subjects[0], 'section_id' => $section, 'semester_id' => $semester->id];
        $this->postJson('/api/admin/offerings', array_replace($base, ['section_id' => $otherSection]))->assertCreated();
        $next = Semester::create(['name' => '2nd Semester FLOW', 'is_active' => false]);
        $future = $this->postJson('/api/admin/offerings', array_replace($base, ['semester_id' => $next->id]))->assertCreated()->json('offering.id');
        ClassOffering::create(array_replace($base, ['semester_id' => null])); // legacy unbound assignment must not leak into any semester
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => '2026-2211', 'name' => 'Student Assignment', 'section_id' => $section]]])->assertCreated();

        $this->app['auth']->forgetGuards();
        $signup = $this->postJson('/api/auth/register', [
            'school_id' => $this->demoId(), 'id_number' => '2026-2211', 'username' => 'assignedstudent',
            'name' => 'Wrong Name', 'section_id' => $otherSection, 'semester_id' => $next->id, 'role' => 'teacher',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.name', 'Student Assignment')->assertJsonPath('user.role', 'student')
            ->assertJsonPath('user.section.label', 'BSIT 2-A');
        $this->withToken($signup->json('token'));
        $dashboard = $this->getJson('/api/student/dashboard')->assertOk()->assertJsonPath('semester.id', $semester->id)->assertJsonPath('progress.total', 2);
        $this->assertEqualsCanonicalizing($expected, collect($dashboard->json('teachers'))->pluck('offering_id')->all());
        $this->assertEqualsCanonicalizing(['Programming Fundamentals', 'Database Fundamentals'], collect($dashboard->json('teachers'))->pluck('subject.name')->all());
        $this->getJson("/api/student/offerings/{$future}/form")->assertForbidden();
        $answers = Question::for('student')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        foreach ($expected as $id) {
            $this->postJson('/api/student/evaluations', ['class_offering_id' => $id, 'answers' => $answers])->assertCreated();
        }
        $this->getJson('/api/student/dashboard')->assertJsonPath('progress.completed', 2);

        $this->actingAsUsername('ccsdean');
        $this->putJson('/api/admin/offerings/'.$expected[0], array_replace($base, ['section_id' => $otherSection]))->assertUnprocessable();
        $this->actingAsUsername('admin');
        $this->putJson("/api/admin/semesters/{$next->id}", ['name' => $next->name, 'is_active' => true])->assertOk();
        $this->actingAsUsername('assignedstudent');
        $this->getJson('/api/student/dashboard')->assertOk()->assertJsonPath('semester.id', $next->id)
            ->assertJsonCount(1, 'teachers')->assertJsonPath('teachers.0.offering_id', $future);
        $this->getJson('/api/student/history')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_department_admin_cannot_forge_foreign_class_or_roster_assignments(): void
    {
        $this->actingAsUsername('ccsdean');
        $ownTeacher = User::where('username', 'lsantos')->firstOrFail();
        $foreignTeacher = User::where('username', 'mlopez')->firstOrFail();
        $ownSection = Section::whereHas('program', fn ($q) => $q->where('department_id', $ownTeacher->department_id))->firstOrFail();
        $foreignSection = Section::create(['program_id' => Program::where('code', 'BSED')->value('id'), 'course' => 'BSED', 'year_level' => 2, 'name' => 'A']);
        $ownSubject = Subject::where('department_id', $ownTeacher->department_id)->firstOrFail();
        $foreignSubject = Subject::create(['code' => 'ED-FLOW', 'name' => 'Education Flow', 'department_id' => $foreignTeacher->department_id]);
        $base = ['teacher_id' => $ownTeacher->id, 'subject_id' => $ownSubject->id, 'section_id' => $ownSection->id];
        foreach ([['teacher_id' => $foreignTeacher->id], ['subject_id' => $foreignSubject->id], ['section_id' => $foreignSection->id]] as $change) {
            $this->postJson('/api/admin/offerings', array_replace($base, $change))->assertUnprocessable();
        }
        $foreignId = WhitelistedId::create(['id_number' => '2026-FOREIGN', 'name' => 'Other Department', 'section_id' => $foreignSection->id]);
        $this->postJson('/api/admin/whitelist', ['entries' => [['id_number' => $foreignId->id_number, 'name' => 'Changed', 'section_id' => $ownSection->id]]])->assertUnprocessable();
        $this->assertSame($foreignSection->id, $foreignId->fresh()->section_id);
        $count = ClassOffering::count();
        $this->postJson('/api/admin/import/classes', ['rows' => [
            ['teacher' => $ownTeacher->username, 'subject_code' => $foreignSubject->code, 'section' => $ownSection->label],
            ['teacher' => $foreignTeacher->username, 'subject_code' => $ownSubject->code, 'section' => $ownSection->label],
            ['teacher' => $ownTeacher->username, 'subject_code' => $ownSubject->code, 'section' => $foreignSection->label],
        ]])->assertOk()->assertJsonPath('created', 0)->assertJsonCount(3, 'errors');
        $this->assertSame($count, ClassOffering::count());
    }

    public function test_missing_active_semester_does_not_show_unbound_classes_or_create_assignments(): void
    {
        $student = $this->actingAsUsername('aisha');
        $offering = ClassOffering::where('section_id', $student->studentProfile->section_id)->firstOrFail();
        Semester::query()->update(['is_active' => false]);
        $offering->update(['semester_id' => null]);
        $this->getJson('/api/student/dashboard')->assertOk()->assertJsonPath('semester', null)->assertJsonCount(0, 'teachers');
        $this->getJson("/api/student/offerings/{$offering->id}/form")->assertForbidden();
        $this->actingAsUsername('ccsdean');
        $this->postJson('/api/admin/offerings', $offering->only(['teacher_id', 'subject_id', 'section_id']))->assertUnprocessable()->assertJsonValidationErrors('semester_id');
        $this->postJson('/api/admin/import/classes', ['rows' => [['teacher' => 'lsantos', 'subject_code' => 'IT 301', 'section' => 'BSIT 4A']]])->assertUnprocessable();
    }
}
