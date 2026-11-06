<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassOffering;
use App\Models\Department;
use App\Models\Section;
use App\Models\Semester;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\WhitelistedId;
use App\Support\Audit;
use App\Support\Present;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** An explicit, audited exception for transfers; never a general people editor. */
class TransferController extends Controller
{
    public function options()
    {
        return response()->json(['departments' => Department::orderBy('name')->get(['id', 'name']),
            'sections' => Section::with('program:id,department_id')->orderBy('course')->orderBy('year_level')->orderBy('name')->get()
                ->map(fn ($s) => ['id' => $s->id, 'label' => $s->label, 'department_id' => $s->program?->department_id])]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'id_number' => ['required', 'string', 'max:30'],
            'role' => ['required', Rule::in(['student', 'teacher'])],
            'department_id' => ['required', 'integer', Tenant::exists('departments')],
            'section_id' => ['required_if:role,student', 'nullable', 'integer', Tenant::exists('sections')],
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
            'confirmed' => ['accepted'],
        ]);
        $user = DB::transaction(function () use ($data) {
            $user = User::where('id_number', trim($data['id_number']))->where('role', $data['role'])->lockForUpdate()->firstOrFail();
            $before = Present::user($user);
            $department = Department::findOrFail($data['department_id']);
            $oldDepartment = $user->isStudent() ? $user->studentProfile?->section?->program?->department_id : $user->department_id;
            abort_if($oldDepartment === $department->id, 422, 'This person already belongs to that department. Their dean manages changes within it.');
            if ($user->isStudent()) {
                $section = Section::whereHas('program', fn ($q) => $q->where('department_id', $department->id))->find($data['section_id']);
                abort_unless($section, 422, 'Choose a section in the destination department.');
                StudentProfile::updateOrCreate(['user_id' => $user->id], ['section_id' => $section->id]);
                WhitelistedId::where('id_number', $user->id_number)->update(['section_id' => $section->id]);
            } else {
                $semester = Semester::current();
                abort_if($semester && ClassOffering::where('teacher_id', $user->id)->where('semester_id', $semester->id)->exists(),
                    422, 'This teacher still has current-semester classes. Coordinate the handover with the dean before transferring; keep evaluated classes for history.');
                $user->update(['department_id' => $department->id, 'department' => $department->name]);
            }
            Audit::log('user.transferred', "Transferred {$user->name} to {$department->name}.", $user,
                ['from' => $before, 'to_department_id' => $department->id, 'reason' => trim($data['reason'])]);
            $user->tokens()->delete();
            return $user->fresh()->load('studentProfile.section');
        });
        return response()->json(['message' => 'Department transfer recorded. Previous evaluations are preserved.', 'user' => Present::user($user)]);
    }
}
