<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100)->default('New conversation');
            $table->timestamps();
            $table->index(['user_id', 'updated_at']);
        });
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->foreignId('conversation_id')->nullable()->constrained('chat_conversations')->cascadeOnDelete();
        });
        // Preserve every existing turn as one earlier conversation for its owner.
        DB::table('chat_messages')->select('user_id')->distinct()->orderBy('user_id')->chunk(100, function ($owners) {
            foreach ($owners as $owner) {
                $messages = DB::table('chat_messages')->where('user_id', $owner->user_id);
                $id = DB::table('chat_conversations')->insertGetId([
                    'user_id' => $owner->user_id, 'title' => 'Earlier conversation',
                    'created_at' => (clone $messages)->min('created_at') ?? now(),
                    'updated_at' => (clone $messages)->max('created_at') ?? now(),
                ]);
                $messages->update(['conversation_id' => $id]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', fn (Blueprint $table) => $table->dropConstrainedForeignId('conversation_id'));
        Schema::dropIfExists('chat_conversations');
    }
};
