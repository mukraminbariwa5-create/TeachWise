<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Academic structure: semesters, sections, subjects, student profiles and
 * class offerings (which teacher teaches which subject to which section).
 *
 * Replaces the old teacher_subjects / student_subjects / student_details /
 * class_assignments / teacher_assignments tables with one consistent model.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('semesters', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);              // e.g. "1st Semester 2026-2027"
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('course', 20);            // e.g. "BSIT"
            $table->unsignedTinyInteger('year_level');
            $table->string('name', 10);              // e.g. "A"
            $table->timestamps();

            $table->unique(['course', 'year_level', 'name']);
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->nullable()->unique();   // e.g. "IT 305"
            $table->string('name', 150);
            $table->unsignedTinyInteger('year_level')->nullable();
            $table->unsignedTinyInteger('units')->default(3);
            $table->timestamps();
        });

        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('class_offerings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('section_id')->constrained()->cascadeOnDelete();
            $table->foreignId('semester_id')->nullable()->constrained()->nullOnDelete();
            $table->string('schedule', 60)->nullable();         // e.g. "TTh 1:00-2:30pm"
            $table->timestamps();

            $table->unique(['teacher_id', 'subject_id', 'section_id', 'semester_id'], 'offering_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_offerings');
        Schema::dropIfExists('student_profiles');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('semesters');
    }
};
