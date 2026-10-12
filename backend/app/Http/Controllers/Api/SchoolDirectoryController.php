<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Say;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Public: finding a school when signing up or in, opening a join link, and applying
 * to bring a new school onto TeachWise.
 */
class SchoolDirectoryController extends Controller
{
    /** Active schools matching a name, short name, code, place or email address (school email domain). */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        if (str_contains($q, '@')) {
            $domain = Str::lower(Str::after($q, '@'));
            $schools = School::where('status', School::ACTIVE)->get()
                ->filter(fn (School $s) => $domain !== '' && collect($s->setting('email_domains'))->contains(fn ($d) => Str::lower($d) === $domain));
        } else {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
            $schools = School::where('status', School::ACTIVE)
                ->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('short_name', 'like', $like)->orWhere('code', 'like', $like)->orWhere('location', 'like', $like))
                ->orderBy('name')->limit(20)->get();
        }

        return response()->json(['data' => $schools->map->publicInfo()->values()]);
    }

    /** A join link or typed code, e.g. /join/MSUSULU. */
    public function show(string $code): JsonResponse
    {
        $school = School::where('status', School::ACTIVE)->where('code', Str::upper(trim($code)))->first();
        abort_unless($school, 404, Say::it('No school uses that code. Check it with your school.', 'Walang paaralang gumagamit ng code na iyan. I-check sa paaralan mo.'));

        return response()->json(['school' => $school->publicInfo()]);
    }

    /** A school's logo (any school with one; logos are public like on a website). */
    public function logo(int $id)
    {
        $school = School::find($id);
        abort_unless($school?->logo_path && Storage::disk('local')->exists($school->logo_path), 404);

        return response()->file(Storage::disk('local')->path($school->logo_path), ['Cache-Control' => 'public, max-age=86400']);
    }

    /** "Register your school": waits for the TeachWise owner's approval. */
    public function apply(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'short_name' => ['nullable', 'string', 'max:40'],
            'location' => ['required', 'string', 'max:120'],
            'contact_name' => ['required', 'string', 'max:120'],
            'contact_position' => ['required', 'string', 'max:80'],
            'contact_email' => ['required', 'email', 'max:150'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'student_count' => ['nullable', 'integer', 'min:1', 'max:500000'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $exists = School::whereRaw('LOWER(name) = ?', [Str::lower($data['name'])])->first();
        if ($exists) {
            return response()->json([
                'message' => $exists->status === School::PENDING
                    ? Say::it('This school already applied. We’ll contact the person who applied soon.', 'Nag-apply na ang paaralang ito. Makikipag-ugnayan kami sa nag-apply sa lalong madaling panahon.')
                    : Say::it('This school is already on TeachWise. Ask your registrar or QA office for access.', 'Nasa TeachWise na ang paaralang ito. Humingi ng access sa registrar o QA office.'),
                'errors' => ['name' => [Say::it('Already registered.', 'Nakarehistro na.')]],
            ], 422);
        }

        $school = School::create($data + [
            'code' => School::makeCode(($data['short_name'] ?? null) ?: $data['name']),
            'status' => School::PENDING,
        ]);

        Notifier::send(
            User::where('role', User::ROLE_PLATFORM)->where('is_active', true)->get(),
            'account',
            'New school application',
            "{$school->name} ({$school->location}) applied. Contact: {$school->contact_name}, {$school->contact_position}."
        );

        return response()->json([
            'message' => Say::it(
                'Thank you! We received your application and will email you within 2 working days.',
                'Salamat! Natanggap namin ang aplikasyon mo at mag-e-email kami sa loob ng 2 araw ng trabaho.'
            ),
            'school' => ['name' => $school->name, 'status' => $school->status],
        ], 201);
    }
}
