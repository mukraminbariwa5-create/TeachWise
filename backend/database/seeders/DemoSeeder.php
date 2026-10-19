<?php

namespace Database\Seeders;

use App\Models\ClassOffering;
use App\Models\Department;
use App\Models\Program;
use App\Models\School;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Question;
use App\Models\Section;
use App\Models\Semester;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use App\Models\WhitelistedId;
use App\Services\QuestionBank;
use App\Support\Tenant;
use Illuminate\Database\Seeder;

/**
 * Sample data that matches the TeachWise design mockups, for two schools so you can see
 * that each school only sees its own people, plus one school waiting for approval.
 * Every demo account uses the password "password".
 *
 * - owner        TeachWise owner (platform console)
 * - admin        school admin of Demo State University (DEMO)
 * - ccsdean      department admin, College of Computer Studies
 * - lsantos      teacher · aisha student
 * - sampleadmin  admin of Sample Community College (SAMPLE) · mara student there
 *
 * Only loaded on purpose, with: php artisan teachwise:demo
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(2026);

        User::create([
            'id_number' => 'TW-OWNER', 'name' => 'TeachWise Owner', 'username' => 'owner',
            'email' => 'owner@teachwise.test', 'role' => User::ROLE_PLATFORM, 'password' => 'password',
        ]);

        $school = School::create([
            'name' => 'Demo State University', 'short_name' => 'DSU', 'code' => 'DEMO', 'location' => 'Jolo, Sulu',
            'status' => School::ACTIVE, 'approved_at' => now(),
            'contact_name' => 'Registrar', 'contact_email' => 'registrar@dsu.test',
            'settings' => ['support_email' => 'registrar@dsu.test', 'dpo_email' => 'dpo@dsu.test', 'setup_completed' => true, 'email_domains' => ['dsu.test']],
        ]);
        QuestionBank::install($school);
        Tenant::run($school->id, fn () => $this->demoSchool());

        $this->sampleSchool();
        $this->pendingSchool();
    }

    /** A school that applied and is waiting for the owner's approval. */
    public function pendingSchool(): void
    {
        School::create([
            'name' => 'Northern Isles College', 'short_name' => 'NIC', 'code' => 'NIC', 'location' => 'Tawi-Tawi',
            'status' => School::PENDING, 'contact_name' => 'Dr. Amina Salih', 'contact_email' => 'qa@nic.test',
            'contact_phone' => '0917 000 1234', 'contact_position' => 'QA Director', 'student_count' => 1200,
            'message' => 'We would like to use TeachWise for our midterm evaluation.',
        ]);
    }

    /** The main demo school, matching the mockups. */
    private function demoSchool(): void
    {
        $ccs = Department::create(['name' => 'College of Computer Studies', 'code' => 'CCS']);
        $coe = Department::create(['name' => 'College of Education', 'code' => 'COE']);
        $programs = collect([
            ['BSIT', 'BS Information Technology', $ccs], ['BSCS', 'BS Computer Science', $ccs],
            ['BSIS', 'BS Information Systems', $ccs], ['BSED', 'Bachelor of Secondary Education', $coe],
        ])->mapWithKeys(fn ($p) => [$p[0] => Program::create(['code' => $p[0], 'name' => $p[1], 'department_id' => $p[2]->id])]);

        User::create([
            'id_number' => 'ADMIN-001', 'name' => 'DSU Registrar', 'username' => 'admin',
            'email' => 'admin@teachwise.test', 'role' => User::ROLE_ADMIN, 'department' => 'Registrar',
            'password' => 'password',
        ]);
        User::create([
            'id_number' => 'ADMIN-002', 'name' => 'Dr. Hana Sali', 'username' => 'ccsdean',
            'email' => 'dean.ccs@teachwise.test', 'role' => User::ROLE_ADMIN, 'department' => 'College of Computer Studies',
            'department_id' => $ccs->id, 'password' => 'password',
        ]);
        User::create([
            'id_number' => 'T-101', 'name' => 'Prof. Maria Lopez', 'username' => 'mlopez',
            'role' => User::ROLE_TEACHER, 'department' => 'College of Education', 'department_id' => $coe->id, 'password' => 'password',
        ]);

        $teachers = collect([
            ['T-001', 'Prof. Ramon Dela Cruz', 'rdelacruz', 'IT Department'],
            ['T-002', 'Prof. Liza Santos', 'lsantos', 'IT Department'],
            ['T-003', 'Prof. Abdul Hassan', 'ahassan', 'IT Department'],
            ['T-004', 'Prof. Grace Lim', 'glim', 'CS Department'],
        ])->mapWithKeys(fn ($t) => [$t[2] => User::create([
            'id_number' => $t[0], 'name' => $t[1], 'username' => $t[2],
            'role' => User::ROLE_TEACHER, 'department' => 'College of Computer Studies', 'department_id' => $ccs->id, 'password' => 'password',
        ])]);

        $semester = Semester::create([
            'name' => '1st Semester 2026-2027', 'starts_on' => now()->subMonths(2)->startOfMonth(),
            'ends_on' => now()->addMonths(2)->endOfMonth(), 'is_active' => true,
        ]);

        $sections = collect([['BSIT', 4, 'A'], ['BSIT', 3, 'B'], ['BSIT', 2, 'C']])
            ->mapWithKeys(fn ($s) => ["{$s[1]}{$s[2]}" => Section::create(['program_id' => $programs[$s[0]]->id, 'course' => $s[0], 'year_level' => $s[1], 'name' => $s[2]])]);

        $subjects = collect([
            ['IT 301', 'Data Communications', 3],
            ['IT 302', 'Database Management', 3],
            ['IT 305', 'Web Systems', 3],
            ['IT 310', 'Information Assurance', 4],
        ])->mapWithKeys(fn ($s) => [$s[0] => Subject::create(['code' => $s[0], 'name' => $s[1], 'year_level' => $s[2], 'units' => 3, 'department_id' => $ccs->id])]);

        $offer = fn ($teacher, $code, $section, $schedule) => ClassOffering::create([
            'teacher_id' => $teachers[$teacher]->id, 'subject_id' => $subjects[$code]->id,
            'section_id' => $sections[$section]->id, 'semester_id' => $semester->id, 'schedule' => $schedule,
        ]);

        $offerings4A = [
            $offer('rdelacruz', 'IT 301', '4A', 'MWF 9:00-10:00am'),
            $offer('lsantos', 'IT 305', '4A', 'TTh 1:00-2:30pm'),
            $offer('ahassan', 'IT 310', '4A', 'MWF 2:00-3:00pm'),
            $offer('glim', 'IT 302', '4A', 'TTh 9:00-10:30am'),
        ];
        $offerings3B = [
            $offer('rdelacruz', 'IT 301', '3B', 'MWF 10:00-11:00am'),
            $offer('lsantos', 'IT 305', '3B', 'TTh 3:00-4:30pm'),
        ];
        $offer('glim', 'IT 302', '2C', 'MWF 1:00-2:00pm');
        $offer('ahassan', 'IT 310', '2C', 'TTh 10:30am-12:00pm');

        // Co-teachers of IT 305, so Prof. Santos has peers to evaluate.
        $offer('rdelacruz', 'IT 305', '2C', 'MWF 3:00-4:00pm');
        $offer('ahassan', 'IT 305', '2C', 'Sat 8:00-11:00am');
        $offer('glim', 'IT 305', '3B', 'Sat 1:00-4:00pm');

        $makeStudent = function (string $idNo, string $name, string $username, string $section) use ($sections) {
            $u = User::create([
                'id_number' => $idNo, 'name' => $name, 'username' => $username,
                'role' => User::ROLE_STUDENT, 'password' => 'password',
            ]);
            StudentProfile::create(['user_id' => $u->id, 'section_id' => $sections[$section]->id]);

            return $u;
        };

        $aisha = $makeStudent('2023-0001', 'Aisha Tan', 'aisha', '4A');
        $classmates = collect([
            ['2023-0002', 'Ben Kho', 'benkho'], ['2023-0003', 'Cara Lim', 'caralim'],
            ['2023-0004', 'Dan Reyes', 'danreyes'], ['2023-0005', 'Ella Abdurahman', 'ella'],
            ['2023-0006', 'Faisal Jumli', 'faisal'],
        ])->map(fn ($s) => $makeStudent($s[0], $s[1], $s[2], '4A'));
        $thirdYears = collect([
            ['2024-0001', 'Gina Usman', 'gina'], ['2024-0002', 'Hadji Sali', 'hadji'], ['2024-0003', 'Iris Go', 'iris'],
        ])->map(fn ($s) => $makeStudent($s[0], $s[1], $s[2], '3B'));
        $makeStudent('2025-0001', 'Jamal Idris', 'jamal', '2C');

        // ID numbers that can sign up with "Create account" (already used ones are listed too, as in real life).
        foreach (['2023-0001', '2023-0002', '2023-0003', '2023-0004', '2023-0005', '2023-0006', '2024-0001', '2024-0002', '2024-0003', '2025-0001',
            '2023-0101', '2023-0102', '2023-0103', '2024-0101', '2025-0101'] as $id) {
            WhitelistedId::firstOrCreate(['id_number' => $id], ['notes' => 'Demo list']);
        }

        // A finished Prelim, so dashboards and reports have a trend to show.
        $prelim = EvaluationPeriod::create([
            'semester_id' => $semester->id, 'name' => 'Prelim', 'type' => 'student',
            'opens_at' => now()->subWeeks(6)->startOfDay(), 'closes_at' => now()->subWeeks(6)->addDays(3)->endOfDay(),
        ]);
        $midterm = EvaluationPeriod::create([
            'semester_id' => $semester->id, 'name' => 'Midterm', 'type' => 'student',
            'opens_at' => now()->subDay()->startOfDay(), 'closes_at' => now()->addDays(2)->endOfDay(),
        ]);
        $peerPeriod = EvaluationPeriod::create([
            'semester_id' => $semester->id, 'name' => 'Faculty-to-faculty', 'type' => 'peer',
            'opens_at' => now()->startOfDay(), 'closes_at' => now()->addDays(7)->endOfDay(),
        ]);
        EvaluationPeriod::create([
            'semester_id' => $semester->id, 'name' => 'Finals', 'type' => 'student',
            'opens_at' => now()->addWeeks(8)->startOfDay(), 'closes_at' => now()->addWeeks(8)->addDays(2)->endOfDay(),
        ]);

        $questions = Question::for('student')->get();
        $comments = [
            'The lab activities really helped me understand the topic.',
            'Please upload the slides so we can review before quizzes.',
            'Very approachable and explains well when asked.',
            'Sometimes the instructions for projects are unclear.',
            null, null,
        ];

        $submit = function (User $student, ClassOffering $offering, ?EvaluationPeriod $period = null) use ($midterm, $questions, $comments) {
            $period ??= $midterm;
            $early = $period->id !== $midterm->id;
            // Prelim ratings run a little lower, so the demo shows teachers improving.
            $ratings = $questions->map(fn () => $early ? mt_rand(2, 5) : mt_rand(3, 5));
            $evaluation = Evaluation::create([
                'evaluation_period_id' => $period->id, 'class_offering_id' => $offering->id,
                'teacher_id' => $offering->teacher_id, 'evaluator_id' => $student->id, 'evaluator_role' => 'student',
                'overall_rating' => round($ratings->avg(), 2), 'comment' => $comments[array_rand($comments)],
                'submitted_at' => $early ? $period->closes_at->copy()->subHours(mt_rand(2, 60)) : now()->subHours(mt_rand(1, 30)),
            ]);
            foreach ($questions as $i => $q) {
                $evaluation->answers()->create(['question_id' => $q->id, 'rating' => $ratings[$i]]);
            }
        };

        // Prelim (Aisha joined after it, so her history only shows this term's Midterm).
        foreach ($classmates as $student) {
            foreach ($offerings4A as $offering) {
                $submit($student, $offering, $prelim);
            }
        }
        foreach ($thirdYears as $student) {
            foreach ($offerings3B as $offering) {
                $submit($student, $offering, $prelim);
            }
        }

        // Aisha has finished 2 of her 4 teachers, matching the mockup.
        $submit($aisha, $offerings4A[2]);
        $submit($aisha, $offerings4A[3]);

        foreach ($classmates as $student) {
            foreach ($offerings4A as $offering) {
                if (mt_rand(0, 3) > 0) {
                    $submit($student, $offering);
                }
            }
        }
        foreach ($thirdYears as $student) {
            foreach ($offerings3B as $offering) {
                $submit($student, $offering);
            }
        }

        // Prof. Santos already evaluated Prof. Lim, matching the mockup.
        $peerQuestions = Question::for('peer')->get();
        $peerEval = Evaluation::create([
            'evaluation_period_id' => $peerPeriod->id, 'teacher_id' => $teachers['glim']->id,
            'evaluator_id' => $teachers['lsantos']->id, 'evaluator_role' => 'teacher',
            'overall_rating' => 4.5, 'submitted_at' => now()->subHours(3),
        ]);
        foreach ($peerQuestions as $i => $q) {
            $peerEval->answers()->create(['question_id' => $q->id, 'rating' => $i % 2 ? 4 : 5]);
        }

        $this->call(SignupDetailsSeeder::class);
    }

    /** A second, smaller school. Same ID number as Aisha, to show IDs only need to be unique per school. */
    public function sampleSchool(): void
    {
        $school = School::create([
            'name' => 'Sample Community College', 'short_name' => 'SCC', 'code' => 'SAMPLE', 'location' => 'Zamboanga City',
            'status' => School::ACTIVE, 'approved_at' => now(),
            'settings' => ['support_email' => 'help@scc.test', 'setup_completed' => true, 'peer_evaluation' => false, 'term_label' => 'trimester'],
        ]);
        QuestionBank::install($school);

        Tenant::run($school->id, function () {
            $dept = Department::create(['name' => 'Business Department', 'code' => 'BUS']);
            $program = Program::create(['code' => 'BSBA', 'name' => 'BS Business Administration', 'department_id' => $dept->id]);
            User::create(['id_number' => 'ADMIN-001', 'name' => 'SCC Admin', 'username' => 'sampleadmin', 'role' => User::ROLE_ADMIN, 'password' => 'password']);
            $teacher = User::create(['id_number' => 'T-001', 'name' => 'Prof. Jose Reyes', 'username' => 'jreyes', 'role' => User::ROLE_TEACHER, 'department_id' => $dept->id, 'department' => 'Business Department', 'password' => 'password']);
            $term = Semester::create(['name' => '1st Trimester 2026-2027', 'is_active' => true]);
            $section = Section::create(['program_id' => $program->id, 'course' => 'BSBA', 'year_level' => 1, 'name' => 'A']);
            $subject = Subject::create(['code' => 'BA 101', 'name' => 'Principles of Management', 'department_id' => $dept->id]);
            ClassOffering::create(['teacher_id' => $teacher->id, 'subject_id' => $subject->id, 'section_id' => $section->id, 'semester_id' => $term->id, 'schedule' => 'MWF 8:00-9:00am']);
            $student = User::create(['id_number' => '2023-0001', 'name' => 'Mara Lim', 'username' => 'mara', 'role' => User::ROLE_STUDENT, 'password' => 'password']);
            StudentProfile::create(['user_id' => $student->id, 'section_id' => $section->id]);
            WhitelistedId::create(['id_number' => '2023-0001', 'name' => 'Mara Lim', 'section_id' => $section->id]);
            EvaluationPeriod::create(['semester_id' => $term->id, 'name' => 'Midterm', 'type' => 'student', 'opens_at' => now()->subDay(), 'closes_at' => now()->addDays(5)]);
        });
    }
}
