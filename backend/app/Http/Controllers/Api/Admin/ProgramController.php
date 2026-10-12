<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Program;
use App\Models\Section;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Degree programs (BSIT, BSEd…). Sections belong to a program. */
class ProgramController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        return response()->json(['program' => Program::create($this->validated($request))], 201);
    }

    public function update(Request $request, Program $program): JsonResponse
    {
        $old = $program->code;
        $program->update($this->validated($request, $program));
        if ($old !== $program->code) {
            Section::where('program_id', $program->id)->update(['course' => $program->code]);
        }

        return response()->json(['program' => $program]);
    }

    public function destroy(Program $program): JsonResponse
    {
        abort_if($program->sections()->exists(), 422, 'This program still has sections. Move or delete them first.');
        $program->delete();

        return response()->json(['message' => 'Program deleted.']);
    }

    private function validated(Request $request, ?Program $program = null): array
    {
        $data = $request->validate([
            'department_id' => ['required', 'integer', Tenant::exists('departments')],
            'code' => ['required', 'string', 'max:20', Tenant::unique('programs', 'code')->ignore($program)],
            'name' => ['required', 'string', 'max:150'],
        ]);
        $data['code'] = strtoupper(trim($data['code']));

        return $data;
    }
}
