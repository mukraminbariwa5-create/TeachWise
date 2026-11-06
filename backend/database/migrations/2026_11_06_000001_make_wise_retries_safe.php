<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->string('request_id', 64)->nullable();
            $table->string('source', 16)->nullable();
            $table->unique(['user_id', 'request_id', 'role'], 'wise_request_role_unique');
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropUnique('wise_request_role_unique');
            $table->dropColumn(['request_id', 'source']);
        });
    }
};
