<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\Tenant;
use App\Models\Program;
use App\Support\AdminScope;
use App\Http\Controllers\Controller;
use App\Models\Section;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SectionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => AdminScope::sections(Section::query())->with('program:id,code,name,department_id')->withCount(['students', 'offerings'])->orderBy('course')->orderBy('year_level')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['section' => Section::create($this->validated($request))], 201);
    }

    public function update(Request $request, Section $section): JsonResponse
    {
        $this->inScope($section);
        $section->update($this->validated($request, $section));

        return response()->json(['section' => $section]);
    }

    public function destroy(Section $section): JsonResponse
    {
        $this->inScope($section);
        abort_if($section->students()->exists(), 422, 'This section still has students. Move them to another section first.');
        abort_if($section->offerings()->exists(), 422, 'This section still has classes. Remove or move its classes first.');
        $section->delete();

        return response()->json(['message' => 'Section deleted.']);
    }

    private function validated(Request $request, ?Section $section = null): array
    {
        $data = $request->validate([
            'program_id' => [AdminScope::limited() ? 'required' : 'nullable', 'integer', Tenant::exists('programs')],
            'course' => ['required_without:program_id', 'nullable', 'string', 'max:20'],
            'year_level' => ['required', 'integer', 'between:1,6'],
            'name' => ['required', 'string', 'max:10'],
        ]);
        if (! empty($data['program_id'])) {
            $program = AdminScope::programs(Program::query())->find($data['program_id']);
            abort_unless($program, 422, 'Choose a program in your department.');
            $data['course'] = $program->code;
        }

        $duplicate = Section::where(collect($data)->only(['course', 'year_level', 'name'])->all())->when($section, fn ($q) => $q->whereKeyNot($section->id))->exists();
        abort_if($duplicate, 422, 'That section already exists.');

        return $data;
    }

    private function inScope(Section $section): void
    {
        AdminScope::check(AdminScope::sections(Section::whereKey($section->id))->exists());
    }
}
