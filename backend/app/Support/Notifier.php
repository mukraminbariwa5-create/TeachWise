<?php

namespace App\Support;

use App\Models\AppNotification;
use App\Models\PushToken;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Sends a notification: always to the in-app list, and as a push notification to the
 * person's phones when they allow that category (periods, reminders, account).
 * Pushes go through Expo's push service after the response is sent, so requests stay fast.
 */
class Notifier
{
    /** @param  User|iterable<User>  $users */
    public static function send(User|iterable $users, string $category, string $title, string $message, array $data = []): int
    {
        $users = $users instanceof User ? collect([$users]) : collect($users);
        $pushes = [];

        foreach ($users as $user) {
            AppNotification::create(['user_id' => $user->id, 'title' => $title, 'message' => $message]);
            if ($category === 'account' || $user->wantsNotification($category)) {
                foreach ($user->pushTokens()->pluck('token') as $token) {
                    $pushes[] = ['to' => $token, 'title' => $title, 'body' => $message, 'sound' => 'default', 'data' => $data + ['category' => $category]];
                }
            }
        }

        if ($pushes && config('services.expo_push.enabled')) {
            dispatch(fn () => self::push($pushes))->afterResponse();
        }

        return $users->count();
    }

    /** Expo accepts up to 100 messages per request. Tokens that no longer work are removed. */
    public static function push(array $messages): void
    {
        foreach (array_chunk($messages, 100) as $chunk) {
            try {
                $response = Http::timeout(10)->acceptJson()->post('https://exp.host/--/api/v2/push/send', $chunk);
                foreach ((array) $response->json('data') as $i => $ticket) {
                    if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered') {
                        PushToken::where('token', $chunk[$i]['to'])->delete();
                    }
                }
            } catch (Throwable $e) {
                report($e);
            }
        }
    }

    /**
     * Active school admins (default: the current school), for messages, requests and reports meant for them.
     * Department admins are left out: they can't open the school inbox.
     */
    public static function admins(?int $schoolId = null): Collection
    {
        $schoolId ??= Tenant::id();

        return User::withoutGlobalScope('school')->where('school_id', $schoolId)->whereNotNull('school_id')
            ->where('role', User::ROLE_ADMIN)->whereNull('department_id')->where('is_active', true)->get();
    }
}
