<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notifications, the ID-number whitelist for registration, login audit log
 * and Professor JAG chat history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });

        Schema::create('whitelisted_ids', function (Blueprint $table) {
            $table->id();
            $table->string('id_number', 50)->unique();
            $table->string('notes', 150)->nullable();
            $table->timestamps();
        });

        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('login', 100)->index();
            $table->string('reason', 100);
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('attempted_at')->useCurrent()->index();
        });

        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant']);
            $table->text('content');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('login_attempts');
        Schema::dropIfExists('whitelisted_ids');
        Schema::dropIfExists('app_notifications');
    }
};
