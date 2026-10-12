<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassOffering;
use App\Models\Program;
use App\Models\Section;
use App\Models\Semester;
use App\Models\Subject;
use App\Models\User;
use App\Support\AdminScope;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Bulk class assignments pasted from a spreadsheet. Missing subjects and sections are created;
 * teachers must already exist (add or invite them first). Each row is reported back.
 */
class ImportController extends Controller
{
    public function classes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.subject_code' => ['nullable', 'string', 'max:20'],
            'rows.*.subject_name' => ['nullable', 'string', 'max:150'],
            'rows.*.section' => ['required', 'string', 'max:40'],
            'rows.*.teacher' => ['required', 'string', 'max:150'],
            'rows.*.schedule' => ['nullable', 'string', 'max:60'],
        ]);
        $semester = Semester::current();
        $created = 0;
        $errors = [];

        DB::transaction(function () use ($data, $semester, &$created, &$errors) {
            foreach ($data['rows'] as $i => $row) {
                $line = $i + 1;
                $teacher = $this->teacher($row['teacher']);
                if (! $teacher) {
                    $errors[] = ['row' => $line, 'message' => "Teacher “{$row['teacher']}” not found. Add or invite them first."];

                    continue;
                }
                $section = $this->section($row['section']);
                if (! $section) {
                    $errors[] = ['row' => $line, 'message' => "Couldn’t read the section “{$row['section']}”. Use a format like BSIT 3A."];

                    continue;
                }
                if (AdminScope::limited() && $teacher->department_id !== AdminScope::departmentId() && ! AdminScope::sections(Section::whereKey($section->id))->exists()) {
                    $errors[] = ['row' => $line, 'message' => 'Outside your department.'];

                    continue;
                }
                $subject = $this->subject($row['subject_code'] ?? null, $row['subject_name'] ?? null);
                if (! $subject) {
                    $errors[] = ['row' => $line, 'message' => 'Each row needs a subject code or name.'];

                    continue;
                }
                $offering = ClassOffering::firstOrCreate(
                    ['teacher_id' => $teacher->id, 'subject_id' => $subject->id, 'section_id' => $section->id, 'semester_id' => $semester?->id],
                    ['schedule' => $row['schedule'] ?? null]
                );
                $created += $offering->wasRecentlyCreated ? 1 : 0;
            }
        });

        Audit::log('classes.imported', "Imported {$created} class assignment(s).");

        return response()->json([
            'message' => "{$created} class(es) added".($errors ? ', '.count($errors).' row(s) need attention.' : '.'),
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    private function teacher(string $who): ?User
    {
        $who = trim($who);

        return User::where('role', User::ROLE_TEACHER)
            ->where(fn ($q) => $q->where('id_number', $who)->orWhere('username', $who)->orWhere('email', $who)->orWhere('name', $who))
            ->first();
    }

    /** "BSIT 3A", "BSIT 3-A" or "BSIT-3A" → that section (created if new). */
    private function section(string $label): ?Section
    {
        if (! preg_match('/^\s*([A-Za-z][A-Za-z0-9]*)[\s-]*(\d)[\s-]*([A-Za-z0-9]{1,10})\s*$/', $label, $m)) {
            return null;
        }
        [$course, $year, $name] = [strtoupper($m[1]), (int) $m[2], strtoupper($m[3])];
        $program = Program::where('code', $course)->first();

        return Section::firstOrCreate(['course' => $course, 'year_level' => $year, 'name' => $name], ['program_id' => $program?->id]);
    }

    private function subject(?string $code, ?string $name): ?Subject
    {
        $code = $code ? strtoupper(trim($code)) : null;
        $name = $name ? trim($name) : null;
        if (! $code && ! $name) {
            return null;
        }
        $existing = $code ? Subject::where('code', $code)->first() : Subject::where('name', $name)->first();

        return $existing ?? Subject::create(['code' => $code, 'name' => $name ?: $code, 'department_id' => AdminScope::departmentId()]);
    }
}
