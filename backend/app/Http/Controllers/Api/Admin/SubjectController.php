<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\AdminScope;
use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => AdminScope::subjects(Subject::query())->with('department:id,name,code')->withCount('offerings')->orderBy('code')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['subject' => Subject::create($this->validated($request))], 201);
    }

    public function update(Request $request, Subject $subject): JsonResponse
    {
        AdminScope::check(AdminScope::subjects(Subject::whereKey($subject->id))->exists());
        $subject->update($this->validated($request, $subject));

        return response()->json(['subject' => $subject]);
    }

    public function destroy(Subject $subject): JsonResponse
    {
        AdminScope::check(AdminScope::subjects(Subject::whereKey($subject->id))->exists());
        abort_if($subject->offerings()->exists(), 422, 'This subject is used by classes. Remove those classes first.');
        $subject->delete();

        return response()->json(['message' => 'Subject deleted.']);
    }

    private function validated(Request $request, ?Subject $subject = null): array
    {
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:20', Tenant::unique('subjects', 'code')->ignore($subject)],
            'name' => [$subject ? 'sometimes' : 'required', 'string', 'max:150'],
            'department_id' => ['nullable', 'integer', Tenant::exists('departments')],
            'year_level' => ['nullable', 'integer', 'between:1,6'],
            'units' => ['nullable', 'integer', 'between:1,10'],
        ]);
        // Department admins always add subjects to their own department.
        if (AdminScope::limited()) {
            $data['department_id'] = AdminScope::departmentId();
        }

        return $data;
    }
}
