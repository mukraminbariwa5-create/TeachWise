<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\AdminScope;
use App\Http\Controllers\Controller;
use App\Models\Evaluation;
use App\Models\Question;
use App\Models\User;
use App\Services\FacultyReport;
use App\Services\RatingStats;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /** Full report for one teacher: student ratings, peer ratings, per-class numbers, trend and comments. */
    public function faculty(Request $request, User $teacher): JsonResponse
    {
        abort_unless($teacher->isTeacher(), 404);
        AdminScope::check(AdminScope::users(User::whereKey($teacher->id))->exists());

        return response()->json(FacultyReport::build($teacher, $request->integer('period_id') ?: null));
    }

    /**
     * CSV of every teacher's average rating and response count, plus their average for each
     * student question category. Starts with a UTF-8 marker so Excel shows names like "Peñaflor" correctly.
     */
    public function facultyCsv(Request $request): StreamedResponse
    {
        $periodId = $request->integer('period_id') ?: null;
        $categories = Question::for('student')->where('type', 'rating')->orderBy('sort_order')->get()
            ->map(fn (Question $q) => $q->category ?: $q->text)->unique()->values();

        return response()->streamDownload(function () use ($periodId, $categories) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['ID Number', 'Name', 'Department', 'Student responses', 'Student average', 'Peer responses', 'Peer average', ...$categories->all()]);
            AdminScope::users(User::query())->where('role', User::ROLE_TEACHER)->orderBy('name')->each(function (User $t) use ($out, $periodId, $categories) {
                $student = new RatingStats($t->id, $periodId, 'student');
                $s = $student->overall();
                $p = (new RatingStats($t->id, $periodId, 'teacher'))->overall();
                $byCategory = collect($student->byCriteriaEnglish())->pluck('average', 'category');
                fputcsv($out, [
                    $t->id_number, $t->name, $t->department, $s['responses'], $s['average'], $p['responses'], $p['average'],
                    ...$categories->map(fn ($c) => $byCategory[$c] ?? '')->all(),
                ]);
            });
            fclose($out);
        }, 'teachwise-faculty-report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
