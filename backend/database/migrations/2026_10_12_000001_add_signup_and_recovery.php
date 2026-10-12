<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Round 3 of the UI work:
 * - the college list of IDs can carry the student's name and section (sign-up fills them in);
 * - students accept the Data Privacy Notice when they sign up;
 * - "Forgot password?" requests that the admin resolves.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whitelisted_ids', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id_number');
            $table->foreignId('section_id')->nullable()->after('name')->constrained()->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('privacy_accepted_at')->nullable()->after('is_active');
        });

        Schema::create('password_reset_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('note', 255)->nullable();
            $table->enum('status', ['pending', 'resolved'])->default('pending')->index();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_requests');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('privacy_accepted_at'));
        Schema::table('whitelisted_ids', function (Blueprint $table) {
            $table->dropConstrainedForeignId('section_id');
            $table->dropColumn('name');
        });
    }
};
