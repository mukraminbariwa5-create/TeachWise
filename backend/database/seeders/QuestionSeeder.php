<?php

namespace Database\Seeders;

use App\Models\School;
use App\Services\QuestionBank;
use Illuminate\Database\Seeder;

/** Makes sure every school has the default evaluation questions (never overwrites edits). */
class QuestionSeeder extends Seeder
{
    public function run(): void
    {
        School::all()->each(fn (School $school) => QuestionBank::install($school));
    }
}
