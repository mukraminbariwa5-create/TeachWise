<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AppInfoController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InviteController;
use App\Http\Controllers\Api\SchoolDirectoryController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\WiseController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Platform\PlatformController;
use App\Http\Controllers\Api\Student\StudentController;
use App\Http\Controllers\Api\Teacher\TeacherController;
use Illuminate\Support\Facades\Route;

/*
| TeachWise API — all routes are prefixed with /api.
| Authenticated routes need the header:  Authorization: Bearer <token>
*/

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('check-id', [AuthController::class, 'checkId'])->middleware('throttle:30,1,r1');
    Route::post('check-username', [AuthController::class, 'checkUsername'])->middleware('throttle:60,1,r2');
    Route::post('password-requests', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:5,1,r3');
    Route::post('invite', [InviteController::class, 'check'])->middleware('throttle:20,1,r4');
    Route::post('accept-invite', [InviteController::class, 'accept'])->middleware('throttle:login');
});

// Finding a school (sign-up, sign-in, join links) and applying to join TeachWise.
Route::get('schools', [SchoolDirectoryController::class, 'search'])->middleware('throttle:60,1,r5');
Route::get('schools/{code}', [SchoolDirectoryController::class, 'show'])->middleware('throttle:60,1,r6');
Route::post('schools/apply', [SchoolDirectoryController::class, 'apply'])->middleware('throttle:5,60,r7');
Route::get('schools/{id}/logo', [SchoolDirectoryController::class, 'logo'])->whereNumber('id');

// Section list of one school (?school_id=) for the registration screen.
Route::get('sections', [AuthController::class, 'sections']);

