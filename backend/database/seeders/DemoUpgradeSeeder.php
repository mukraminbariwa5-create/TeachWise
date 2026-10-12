<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Program;
use App\Models\School;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Database\Seeder;

/**
 * For computers that loaded the demo before TeachWise supported many schools:
 * turns the moved-over school into "Demo State University" with departments and programs,
 * and adds the owner account, the second school and the pending application.
 */
class DemoUpgradeSeeder extends Seeder
{
    public function run(): void
    {
        $school = User::where('username', 'aisha')->first()?->school;
        if (! $school) {
            return;
        }
        $school->update([
            'name' => 'Demo State University', 'short_name' => 'DSU', 'code' => School::where('code', 'DEMO')->whereKeyNot($school->id)->exists() ? $school->code : 'DEMO',
            'location' => 'Jolo, Sulu', 'settings' => array_replace($school->settings ?? [], ['setup_completed' => true]),
        ]);

        Tenant::run($school->id, function () {
            $ccs = Department::firstOrCreate(['name' => 'College of Computer Studies'], ['code' => 'CCS']);
            $coe = Department::firstOrCreate(['name' => 'College of Education'], ['code' => 'COE']);
            foreach ([['BSIT', 'BS Information Technology', $ccs], ['BSCS', 'BS Computer Science', $ccs], ['BSIS', 'BS Information Systems', $ccs], ['BSED', 'Bachelor of Secondary Education', $coe]] as [$code, $name, $dept]) {
                $program = Program::firstOrCreate(['code' => $code], ['name' => $name, 'department_id' => $dept->id]);
                Section::where('course', $code)->whereNull('program_id')->update(['program_id' => $program->id]);
            }
            User::where('role', User::ROLE_TEACHER)->whereNull('department_id')->update(['department_id' => $ccs->id, 'department' => 'College of Computer Studies']);
            Subject::whereNull('department_id')->update(['department_id' => $ccs->id]);
            if (! User::where('username', 'ccsdean')->exists()) {
                User::create([
                    'id_number' => 'ADMIN-002', 'name' => 'Dr. Hana Sali', 'username' => 'ccsdean', 'email' => 'dean.ccs@teachwise.test',
                    'role' => User::ROLE_ADMIN, 'department' => 'College of Computer Studies', 'department_id' => $ccs->id, 'password' => 'password',
                ]);
            }
        });

        if (! User::where('username', 'owner')->exists()) {
            User::create(['id_number' => 'TW-OWNER', 'name' => 'TeachWise Owner', 'username' => 'owner', 'email' => 'owner@teachwise.test', 'role' => User::ROLE_PLATFORM, 'password' => 'password']);
        }
        $demo = new DemoSeeder;
        if (! School::where('code', 'SAMPLE')->exists()) {
            $demo->sampleSchool();
        }
        if (! School::where('code', 'NIC')->exists()) {
            $demo->pendingSchool();
        }
    }
}
