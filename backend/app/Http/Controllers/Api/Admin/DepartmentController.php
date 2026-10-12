<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Program;
use App\Models\User;
use App\Support\AdminScope;
use App\Support\Audit;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Colleges / departments and their programs. Only the school admin changes them. */
class DepartmentController extends Controller
{
    public function index(): JsonResponse
    {
        $departments = Department::query()
            ->when(AdminScope::limited(), fn ($q) => $q->whereKey(AdminScope::departmentId()))
            ->withCount(['programs', 'teachers'])
            ->with(['programs' => fn ($q) => $q->withCount('sections')->orderBy('code')])
            ->orderBy('name')
            ->get()
            ->map(fn (Department $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'code' => $d->code,
                'teachers_count' => $d->teachers_count,
                'admins' => User::where('role', User::ROLE_ADMIN)->where('department_id', $d->id)->pluck('name'),
                'programs' => $d->programs->map(fn (Program $p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name, 'sections_count' => $p->sections_count]),
            ]);

        return response()->json(['data' => $departments]);
    }

    public function store(Request $request): JsonResponse
    {
        $department = Department::create($this->validated($request));
        Audit::log('department.created', "Added the department {$department->name}.", $department);

        return response()->json(['department' => $department], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $department->update($this->validated($request, $department));

        return response()->json(['department' => $department]);
    }

    public function destroy(Department $department): JsonResponse
    {
        abort_if($department->programs()->exists(), 422, 'Move or delete this department’s programs first.');
        Audit::log('department.deleted', "Deleted the department {$department->name}.");
        $department->delete();

        return response()->json(['message' => 'Department deleted.']);
    }

    private function validated(Request $request, ?Department $department = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150', Tenant::unique('departments', 'name')->ignore($department)],
            'code' => ['nullable', 'string', 'max:20'],
        ]);
    }
}
