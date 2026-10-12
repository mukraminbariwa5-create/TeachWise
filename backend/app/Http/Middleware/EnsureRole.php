<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to one or more roles: ->middleware('role:admin') or 'role:teacher,admin'.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You do not have access to this resource.'], 403);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Your account is deactivated.'], 403);
        }

        return $next($request);
    }
}
