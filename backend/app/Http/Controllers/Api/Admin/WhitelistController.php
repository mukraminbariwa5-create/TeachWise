<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\AdminScope;
use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Models\WhitelistedId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** ID numbers allowed to self-register as students. */
class WhitelistController extends Controller
{
    public function index(): JsonResponse
    {
        $registered = \App\Models\User::whereNotNull('id_number')->pluck('id_number')->flip();

        return response()->json([
            'data' => WhitelistedId::with('section')
                ->when(AdminScope::limited(), fn ($q) => $q->whereHas('section', fn ($s) => AdminScope::sections($s)))
                ->orderBy('id_number')->get()
                ->map(fn (WhitelistedId $w) => $w->toArray() + ['registered' => isset($registered[$w->id_number])]),
        ]);
    }

    /**
     * Accepts plain IDs: {"id_numbers": ["2023-0001", "2023-0002"]}
     * or IDs with details, which sign-up then fills in:
     * {"entries": [{"id_number": "2023-0001", "name": "Aisha Tan", "section_id": 1}]}.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id_numbers' => ['required_without:entries', 'array', 'max:1000'],
            'id_numbers.*' => ['required', 'string', 'max:30'],
            'entries' => ['required_without:id_numbers', 'array', 'max:1000'],
            'entries.*.id_number' => ['required', 'string', 'max:30'],
            'entries.*.name' => ['nullable', 'string', 'max:255'],
            'entries.*.section_id' => ['nullable', Tenant::exists('sections')],
            'notes' => ['nullable', 'string', 'max:150'],
        ]);

        if (AdminScope::limited()) {
            abort_if(! empty($data['id_numbers']), 422, 'Add IDs with a section from your department.');
            $own = AdminScope::sections(\App\Models\Section::query())->pluck('id')->all();
            foreach ($data['entries'] ?? [] as $e) {
                abort_unless(in_array($e['section_id'] ?? null, $own, true), 422, 'Every ID needs a section from your department.');
                $existing = WhitelistedId::where('id_number', trim($e['id_number']))->first();
                abort_if($existing && $existing->section_id && ! in_array($existing->section_id, $own, true), 422, 'This ID is assigned to another department. Ask your school admin to correct it.');
                $registered = \App\Models\User::where('id_number', trim($e['id_number']))->first();
                if ($registered) {
                    abort_unless($registered->isStudent() && AdminScope::managedUsers(\App\Models\User::whereKey($registered->id))->exists(),
                        422, 'This ID belongs to another account or department.');
                    abort_if(($e['name'] ?? null) !== $registered->name || (int) ($e['section_id'] ?? 0) !== (int) $registered->studentProfile?->section_id,
                        422, 'This student is already enrolled. Update their name or section in People so the account and approved record stay together.');
                }
            }
        }

        $added = 0;
        foreach ($data['entries'] ?? [] as $e) {
            $row = WhitelistedId::updateOrCreate(
                ['id_number' => trim($e['id_number'])],
                ['name' => $e['name'] ?? null, 'section_id' => $e['section_id'] ?? null, 'notes' => $data['notes'] ?? null]
            );
            $added += $row->wasRecentlyCreated ? 1 : 0;
        }
        $data['id_numbers'] ??= [];

        foreach (array_unique(array_map('trim', $data['id_numbers'])) as $id) {
            $added += WhitelistedId::firstOrCreate(['id_number' => $id], ['notes' => $data['notes'] ?? null])->wasRecentlyCreated ? 1 : 0;
        }

        Audit::log('whitelist.imported', "Added {$added} ID number(s) to the approved list.");

        return response()->json(['message' => "{$added} ID number(s) added.", 'added' => $added], 201);
    }

    public function destroy(WhitelistedId $whitelist): JsonResponse
    {
        AdminScope::check(! AdminScope::limited() || AdminScope::sections(\App\Models\Section::whereKey($whitelist->section_id))->exists());
        Audit::log('whitelist.removed', "Removed {$whitelist->id_number} from the approved list.");
        $whitelist->delete();

        return response()->json(['message' => 'Removed from whitelist.']);
    }
}
