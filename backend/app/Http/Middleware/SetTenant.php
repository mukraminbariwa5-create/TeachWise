<?php

namespace App\Http\Middleware;

use App\Models\School;
use App\Support\Say;
use App\Support\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Puts each request inside the signed-in person's school, before route models are loaded,
 * so nobody can reach another school's records, even by changing IDs in a request.
 * Suspended schools are stopped here.
 */
class SetTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $previous = Tenant::id();
        Tenant::set(null);
        $user = auth('sanctum')->user();

        if ($user && $user->school_id) {
            Tenant::set($user->school_id);
            $school = Tenant::school();
            if (! $school || $school->status === School::SUSPENDED) {
                Tenant::set($previous);

                return response()->json([
                    'message' => Say::it(
                        'Your school’s TeachWise account is paused. Please contact your school administrator.',
                        'Naka-pause ang TeachWise account ng paaralan mo. Makipag-ugnayan sa admin ng paaralan.'
                    ),
                    'school_suspended' => true,
                ], 403);
            }
        }

        try {
            return $next($request);
        } finally {
            Tenant::set($previous);
        }
    }
}
