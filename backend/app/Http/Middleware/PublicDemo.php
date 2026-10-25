<?php

namespace App\Http\Middleware;

use App\Support\Say;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Public demo mode (TEACHWISE_PUBLIC_DEMO=true), for running TeachWise as an open portfolio demo.
 *
 * Everyone shares the same demo accounts, so the actions that would lock out or break the demo
 * for the next visitor are turned off: changing a password or profile, deleting an account,
 * resetting someone's password, deactivating or deleting people and records, changing the
 * school's settings or logo, and the owner removing or pausing schools.
 * Everything else (evaluating, reports, adding classes, invites, questions) works normally.
 * The demo server rebuilds its data from scratch every time it starts.
 */
class PublicDemo
{
    /** [method, path pattern] pairs that are blocked. Patterns use Request::is() wildcards. */
    private const BLOCKED = [
        ['PUT', 'api/auth/password'],
        ['PUT', 'api/me/profile'],
        ['POST', 'api/me/delete'],
        ['POST', 'api/auth/password-requests'],
        ['POST', 'api/admin/users/*/temporary-password'],
        ['PUT', 'api/admin/users/*'],
        ['PATCH', 'api/admin/users/*'],
        ['DELETE', 'api/admin/*'],
        ['PUT', 'api/admin/school'],
        ['POST', 'api/admin/school/logo'],
        ['POST', 'api/admin/school/deletion-request'],
        ['POST', 'api/admin/password-requests/*/resolve'],
        ['POST', 'api/platform/schools/*/suspend'],
        ['POST', 'api/platform/schools/*/reject'],
        ['DELETE', 'api/platform/*'],
    ];

    public static function enabled(): bool
    {
        return (bool) config('teachwise.public_demo', false);
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (self::enabled()) {
            foreach (self::BLOCKED as [$method, $pattern]) {
                if ($request->isMethod($method) && $request->is($pattern)) {
                    return response()->json([
                        'message' => Say::it(
                            'This is a public demo shared by everyone, so this can\'t be changed here. Everything else works: try evaluating, reports and the admin tools.',
                            'Pampublikong demo ito na gamit ng lahat, kaya hindi ito mababago rito. Gumagana ang lahat ng iba pa: subukan ang pag-evaluate, mga report at mga admin tool.'
                        ),
                        'demo' => true,
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
