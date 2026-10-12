<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassOffering;
use App\Models\Department;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Program;
use App\Models\Question;
use App\Models\School;
use App\Models\Section;
use App\Models\Semester;
use App\Models\Subject;
use App\Models\User;
use App\Support\Audit;
use App\Support\Notifier;
use App\Support\Present;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** The school's own profile and settings, its setup checklist, data export and deletion request. */
class SchoolController extends Controller
{
    public function show(): JsonResponse
    {
        $school = Tenant::school();

        return response()->json([
            'school' => Present::school($school) + [
                'contact_name' => $school->contact_name,
                'contact_email' => $school->contact_email,
                'contact_phone' => $school->contact_phone,
                'email_domains' => $school->setting('email_domains'),
                'deletion_requested_at' => $school->setting('deletion_requested_at'),
            ],
            'setup' => $this->checklist(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $school = Tenant::school();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'short_name' => ['sometimes', 'nullable', 'string', 'max:40'],
            'location' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contact_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:150'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'code' => ['sometimes', 'string', 'regex:/^[A-Za-z0-9]{3,20}$/', Rule::unique('schools', 'code')->ignore($school->id)],
            'settings' => ['sometimes', 'array'],
            'settings.term_label' => ['sometimes', Rule::in(['semester', 'trimester', 'quarter'])],
            'settings.peer_evaluation' => ['sometimes', 'boolean'],
            'settings.min_responses' => ['sometimes', 'integer', 'between:1,20'],
            'settings.scale' => ['sometimes', 'array', 'size:5'],
            'settings.scale.*' => ['required', 'string', 'max:30'],
            'settings.scale_fil' => ['sometimes', 'array', 'size:5'],
            'settings.scale_fil.*' => ['required', 'string', 'max:30'],
            'settings.support_email' => ['sometimes', 'nullable', 'email', 'max:150'],
            'settings.dpo_email' => ['sometimes', 'nullable', 'email', 'max:150'],
            'settings.email_domains' => ['sometimes', 'array', 'max:10'],
            'settings.email_domains.*' => ['string', 'max:100', 'regex:/^[a-z0-9.-]+\.[a-z]{2,}$/i'],
            'settings.setup_completed' => ['sometimes', 'boolean'],
        ], ['code.regex' => 'Use 3 to 20 letters or numbers.']);

        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
        }
        if (isset($data['settings'])) {
            $data['settings'] = array_replace($school->settings ?? [], $data['settings']);
        }
        $school->update($data);
        Audit::log('school.updated', 'Updated the school profile or settings.', $school, ['fields' => array_keys($data)]);

        return $this->show();
    }

    /** PNG, JPG or WebP up to 1 MB. Shown in the app for everyone at the school. */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:1024']]);
        $school = Tenant::school();
        if ($school->logo_path) {
            Storage::disk('local')->delete($school->logo_path);
        }
        $school->update(['logo_path' => $request->file('logo')->store("schools/{$school->id}", 'local')]);
        $school->touch();

        return $this->show();
    }

    public function removeLogo(): JsonResponse
    {
        $school = Tenant::school();
        if ($school->logo_path) {
            Storage::disk('local')->delete($school->logo_path);
            $school->update(['logo_path' => null]);
        }

        return $this->show();
    }

    /**
     * Everything the school keeps in TeachWise, without evaluator identities:
     * structure, people (no passwords), classes, questions, periods and evaluations.
     */
    public function export(): JsonResponse
    {
        $school = Tenant::school();
        Audit::log('school.exported', 'Downloaded a full export of the school’s data.', $school);

        return response()->json([
            'exported_at' => now()->toIso8601String(),
            'school' => $school->only(['name', 'short_name', 'code', 'location', 'contact_name', 'contact_email', 'settings']),
            'departments' => Department::get(['id', 'name', 'code']),
            'programs' => Program::get(['id', 'department_id', 'code', 'name']),
            'sections' => Section::get(['id', 'program_id', 'course', 'year_level', 'name']),
            'subjects' => Subject::get(['id', 'department_id', 'code', 'name', 'units']),
            'semesters' => Semester::get(['id', 'name', 'starts_on', 'ends_on', 'is_active']),
            'people' => User::with('studentProfile:id,user_id,section_id')->get(['id', 'id_number', 'name', 'username', 'email', 'role', 'department_id', 'is_active', 'created_at'])
                ->map(fn (User $u) => $u->only(['id', 'id_number', 'name', 'username', 'email', 'role', 'department_id', 'is_active', 'created_at']) + ['section_id' => $u->studentProfile?->section_id]),
            'classes' => ClassOffering::get(['id', 'teacher_id', 'subject_id', 'section_id', 'semester_id', 'schedule']),
            'questions' => Question::get(['id', 'audience', 'category', 'category_fil', 'text', 'text_fil', 'type', 'sort_order', 'is_active']),
            'periods' => EvaluationPeriod::get(['id', 'semester_id', 'name', 'type', 'opens_at', 'closes_at']),
            'evaluations' => Evaluation::with('answers:id,evaluation_id,question_id,rating,answer_text')
                ->get(['id', 'evaluation_period_id', 'class_offering_id', 'teacher_id', 'evaluator_role', 'overall_rating', 'comment', 'submitted_at']),
        ]);
    }

    /** Closing the school's TeachWise account: the TeachWise owner confirms and deletes everything. */
    public function requestDeletion(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password'], 'reason' => ['nullable', 'string', 'max:500']]);
        $school = Tenant::school();
        $school->update(['settings' => array_replace($school->settings ?? [], ['deletion_requested_at' => now()->toIso8601String(), 'deletion_reason' => $request->input('reason')])]);
        Notifier::send(User::withoutGlobalScopes()->where('role', User::ROLE_PLATFORM)->where('is_active', true)->get(), 'account', 'School deletion request', "{$school->name} asked for its TeachWise data to be deleted.");
        Audit::log('school.deletion_requested', 'Asked TeachWise to delete the school’s data.', $school);

        return response()->json(['message' => 'Request sent. TeachWise will confirm by email before deleting anything. Download an export first if you need a copy.'], 202);
    }

    /** What's left to set up, for the setup checklist on the admin's overview. */
    private function checklist(): array
    {
        $school = Tenant::school();
        $steps = [
            ['key' => 'profile', 'done' => (bool) ($school->location && $school->setting('support_email'))],
            ['key' => 'departments', 'done' => Department::exists() && Program::exists()],
            ['key' => 'semester', 'done' => Semester::where('is_active', true)->exists()],
            ['key' => 'teachers', 'done' => User::where('role', User::ROLE_TEACHER)->exists()],
            ['key' => 'classes', 'done' => Section::exists() && ClassOffering::exists()],
            ['key' => 'students', 'done' => \App\Models\WhitelistedId::exists() || User::where('role', User::ROLE_STUDENT)->exists()],
            ['key' => 'period', 'done' => EvaluationPeriod::exists()],
        ];

        return [
            'completed' => (bool) $school->setting('setup_completed'),
            'steps' => $steps,
            'done' => collect($steps)->where('done', true)->count(),
            'total' => count($steps),
        ];
    }
}
