<?php

namespace Tests\Feature;

use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\Section;

/** Complete journeys through real API handlers and an isolated in-memory database. */
class EnrollmentEvaluationJourneyTest extends ApiTestCase
{
    private function asToken(string $token): void
    {
        $this->app['auth']->forgetGuards();
        $this->withToken($token);
    }

    public function test_new_student_evaluates_new_teacher_and_new_teacher_evaluates_department_colleague(): void
    {
        $dean = $this->actingAsUsername('ccsdean');
        $section = Section::where('course', 'BSIT')->where('year_level', 2)->where('name', 'A')->firstOrFail();
        $invites = $this->postJson('/api/admin/invites', ['role' => 'teacher', 'people' => [
            ['name' => 'Professor Journey One', 'id_number' => 'T-JOURNEY-1'],
            ['name' => 'Professor Journey Two', 'id_number' => 'T-JOURNEY-2'],
        ]])->assertCreated()->json('data');

        $teachers = [];
        foreach ($invites as $i => $invite) {
            $this->app['auth']->forgetGuards();
            $teachers[] = $this->postJson('/api/auth/accept-invite', [
                'code' => $invite['code'], 'username' => 'journeyteacher'.$i,
                'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
            ])->assertCreated()->assertJsonPath('user.department_id', $dean->department_id)->json();
        }

        $this->actingAsUsername('ccsdean');
        $subject = $this->postJson('/api/admin/subjects', ['code' => 'JOURNEY-PF', 'name' => 'Programming Fundamentals', 'year_level' => 2])->assertCreated()->json('subject.id');
        $offering = $this->postJson('/api/admin/offerings', ['teacher_id' => $teachers[0]['user']['id'], 'subject_id' => $subject, 'section_id' => $section->id])
            ->assertCreated()->json('offering.id');
        $this->postJson('/api/admin/whitelist', ['entries' => [[
            'id_number' => '2026-5501', 'name' => 'Student Journey', 'section_id' => $section->id,
        ]]])->assertCreated();

        $this->app['auth']->forgetGuards();
        $student = $this->postJson('/api/auth/register', [
            'school_id' => $this->demoId(), 'id_number' => '2026-5501', 'username' => 'journeystudent',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'accepted_privacy' => true,
        ])->assertCreated()->assertJsonPath('user.name', 'Student Journey')->assertJsonPath('user.section.label', 'BSIT 2-A')->json();
        // Sign in again to verify the account's saved credentials, not just the signup token.
        $studentLogin = $this->postJson('/api/auth/login', ['login' => 'journeystudent', 'password' => 'secret123'])->assertOk()->json();
        $this->asToken($studentLogin['token']);
        $this->getJson('/api/student/dashboard')->assertOk()->assertJsonCount(1, 'teachers')
            ->assertJsonPath('teachers.0.offering_id', $offering)->assertJsonPath('teachers.0.teacher.id', $teachers[0]['user']['id']);
        $studentForm = $this->getJson("/api/student/offerings/{$offering}/form")->assertOk()->assertJsonPath('period.is_open', true)->json();
        $answers = collect($studentForm['questions'])->where('type', 'rating')->map(fn ($q) => ['question_id' => $q['id'], 'rating' => 5])->values()->all();
        $payload = ['class_offering_id' => $offering, 'answers' => $answers, 'comment' => 'The programming examples helped me understand.'];
        $evaluationId = $this->postJson('/api/student/evaluations', $payload)->assertCreated()->json('evaluation_id');
        $this->postJson('/api/student/evaluations', $payload)->assertUnprocessable();
        $this->getJson('/api/student/dashboard')->assertJsonPath('progress.completed', 1)->assertJsonPath('teachers.0.status', 'completed');
        $this->getJson('/api/student/history')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $evaluationId);
        $this->assertDatabaseHas('evaluations', ['id' => $evaluationId, 'evaluator_id' => $student['user']['id'], 'teacher_id' => $teachers[0]['user']['id'], 'overall_rating' => 5]);

        $this->asToken($teachers[0]['token']);
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonPath('overall.responses', 1)
            ->assertJsonPath('privacy.locked', true)->assertJsonPath('overall.average', null)->assertJsonPath('recent_feedback', []);

        $teacherLogin = $this->postJson('/api/auth/login', ['login' => 'journeyteacher1', 'password' => 'secret123'])->assertOk()->json();
        $this->asToken($teacherLogin['token']);
        $peers = $this->getJson('/api/teacher/dashboard')->assertOk()->json('peers');
        $this->assertContains($teachers[0]['user']['id'], collect($peers)->pluck('teacher.id')->all());
        $peerId = $teachers[0]['user']['id'];
        $peerForm = $this->getJson("/api/teacher/peers/{$peerId}/form")->assertOk()->assertJsonPath('period.is_open', true)->json();
        $peerAnswers = collect($peerForm['questions'])->where('type', 'rating')->map(fn ($q) => ['question_id' => $q['id'], 'rating' => 4])->values()->all();
        $peerPayload = ['teacher_id' => $peerId, 'answers' => $peerAnswers, 'comment' => 'Clear explanations during our collaboration.'];
        $peerEvaluation = $this->postJson('/api/teacher/peer-evaluations', $peerPayload)->assertCreated()->json('evaluation_id');
        $this->postJson('/api/teacher/peer-evaluations', $peerPayload)->assertUnprocessable();
        $done = collect($this->getJson('/api/teacher/dashboard')->assertOk()->json('peers'))->firstWhere('teacher.id', $peerId);
        $this->assertSame('completed', $done['status']);
        $this->assertDatabaseHas('evaluations', ['id' => $peerEvaluation, 'evaluator_id' => $teachers[1]['user']['id'], 'teacher_id' => $peerId, 'evaluator_role' => 'teacher', 'overall_rating' => 4]);
        $this->asToken($teachers[0]['token']);
        $this->getJson('/api/teacher/dashboard')->assertOk()->assertJsonPath('peer_overall.responses', 1)->assertDontSee('journeystudent');
    }

    public function test_peer_evaluation_rejects_incomplete_answers_and_closed_period_without_saving(): void
    {
        $teacher = $this->actingAsUsername('lsantos');
        $peerId = collect($this->getJson('/api/teacher/dashboard')->assertOk()->json('peers'))->first()['teacher']['id'];
        $answers = Question::for('peer')->get()->map(fn ($q) => ['question_id' => $q->id, 'rating' => 4])->all();
        $count = Evaluation::where('evaluator_id', $teacher->id)->count();
        $incomplete = $answers;
        array_pop($incomplete);
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $peerId, 'answers' => $incomplete])->assertUnprocessable();
        EvaluationPeriod::where('type', 'peer')->update(['opens_at' => now()->subDays(2), 'closes_at' => now()->subMinute()]);
        $this->postJson('/api/teacher/peer-evaluations', ['teacher_id' => $peerId, 'answers' => $answers])->assertUnprocessable();
        $this->assertSame($count, Evaluation::where('evaluator_id', $teacher->id)->count());
    }
}
