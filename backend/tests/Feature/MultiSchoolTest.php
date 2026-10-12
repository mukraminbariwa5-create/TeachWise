<?php

namespace Tests\Feature;

use App\Models\ClassOffering;
use App\Models\Invite;
use App\Models\Question;
use App\Models\School;
use App\Models\Section;
use App\Models\User;
use App\Support\Tenant;

/** Many schools on one TeachWise: each only ever sees its own people and data. */
class MultiSchoolTest extends ApiTestCase
{
    private function school(string $code): School
    {
        return School::where('code', $code)->firstOrFail();
    }

    private function inDemo(callable $fn): mixed
    {
        return Tenant::run($this->school('DEMO')->id, $fn);
    }

    public function test_admins_only_see_and_change_their_own_school(): void
    {
        $aisha = User::withoutGlobalScopes()->where('username', 'aisha')->first();
        $demoSection = $this->inDemo(fn () => Section::first());

        $this->actingAsUsername('sampleadmin');
        $names = collect($this->getJson('/api/admin/users?per_page=500')->assertOk()->json('data'))->pluck('username');
        $this->assertContains('mara', $names);
        $this->assertNotContains('aisha', $names);

        $this->getJson("/api/admin/users/{$aisha->id}")->assertNotFound();
        $this->putJson("/api/admin/sections/{$demoSection->id}", ['course' => 'X', 'year_level' => 1, 'name' => 'Z'])->assertNotFound();
        $this->deleteJson("/api/admin/users/{$aisha->id}")->assertNotFound();
        $this->assertSame(1, count($this->getJson('/api/admin/sections')->json('data')));
    }

    public function test_ids_from_another_school_are_rejected(): void
    {
        $demoTeacher = User::withoutGlobalScopes()->where('username', 'lsantos')->first();
        $this->actingAsUsername('sampleadmin');
        $section = Section::first();
        $subject = \App\Models\Subject::first();

        $this->postJson('/api/admin/offerings', ['teacher_id' => $demoTeacher->id, 'subject_id' => $subject->id, 'section_id' => $section->id])
            ->assertStatus(422)->assertJsonValidationErrors('teacher_id');
    }

