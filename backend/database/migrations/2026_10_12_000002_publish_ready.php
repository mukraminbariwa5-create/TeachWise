<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Everything a published app needs on the server:
 * per-account settings, an activity log, support messages, push tokens,
 * crash reports from the app, Filipino question text, and notification bookkeeping.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('privacy_accepted_at');
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->string('category_fil', 80)->nullable()->after('category');
            $table->string('text_fil', 500)->nullable()->after('text');
        });

        Schema::table('evaluation_periods', function (Blueprint $table) {
            $table->timestamp('announced_at')->nullable()->after('closes_at');
            $table->timestamp('reminded_at')->nullable()->after('announced_at');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 60)->index();
            $table->string('description', 255);
            $table->string('subject_type', 60)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('meta')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('kind', ['contact', 'problem'])->default('contact');
            $table->text('message');
            $table->json('meta')->nullable();
            $table->enum('status', ['open', 'closed'])->default('open')->index();
            $table->timestamps();
        });

        Schema::create('push_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('platform', 20)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });

        Schema::create('client_errors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('message', 500);
            $table->text('stack')->nullable();
            $table->string('screen', 120)->nullable();
            $table->string('platform', 20)->nullable();
            $table->string('app_version', 20)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_errors');
        Schema::dropIfExists('push_tokens');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('audit_logs');
        Schema::table('evaluation_periods', fn (Blueprint $t) => $t->dropColumn(['announced_at', 'reminded_at']));
        Schema::table('questions', fn (Blueprint $t) => $t->dropColumn(['category_fil', 'text_fil']));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('settings'));
    }
};
