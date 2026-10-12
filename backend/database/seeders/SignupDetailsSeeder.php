<?php

namespace Database\Seeders;

use App\Models\Program;
use App\Models\School;
use App\Models\Section;
use App\Support\Tenant;
use App\Models\WhitelistedId;
use Illuminate\Database\Seeder;

/**
 * Demo data for the sign-up screen (safe to run on an existing database):
 * - more sections, so the section picker has something to search and group;
 * - names and sections on the free demo IDs, so "Create account" can fill them in;
 * - two first-year IDs without details, to show the manual path.
 */
class SignupDetailsSeeder extends Seeder
{
    public function run(): void
    {
        $school = School::where('code', 'DEMO')->first() ?? School::orderBy('id')->first();
        if ($school) {
            Tenant::run($school->id, fn () => $this->fill());
        }
    }

    private function fill(): void
    {
        $extra = [
            ['BSIT', 1, 'A'], ['BSIT', 1, 'B'], ['BSIT', 2, 'A'], ['BSIT', 2, 'B'], ['BSIT', 3, 'A'], ['BSIT', 4, 'B'],
            ['BSCS', 1, 'A'], ['BSCS', 2, 'A'], ['BSCS', 3, 'A'], ['BSCS', 4, 'A'], ['BSIS', 3, 'A'],
        ];
        foreach ([['BSIT', 4, 'A'], ['BSIT', 3, 'B'], ['BSIT', 2, 'C'], ...$extra] as [$course, $year, $name]) {
            Section::firstOrCreate(['course' => $course, 'year_level' => $year, 'name' => $name], ['program_id' => Program::where('code', $course)->value('id')]);
        }

        $section = fn (string $course, int $year, string $name) => Section::where(compact('course', 'name') + ['year_level' => $year])->value('id');

        $people = [
            '2023-0101' => ['Nadia Hassan', $section('BSIT', 4, 'A')],
            '2023-0102' => ['Omar Tulawie', $section('BSIT', 4, 'A')],
            '2023-0103' => ['Pia Santos', $section('BSIT', 4, 'A')],
            '2024-0101' => ['Rafael Abdurajak', $section('BSIT', 3, 'B')],
            '2025-0101' => ['Sara Jikiri', $section('BSIT', 2, 'C')],
        ];
        foreach ($people as $id => [$name, $sectionId]) {
            WhitelistedId::updateOrCreate(['id_number' => $id], ['name' => $name, 'section_id' => $sectionId, 'notes' => 'Demo list']);
        }

        foreach (['2026-0101', '2026-0102'] as $id) {
            WhitelistedId::firstOrCreate(['id_number' => $id], ['notes' => 'Demo list (no details)']);
        }
    }
}