    public function test_students_only_see_and_evaluate_their_own_schools_classes(): void
    {
        $demoOffering = $this->inDemo(fn () => ClassOffering::first());
        $this->actingAsUsername('mara');

        $teachers = collect($this->getJson('/api/student/dashboard')->assertOk()->json('teachers'))->pluck('teacher.name');
        $this->assertEquals(['Prof. Jose Reyes'], $teachers->all());

        $answers = Question::for('student')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 5])->all();
        $this->postJson('/api/student/evaluations', ['class_offering_id' => $demoOffering->id, 'answers' => $answers])
            ->assertStatus(422)->assertJsonValidationErrors('class_offering_id');
        $this->getJson("/api/student/offerings/{$demoOffering->id}/form")->assertNotFound();
    }

    public function test_the_same_id_number_can_exist_in_two_schools(): void
    {
        $this->postJson('/api/auth/login', ['login' => '2023-0001', 'password' => 'password'])
            ->assertStatus(422)->assertJsonPath('needs_school', true);

        $this->postJson('/api/auth/login', ['login' => '2023-0001', 'password' => 'password', 'school_id' => $this->school('SAMPLE')->id])
            ->assertOk()->assertJsonPath('user.username', 'mara')->assertJsonPath('school.code', 'SAMPLE');

        $this->postJson('/api/auth/login', ['login' => 'aisha', 'password' => 'password'])
            ->assertOk()->assertJsonPath('school.name', 'Demo State University');
    }

    public function test_sign_up_checks_the_chosen_schools_list(): void
    {
        // 2023-0101 is approved at the demo school only.
        $this->postJson('/api/auth/check-id', ['school_id' => $this->school('SAMPLE')->id, 'id_number' => '2023-0101'])->assertJsonPath('reason', 'not_listed');
        $this->postJson('/api/auth/check-id', ['school_id' => $this->school('DEMO')->id, 'id_number' => '2023-0101'])->assertJsonPath('ok', true);
        $this->postJson('/api/auth/check-id', ['id_number' => '2023-0101'])->assertStatus(422)->assertJsonValidationErrors('school_id');

        $sampleSections = $this->getJson('/api/sections?school_id='.$this->school('SAMPLE')->id)->assertOk()->json('data');
        $this->assertCount(1, $sampleSections);
    }

    public function test_finding_a_school_and_applying(): void
    {
        $this->getJson('/api/schools?q=demo')->assertOk()->assertJsonPath('data.0.code', 'DEMO');
        $this->getJson('/api/schools?q=jolo')->assertOk()->assertJsonPath('data.0.name', 'Demo State University');
        $this->getJson('/api/schools?q=someone@dsu.test')->assertOk()->assertJsonPath('data.0.code', 'DEMO');
        $this->getJson('/api/schools?q=northern')->assertOk()->assertJsonCount(0, 'data');   // pending: not listed
        $this->getJson('/api/schools/sample')->assertOk()->assertJsonPath('school.name', 'Sample Community College');
        $this->getJson('/api/schools/NIC')->assertNotFound();

        $this->postJson('/api/schools/apply', [
            'name' => 'Basilan State College', 'location' => 'Isabela City', 'contact_name' => 'Dr. Ali', 'contact_position' => 'VP Academics', 'contact_email' => 'vpaa@bsc.test',
        ])->assertCreated();
        $this->assertSame(School::PENDING, School::where('name', 'Basilan State College')->value('status'));
        $this->postJson('/api/schools/apply', ['name' => 'basilan state college', 'location' => 'x', 'contact_name' => 'x', 'contact_position' => 'x', 'contact_email' => 'x@x.test'])->assertStatus(422);
    }

    public function test_owner_approves_a_school_and_its_first_admin_joins_with_the_invite(): void
    {
        $nic = $this->school('NIC');
        $this->actingAsUsername('owner');
        $this->getJson('/api/platform/overview')->assertOk()->assertJsonPath('schools.pending', 1);
        $code = $this->postJson("/api/platform/schools/{$nic->id}/approve")->assertOk()->json('invite.code');
        $this->assertSame(School::ACTIVE, $nic->fresh()->status);
        $this->assertGreaterThan(0, Question::withoutGlobalScopes()->where('school_id', $nic->id)->count());

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/invite', ['code' => $code])->assertOk()->assertJsonPath('role', 'admin')->assertJsonPath('school.code', 'NIC');
        $res = $this->postJson('/api/auth/accept-invite', [
            'code' => $code, 'name' => 'Dr. Amina Salih', 'id_number' => 'QA-001', 'username' => 'amina',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.role', 'admin')->assertJsonPath('school.settings.setup_completed', false);

        $this->postJson('/api/auth/accept-invite', ['code' => $code])->assertStatus(422);   // used once

        $this->withToken($res->json('token'))->getJson('/api/admin/school')->assertOk()
            ->assertJsonPath('school.code', 'NIC')->assertJsonPath('setup.done', 0);
        $this->withToken($res->json('token'))->getJson('/api/admin/users')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_teachers_join_with_invites_from_their_admin(): void
    {
        $this->actingAsUsername('admin');
        $codes = $this->postJson('/api/admin/invites', ['role' => 'teacher', 'people' => [['name' => 'Prof. New One'], ['name' => 'Prof. New Two', 'email' => 'two@dsu.test']]])
            ->assertCreated()->json('data.*.code');
        $this->assertCount(2, $codes);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/accept-invite', [
            'code' => $codes[0], 'name' => 'Prof. New One', 'id_number' => 'T-900', 'username' => 'newone',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.role', 'teacher')->assertJsonPath('school.code', 'DEMO');
        $this->assertSame($this->school('DEMO')->id, User::withoutGlobalScopes()->where('username', 'newone')->value('school_id'));
    }

    public function test_department_admins_only_manage_their_department(): void
    {
        $lopez = User::withoutGlobalScopes()->where('username', 'mlopez')->first();   // College of Education
        $this->actingAsUsername('ccsdean');

        $users = collect($this->getJson('/api/admin/users?per_page=500')->assertOk()->json('data'))->pluck('username');
        $this->assertContains('lsantos', $users);
        $this->assertContains('aisha', $users);
        $this->assertNotContains('mlopez', $users);
        $this->getJson("/api/admin/users/{$lopez->id}")->assertNotFound();

        $this->postJson('/api/admin/invites', ['role' => 'admin', 'people' => [['name' => 'X']]])
            ->assertStatus(422)->assertJsonValidationErrors('role');
        $this->postJson('/api/admin/periods', ['name' => 'Finals 2', 'type' => 'student', 'opens_at' => now(), 'closes_at' => now()->addDay()])->assertForbidden();
        $this->putJson('/api/admin/school', ['name' => 'Hacked'])->assertForbidden();
        $this->getJson('/api/admin/activity')->assertForbidden();

        $invite = $this->postJson('/api/admin/invites', ['role' => 'teacher', 'people' => [['name' => 'Prof. CCS']]])->assertCreated();
        $this->assertSame('College of Computer Studies', $invite->json('data.0.department'));

        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('stats.faculty', 4);
        $this->getJson("/api/admin/reports/faculty/{$lopez->id}")->assertNotFound();
    }

    public function test_a_paused_school_cannot_sign_in(): void
    {
        $sample = $this->school('SAMPLE');
        $token = User::withoutGlobalScopes()->where('username', 'mara')->first()->createToken('t|long')->plainTextToken;

        $this->actingAsUsername('owner');
        $this->postJson("/api/platform/schools/{$sample->id}/suspend", ['reason' => 'Unpaid'])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/student/dashboard')->assertUnauthorized();   // signed out everywhere
        $this->postJson('/api/auth/login', ['login' => 'mara', 'password' => 'password'])->assertStatus(422);
        $this->getJson('/api/schools/SAMPLE')->assertNotFound();

        $this->actingAsUsername('owner');
        $this->postJson("/api/platform/schools/{$sample->id}/activate")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', ['login' => 'mara', 'password' => 'password'])->assertOk();
    }

    public function test_the_owner_never_sees_evaluation_content(): void
    {
        $this->actingAsUsername('owner');
        $this->getJson('/api/admin/dashboard')->assertForbidden();
        $this->getJson('/api/wise/messages')->assertForbidden();
        $this->getJson('/api/platform/schools')->assertOk()->assertJsonPath('total', 3);
    }

    public function test_school_settings_change_what_people_see(): void
    {
        $this->actingAsUsername('admin');
        $this->putJson('/api/admin/school', ['settings' => ['min_responses' => 20, 'scale' => ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']]])->assertOk();

        $this->actingAsUsername('lsantos');
        $dash = $this->getJson('/api/teacher/dashboard')->assertOk();
        $this->assertTrue($dash->json('privacy.locked'));
        $this->assertSame([], $dash->json('criteria'));
        $this->getJson('/api/teacher/feedback')->assertJsonPath('locked', true);

        $this->actingAsUsername('aisha');
        $offering = collect($this->getJson('/api/student/dashboard')->json('teachers'))->firstWhere('status', 'pending');
        $this->getJson("/api/student/offerings/{$offering['offering_id']}/form")->assertJsonPath('scale.5', 'Always');

        // Peer evaluation switched off: no peers, no peer periods.
        $this->actingAsUsername('mara');
        $this->actingAsUsername('sampleadmin');
        $this->postJson('/api/admin/periods', ['name' => 'Peer', 'type' => 'peer', 'opens_at' => now(), 'closes_at' => now()->addDay()])->assertStatus(422);
        $this->actingAsUsername('jreyes');
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonPath('peer_evaluation', false)->assertJsonPath('peers', []);
    }

    public function test_class_import_creates_subjects_and_sections(): void
    {
        $this->actingAsUsername('admin');
        $res = $this->postJson('/api/admin/import/classes', ['rows' => [
            ['subject_code' => 'IT 401', 'subject_name' => 'Capstone 1', 'section' => 'BSIT 4A', 'teacher' => 'T-002', 'schedule' => 'Sat 8-11'],
            ['subject_code' => 'IT 402', 'section' => 'BSCS 1-C', 'teacher' => 'lsantos'],
            ['subject_code' => 'IT 403', 'section' => 'BSIT 4A', 'teacher' => 'Nobody'],
        ]])->assertOk();
        $this->assertSame(2, $res->json('created'));
        $this->assertSame(3, $res->json('errors.0.row'));
        $this->assertTrue(Section::where('course', 'BSCS')->where('year_level', 1)->where('name', 'C')->exists());
    }

    public function test_scheduled_notifications_stay_inside_each_school(): void
    {
        \App\Models\EvaluationPeriod::withoutGlobalScopes()->update(['announced_at' => null]);
        $this->artisan('teachwise:notify')->assertSuccessful();

        $mara = User::withoutGlobalScopes()->where('username', 'mara')->first();
        $titles = $mara->appNotifications()->pluck('title');
        $this->assertTrue($titles->contains('Midterm evaluation is open'));
        $this->assertFalse($titles->contains('Faculty-to-faculty evaluation is open'));
    }
}
