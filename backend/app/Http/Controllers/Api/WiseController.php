<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatConversation;
use App\Models\User;
use App\Services\WiseService;
use App\Support\Say;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Professor Wise chat, available to every role. */
class WiseController extends Controller
{
    public function index(Request $request, WiseService $wise): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['conversation_id' => ['nullable', 'integer', 'min:1'], 'before_id' => ['nullable', 'integer', 'min:1']]);
        $conversation = $this->findConversation($user, $data['conversation_id'] ?? null);
        $recent = ChatMessage::where('user_id', $user->id)->where('conversation_id', $conversation?->id)
            ->when(isset($data['before_id']), fn ($query) => $query->where('id', '<', $data['before_id']))
            ->latest('id')->limit(51)->get(['id', 'role', 'content', 'created_at']);
        $summary = $wise->summary($user);

        return response()->json([
            'greeting' => $summary['greeting'],
            'tip' => $summary['tip'],
            'suggestions' => $this->suggestions($user),
            'conversation' => $conversation ? $this->conversationData($conversation) : null,
            'messages' => $recent->take(50)->reverse()->values(),
            'has_more_messages' => $recent->count() > 50,
        ]);
    }

    public function conversations(Request $request): JsonResponse
    {
        return response()->json(ChatConversation::where('user_id', $request->user()->id)
            ->select(['id', 'title', 'created_at', 'updated_at'])->withCount('messages')
            ->orderByDesc('updated_at')->orderByDesc('id')->paginate(20));
    }

    public function createConversation(Request $request): JsonResponse
    {
        return $this->withConversationLock($request->user(), function () use ($request) {
            $conversation = ChatConversation::create(['user_id' => $request->user()->id, 'title' => Say::it('New conversation', 'Bagong usapan')]);

            return response()->json(['conversation' => $this->conversationData($conversation)], 201);
        });
    }

    public function destroyConversation(Request $request, int $conversation): JsonResponse
    {
        return $this->withConversationLock($request->user(), function () use ($request, $conversation) {
            ChatConversation::where('user_id', $request->user()->id)->findOrFail($conversation)->delete();

            return response()->json(['message' => 'Conversation deleted.']);
        });
    }

    public function send(Request $request, WiseService $wise): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'request_id' => ['nullable', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'conversation_id' => ['nullable', 'integer', 'min:1'],
        ]);
        $user = $request->user();

        return $this->withConversationLock($user, function () use ($wise, $user, $data) {
            $requestId = $data['request_id'] ?? null;
            if ($requestId) {
                $existing = ChatMessage::where('user_id', $user->id)->where('request_id', $requestId)->get()->keyBy('role');
                if (isset($existing['user'], $existing['assistant'])) {
                    abort_unless($existing['user']->content === $data['message'], 409, 'This request ID was already used for a different message.');
                    if (isset($data['conversation_id'])) {
                        $this->findConversation($user, $data['conversation_id']);
                        abort_unless((int) $existing['user']->conversation_id === (int) $data['conversation_id'], 409, 'This message belongs to a different conversation.');
                    }
                    $original = ChatConversation::where('user_id', $user->id)->findOrFail($existing['user']->conversation_id);

                    return $this->answerResponse($existing['user'], $existing['assistant'], $existing['assistant']->source ?? 'rules', $original);
                }
            }

            $conversation = $this->findConversation($user, $data['conversation_id'] ?? null)
                ?? ChatConversation::create(['user_id' => $user->id, 'title' => Say::it('New conversation', 'Bagong usapan')]);
            // Adopt legacy turns from older clients; never move another topic's messages.
            if (! isset($data['conversation_id'])) {
                ChatMessage::where('user_id', $user->id)->whereNull('conversation_id')->update(['conversation_id' => $conversation->id]);
            }
            $firstMessage = ! $conversation->messages()->exists();

            // The HTTP model call can outlast PHP's default web execution limit.
            @set_time_limit((int) config('services.ollama.timeout', 120) + 30);
            $answer = $wise->reply($user, $data['message'], $conversation->id);
            $nameAfterGreeting = $answer['source'] !== 'quick'
                && $conversation->messages()->where('source', 'quick')->exists()
                && ! $conversation->messages()->where('role', 'assistant')->where(fn ($query) => $query->whereNull('source')->orWhere('source', '!=', 'quick'))->exists();

            return DB::transaction(function () use ($user, $data, $requestId, $answer, $conversation, $firstMessage, $nameAfterGreeting) {
                $question = ChatMessage::create(['user_id' => $user->id, 'conversation_id' => $conversation->id, 'request_id' => $requestId, 'role' => 'user', 'content' => $data['message']]);
                $reply = ChatMessage::create(['user_id' => $user->id, 'conversation_id' => $conversation->id, 'request_id' => $requestId, 'role' => 'assistant', 'content' => $answer['reply'], 'source' => $answer['source']]);
                if ($firstMessage || $nameAfterGreeting) {
                    $conversation->title = Str::limit(preg_replace('/\s+/u', ' ', $data['message']), 70);
                }
                $conversation->touch();

                return $this->answerResponse($question, $reply, $answer['source'], $conversation);
            });
        });
    }

    private function answerResponse(ChatMessage $question, ChatMessage $reply, string $source, ChatConversation $conversation): JsonResponse
    {
        return response()->json([
            'question' => $question->only(['id', 'role', 'content', 'created_at']),
            'reply' => $reply->only(['id', 'role', 'content', 'created_at']),
            'source' => $source,
            'conversation' => $this->conversationData($conversation),
        ], 201);
    }

    public function clear(Request $request): JsonResponse
    {
        $data = $request->validate(['conversation_id' => ['nullable', 'integer', 'min:1']]);
        return $this->withConversationLock($request->user(), function () use ($request, $data) {
            $conversation = $this->findConversation($request->user(), $data['conversation_id'] ?? null);
            ChatMessage::where('user_id', $request->user()->id)->where('conversation_id', $conversation?->id)->delete();

            return response()->json(['message' => 'Chat history deleted.']);
        });
    }

    private function findConversation(User $user, ?int $id): ?ChatConversation
    {
        $query = ChatConversation::where('user_id', $user->id);

        return $id !== null ? $query->findOrFail($id) : $query->orderByDesc('updated_at')->orderByDesc('id')->first();
    }

    private function conversationData(ChatConversation $conversation): array
    {
        return $conversation->only(['id', 'title', 'created_at', 'updated_at'])
            + ['messages_count' => $conversation->messages()->count()];
    }

    private function withConversationLock(User $user, callable $callback): JsonResponse
    {
        $lock = Cache::lock('wise:conversation:'.$user->id, (int) config('services.ollama.timeout', 120) + 60);
        if (! $lock->get()) {
            return response()->json(['message' => Say::it(
                'Wise is still answering your previous message. Please wait and try again.',
                'Sinasagot pa ni Wise ang naunang mensahe mo. Maghintay muna at subukan ulit.'
            )], 409);
        }
        try {
            return $callback();
        } finally {
            $lock->release();
        }
    }

    private function suggestions(User $user): array
    {
        return match ($user->role) {
            User::ROLE_STUDENT => Say::fil()
                ? ['Paano mag-evaluate?', 'Nabibigatan ako sa mga gawain sa paaralan.', 'Kailan ang deadline?', 'Anonymous ba ang evaluation ko?']
                : ['How do I evaluate?', "I'm feeling overwhelmed with schoolwork.", 'When is the deadline?', 'Is my evaluation anonymous?'],
            User::ROLE_TEACHER => Say::fil()
                ? ['Paano hikayatin ang tahimik na klase?', 'Tulungan akong unawain ang feedback.', 'Ano ang pinakamahina kong area?', 'Ano ang pinakamalakas kong area?']
                : ['How can I engage a quiet class?', 'Help me reflect on my feedback.', 'What is my weakest area?', 'What is my strongest area?'],
            default => Say::fil()
                ? ['Paano ko susuportahan ang mga guro?', 'Aling section ang nahuhuli?', 'Sino ang nangangailangan ng suporta?']
                : ['How can I support teachers constructively?', 'Which section is behind?', 'Who needs support?'],
        };
    }
}
