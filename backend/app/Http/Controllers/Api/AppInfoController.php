<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientError;
use App\Models\School;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public app information (versions, school, contacts) and crash reports from the app. */
class AppInfoController extends Controller
{
    /**
     * Versions and contacts. Signed in (or with ?school_id=), the school's own name and contacts;
     * otherwise TeachWise's.
     */
    public function info(Request $request): JsonResponse
    {
        $school = Tenant::school() ?? ($request->integer('school_id') ? School::where('status', School::ACTIVE)->find($request->integer('school_id')) : null);
        $settings = $school?->allSettings() ?? [];

        return response()->json([
            'school_name' => $school?->name ?? config('teachwise.platform_name'),
            'school' => $school?->publicInfo(),
            'support_email' => ($settings['support_email'] ?? null) ?: config('teachwise.support_email'),
            'dpo_email' => ($settings['dpo_email'] ?? null) ?: config('teachwise.dpo_email'),
            'platform_email' => config('teachwise.support_email'),
            'latest_version' => config('teachwise.latest_app_version'),
            'min_version' => config('teachwise.min_app_version'),
            'store_url' => config('teachwise.store_url'),
        ]);
    }

    /** The app sends crashes here so they reach the admin with the screen and version. */
    public function reportError(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'stack' => ['nullable', 'string', 'max:20000'],
            'screen' => ['nullable', 'string', 'max:120'],
            'platform' => ['nullable', 'string', 'max:20'],
            'app_version' => ['nullable', 'string', 'max:20'],
        ]);

        ClientError::create([
            'user_id' => auth('sanctum')->id(),
            'message' => mb_substr($data['message'], 0, 500),
            'stack' => isset($data['stack']) ? mb_substr($data['stack'], 0, 20000) : null,
            'screen' => $data['screen'] ?? null,
            'platform' => $data['platform'] ?? null,
            'app_version' => $data['app_version'] ?? null,
        ]);

        return response()->json(['message' => 'Thanks, reported.'], 201);
    }
}
