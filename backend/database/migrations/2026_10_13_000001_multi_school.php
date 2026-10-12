<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TeachWise for many schools.
 *
 * Adds schools, departments, programs and invites, and puts a school_id on every
 * school-owned table. An existing single-school install is moved into one school,
 * so nothing is lost. ID numbers and subject codes become unique per school.
 */
return new class extends Migration
{
    /** Tables whose rows belong to one school. */
    private array $owned = [
        'users', 'semesters', 'sections', 'subjects', 'class_offerings', 'evaluation_periods',
        'questions', 'evaluations', 'whitelisted_ids', 'audit_logs', 'support_messages',
        'password_reset_requests', 'client_errors',
    ];

    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('short_name', 40)->nullable();
            $table->string('code', 20)->unique();
            $table->string('location', 120)->nullable();
            $table->string('logo_path')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_email', 150)->nullable();
            $table->string('contact_phone', 30)->nullable();
            $table->string('contact_position', 80)->nullable();
            $table->unsignedInteger('student_count')->nullable();
            $table->text('message')->nullable();
            $table->json('settings')->nullable();
            $table->string('suspended_reason', 255)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('code', 20)->nullable();
            $table->timestamps();
            $table->unique(['school_id', 'name']);
        });

        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 150);
            $table->string('code', 20);
            $table->timestamps();
            $table->unique(['school_id', 'code']);
        });

        Schema::create('invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 150)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('id_number', 30)->nullable();
            $table->string('code', 20)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('used_at')->nullable();
            $table->foreignId('used_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        foreach ($this->owned as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('school_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }

        // Roles become a plain string so "platform" (the TeachWise owner) fits.
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->change();
            $table->foreignId('department_id')->nullable()->after('department')->constrained()->nullOnDelete();
        });
        Schema::table('sections', function (Blueprint $table) {
            $table->foreignId('program_id')->nullable()->after('school_id')->constrained()->nullOnDelete();
        });
        Schema::table('subjects', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('school_id')->constrained()->nullOnDelete();
        });

        $this->moveExistingDataIntoOneSchool();

        // Unique per school instead of across all of TeachWise.
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['id_number']);
            $table->unique(['school_id', 'id_number']);
        });
        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique(['course', 'year_level', 'name']);
            $table->unique(['school_id', 'course', 'year_level', 'name']);
        });
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->unique(['school_id', 'code']);
        });
        Schema::table('whitelisted_ids', function (Blueprint $table) {
            $table->dropUnique(['id_number']);
            $table->unique(['school_id', 'id_number']);
        });
    }

    /** A single-school install becomes the first school, with its current settings. */
    private function moveExistingDataIntoOneSchool(): void
    {
        $hasData = DB::table('users')->exists() || DB::table('sections')->exists() || DB::table('evaluations')->exists();
        if (! $hasData) {
            return;
        }

        $name = (string) config('teachwise.school_name', 'My School');
        $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'SCHOOL', 0, 12));
        $schoolId = DB::table('schools')->insertGetId([
            'name' => $name,
            'short_name' => mb_substr($name, 0, 40),
            'code' => $code,
            'status' => 'active',
            'settings' => json_encode([
                'support_email' => config('teachwise.support_email'),
                'dpo_email' => config('teachwise.dpo_email'),
                'setup_completed' => true,
            ]),
            'approved_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($this->owned as $name) {
            DB::table($name)->whereNull('school_id')->update(['school_id' => $schoolId]);
        }
    }

    public function down(): void
    {
        if (DB::table('schools')->count() > 1) {
            throw new RuntimeException('This database has more than one school, so it cannot go back to the single-school version.');
        }

        Schema::table('whitelisted_ids', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'id_number']);
            $table->unique(['id_number']);
        });
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'code']);
            $table->unique(['code']);
            $table->dropConstrainedForeignId('department_id');
        });
        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'course', 'year_level', 'name']);
            $table->unique(['course', 'year_level', 'name']);
            $table->dropConstrainedForeignId('program_id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'id_number']);
            $table->unique(['id_number']);
            $table->dropConstrainedForeignId('department_id');
        });
        foreach (array_reverse($this->owned) as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropConstrainedForeignId('school_id');
            });
        }
        Schema::dropIfExists('invites');
        Schema::dropIfExists('programs');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('schools');
    }
};
