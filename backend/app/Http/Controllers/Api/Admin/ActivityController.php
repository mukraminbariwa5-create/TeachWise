<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ClientError;
use App\Models\SupportMessage;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The admin's activity log, support inbox and app error reports. */
class ActivityController extends Controller
{
    public function auditLog(Request $request): JsonResponse
    {
        $data = $request->validate(['action' => ['nullable', 'string', 'max:60'], 'search' => ['nullable', 'string', 'max:100']]);

        $page = AuditLog::query()
            ->with('user')
            ->when($data['action'] ?? null, fn ($q, $a) => $q->where('action', 'like', "{$a}%"))
            ->when($data['search'] ?? null, fn ($q, $s) => $q->where('description', 'like', "%{$s}%"))
            ->latest('id')
            ->paginate(30);

        $page->getCollection()->transform(fn (AuditLog $l) => [
            'id' => $l->id,
            'action' => $l->action,
            'description' => $l->description,
            'user' => $l->user ? Present::person($l->user) : null,
            'ip_address' => $l->ip_address,
            'created_at' => $l->created_at?->toIso8601String(),
        ]);

        return response()->json($page);
    }

    public function inbox(Request $request): JsonResponse
    {
        $status = $request->query('status', 'open');
        $page = SupportMessage::query()
            ->with('user.studentProfile.section')
            ->when(in_array($status, ['open', 'closed'], true), fn ($q) => $q->where('status', $status))
            ->where(fn ($q) => $q->whereNull('meta')->orWhereNull('meta->to'))
            ->latest('id')
            ->paginate(30);

        $page->getCollection()->transform(fn (SupportMessage $m) => [
            'id' => $m->id,
            'kind' => $m->kind,
            'message' => $m->message,
            'meta' => $m->meta,
            'status' => $m->status,
            'created_at' => $m->created_at?->toIso8601String(),
            'user' => $m->user ? Present::user($m->user) : null,
        ]);

        return response()->json(array_merge($page->toArray(), ['open_count' => SupportMessage::where('status', 'open')->where(fn ($q) => $q->whereNull('meta')->orWhereNull('meta->to'))->count()]));
    }

    public function closeMessage(SupportMessage $message): JsonResponse
    {
        $message->update(['status' => 'closed']);

        return response()->json(['message' => 'Marked as done.']);
    }

    public function errors(): JsonResponse
    {
        return response()->json(ClientError::latest('id')->paginate(30));
    }
}
