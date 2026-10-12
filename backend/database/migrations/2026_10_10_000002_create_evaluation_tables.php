<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Evaluation periods, the question bank, submitted evaluations and their answers.
 *
 * evaluator_id is stored only to stop duplicate submissions. The API never
 * exposes it to teachers, so feedback stays anonymous.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('semester_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 60);                         // e.g. "Midterm"
            $table->enum('type', ['student', 'peer'])->default('student');
            $table->dateTime('opens_at');
            $table->dateTime('closes_at');
            $table->timestamps();

            $table->index(['type', 'opens_at', 'closes_at']);
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->enum('audience', ['student', 'peer'])->index(); // who answers it
            $table->string('category', 80)->nullable();          // e.g. "Clarity of instruction"
            $table->string('text', 500);
            $table->enum('type', ['rating', 'text'])->default('rating');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_period_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('class_offering_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();   // person being evaluated
            $table->foreignId('evaluator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('evaluator_role', ['student', 'teacher']);
            $table->decimal('overall_rating', 3, 2)->nullable();
            $table->text('comment')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();

            $table->unique(['evaluator_id', 'teacher_id', 'class_offering_id', 'evaluation_period_id'], 'evaluation_unique');
            $table->index(['teacher_id', 'evaluator_role']);
        });

        Schema::create('evaluation_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating')->nullable();   // 1-5
            $table->text('answer_text')->nullable();
            $table->timestamps();

            $table->unique(['evaluation_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_answers');
        Schema::dropIfExists('evaluations');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('evaluation_periods');
    }
};