// App versions, school contacts, and crash reports (work signed in or not).
Route::get('app/info', [AppInfoController::class, 'info']);
Route::post('app/errors', [AppInfoController::class, 'reportError'])->middleware('throttle:20,1,r8');

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::put('auth/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1,r9');
    Route::post('auth/refresh', [AccountController::class, 'refresh'])->middleware('throttle:10,1,r10');

    // The signed-in person's own account.
    Route::prefix('me')->group(function () {
        Route::get('settings', [AccountController::class, 'settings']);
        Route::put('settings', [AccountController::class, 'updateSettings']);
        Route::post('tips/{key}/seen', [AccountController::class, 'seenTip']);
        Route::put('profile', [AccountController::class, 'updateProfile']);
        Route::get('sessions', [AccountController::class, 'sessions']);
        Route::delete('sessions/others', [AccountController::class, 'revokeOtherSessions']);
        Route::delete('sessions/{id}', [AccountController::class, 'revokeSession'])->whereNumber('id');
        Route::post('push-tokens', [AccountController::class, 'registerPushToken']);
        Route::delete('push-tokens', [AccountController::class, 'removePushToken']);
        Route::get('export', [AccountController::class, 'export'])->middleware('throttle:5,1,r11');
        Route::post('delete', [AccountController::class, 'destroy'])->middleware('throttle:5,1,r12');
    });

    Route::post('support', [SupportController::class, 'store'])->middleware('throttle:10,1,r13');

    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);

    // Professor Wise chat (all roles)
    Route::middleware('role:admin,teacher,student')->group(function () {
        Route::get('wise/messages', [WiseController::class, 'index']);
        Route::post('wise/messages', [WiseController::class, 'send'])->middleware('throttle:20,1,r14');
        Route::delete('wise/messages', [WiseController::class, 'clear']);
    });

    Route::middleware('role:student')->prefix('student')->group(function () {
        Route::get('dashboard', [StudentController::class, 'dashboard']);
        Route::get('offerings/{offering}/form', [StudentController::class, 'form']);
        Route::post('evaluations', [StudentController::class, 'submit']);
        Route::get('history', [StudentController::class, 'history']);
    });

    Route::middleware('role:teacher')->prefix('teacher')->group(function () {
        Route::get('dashboard', [TeacherController::class, 'dashboard']);
        Route::get('report', [TeacherController::class, 'report']);
        Route::get('feedback', [TeacherController::class, 'feedback']);
        Route::get('peers/{peer}/form', [TeacherController::class, 'peerForm']);
        Route::post('peer-evaluations', [TeacherController::class, 'submitPeer']);
    });

    Route::middleware('role:admin')->prefix('admin')->group(function () {
        // School admins and department admins (each limited to their department).
        Route::get('dashboard', [Admin\DashboardController::class, 'index']);
        Route::get('school', [Admin\SchoolController::class, 'show']);
        Route::get('departments', [Admin\DepartmentController::class, 'index']);
        Route::apiResource('users', Admin\UserController::class)->except('store');
        Route::post('users/{user}/temporary-password', [Admin\UserController::class, 'temporaryPassword']);
        Route::apiResource('subjects', Admin\SubjectController::class)->except('show');
        Route::apiResource('sections', Admin\SectionController::class)->except('show');
        Route::apiResource('offerings', Admin\OfferingController::class)->except('show');
        Route::get('semesters', [Admin\SemesterController::class, 'index']);
        Route::get('questions', [Admin\QuestionController::class, 'index']);
        Route::get('periods', [Admin\PeriodController::class, 'index']);
        Route::apiResource('whitelist', Admin\WhitelistController::class)->only(['index', 'store', 'destroy']);
        Route::apiResource('invites', Admin\InviteController::class)->only(['index', 'store', 'destroy']);
        Route::post('import/classes', [Admin\ImportController::class, 'classes']);
        Route::get('password-requests', [Admin\PasswordRequestController::class, 'index']);
        Route::post('password-requests/{passwordRequest}/resolve', [Admin\PasswordRequestController::class, 'resolve']);
        Route::get('reports/faculty.csv', [Admin\ReportController::class, 'facultyCsv']);
        Route::get('reports/faculty/{teacher}', [Admin\ReportController::class, 'faculty']);

        // Whole-school admins only.
        Route::middleware('school_admin')->group(function () {
            Route::put('school', [Admin\SchoolController::class, 'update']);
            Route::post('school/logo', [Admin\SchoolController::class, 'uploadLogo']);
            Route::delete('school/logo', [Admin\SchoolController::class, 'removeLogo']);
            Route::get('school/export', [Admin\SchoolController::class, 'export']);
            Route::post('school/deletion-request', [Admin\SchoolController::class, 'requestDeletion']);
            Route::apiResource('departments', Admin\DepartmentController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('programs', Admin\ProgramController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('semesters', Admin\SemesterController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('questions', Admin\QuestionController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('periods', Admin\PeriodController::class)->only(['store', 'update', 'destroy']);
            Route::post('reminders', [Admin\DashboardController::class, 'sendReminders']);
            Route::get('activity', [Admin\ActivityController::class, 'auditLog']);
            Route::get('inbox', [Admin\ActivityController::class, 'inbox']);
            Route::post('inbox/{message}/close', [Admin\ActivityController::class, 'closeMessage']);
            Route::get('app-errors', [Admin\ActivityController::class, 'errors']);
        });
    });

    // The TeachWise owner's console.
    Route::middleware('role:platform')->prefix('platform')->group(function () {
        Route::get('overview', [PlatformController::class, 'overview']);
        Route::get('schools', [PlatformController::class, 'schools']);
        Route::get('schools/{school}', [PlatformController::class, 'show']);
        Route::post('schools/{school}/approve', [PlatformController::class, 'approve']);
        Route::post('schools/{school}/reject', [PlatformController::class, 'reject']);
        Route::post('schools/{school}/invite-admin', [PlatformController::class, 'inviteAdmin']);
        Route::post('schools/{school}/suspend', [PlatformController::class, 'suspend']);
        Route::post('schools/{school}/activate', [PlatformController::class, 'activate']);
        Route::delete('schools/{school}', [PlatformController::class, 'destroy']);
        Route::get('errors', [PlatformController::class, 'errors']);
        Route::get('messages', [PlatformController::class, 'messages']);
        Route::post('messages/{message}/close', [PlatformController::class, 'closeMessage']);
    });
});
