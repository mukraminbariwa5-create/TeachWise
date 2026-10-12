<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Support\Notifier;
use App\Support\Say;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** "Contact the admin" and "Report a problem" from the Help screen. */
class SupportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['contact', 'problem'])],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
            'screen' => ['nullable', 'string', 'max:120'],
        ]);
        $user = $request->user();
        // Students and teachers write to their school's admins; admins (and the owner) write to TeachWise support.
        $toTeachwise = $user->isAdmin() || $user->isPlatform();

        $message = SupportMessage::create([
            'user_id' => $user->id,
            'kind' => $data['kind'],
            'message' => $data['message'],
            'meta' => array_filter([
                'to' => $toTeachwise ? 'teachwise' : null,
                'screen' => $data['screen'] ?? null,
                'app_version' => $request->header('X-App-Version'),
                'platform' => $request->header('X-Platform'),
            ]),
        ]);

        $title = $data['kind'] === 'problem' ? 'Problem reported' : 'New message';
        $recipients = $toTeachwise
            ? User::withoutGlobalScopes()->where('role', User::ROLE_PLATFORM)->where('is_active', true)->whereKeyNot($user->id)->get()
            : Notifier::admins()->where('id', '!=', $user->id);
        Notifier::send($recipients, 'account', $title, "{$user->name}: ".mb_strimwidth($data['message'], 0, 140, '…'));

        return response()->json([
            'id' => $message->id,
            'message' => $toTeachwise
                ? Say::it('Thanks! Your message was sent to TeachWise support.', 'Salamat! Naipadala na ang mensahe mo sa TeachWise support.')
                : Say::it('Thanks! Your message was sent to the admin.', 'Salamat! Naipadala na ang mensahe mo sa admin.'),
        ], 201);
    }
}
