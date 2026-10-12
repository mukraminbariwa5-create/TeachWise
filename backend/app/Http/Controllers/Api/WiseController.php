<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\WiseService;
use App\Support\Say;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Professor Wise chat, available to every role. */
class WiseController extends Controller
{
    public function index(Request $request, WiseService $wise): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'greeting' => $wise->greeting($user),
            'tip' => $wise->tip($user),
            'suggestions' => $this->suggestions($user),
            'messages' => ChatMessage::where('user_id', $user->id)->latest('id')->limit(50)->get(['id', 'role', 'content', 'created_at'])->reverse()->values(),
        ]);
    }

    public function send(Request $request, WiseService $wise): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:1000']]);
        $user = $request->user();

        $answer = $wise->reply($user, $data['message']);

        $question = ChatMessage::create(['user_id' => $user->id, 'role' => 'user', 'content' => $data['message']]);
        $reply = ChatMessage::create(['user_id' => $user->id, 'role' => 'assistant', 'content' => $answer['reply']]);

        return response()->json([
            'question' => $question->only(['id', 'role', 'content', 'created_at']),
            'reply' => $reply->only(['id', 'role', 'content', 'created_at']),
            'source' => $answer['source'],
        ], 201);
    }

    public function clear(Request $request): JsonResponse
    {
        ChatMessage::where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'Chat history deleted.']);
    }

    private function suggestions(User $user): array
    {
        return match ($user->role) {
            User::ROLE_STUDENT => Say::fil()
                ? ['Paano mag-evaluate?', 'Kailan ang deadline?', 'Anonymous ba ang evaluation ko?', 'Sinong guro pa ang natitira?']
                : ['How do I evaluate?', 'When is the deadline?', 'Is my evaluation anonymous?', 'Which teachers are left?'],
            User::ROLE_TEACHER => ['Summarize my comments', 'What is my weakest area?', 'What is my strongest area?', 'What is my overall rating?'],
            default => ['Which section is behind?', 'Top-rated faculty', 'Who needs support?'],
        };
    }
}
