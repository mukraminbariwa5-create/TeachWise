<?php

namespace App\Services;

use App\Models\Question;
use App\Models\School;
use App\Support\Tenant;

/**
 * The ready-made evaluation form every new school starts with (English and Filipino).
 * Schools can edit, add or switch off questions afterwards.
 */
class QuestionBank
{
    /** [category, text, Filipino category, Filipino text] */
    public const STUDENT = [
        ['Mastery of subject', 'The teacher explains the lessons clearly and with confidence.', 'Kahusayan sa asignatura', 'Malinaw at may kumpiyansang ipinapaliwanag ng guro ang mga aralin.'],
        ['Teaching methods', 'The teacher uses activities and examples that help me understand.', 'Paraan ng pagtuturo', 'Gumagamit ang guro ng mga gawain at halimbawa na nakakatulong sa aking pag-unawa.'],
        ['Clarity of instruction', 'Instructions for activities, projects and exams are easy to follow.', 'Linaw ng mga tagubilin', 'Madaling sundin ang mga tagubilin para sa gawain, proyekto at pagsusulit.'],
        ['Classroom management', 'The teacher starts and ends class on time and keeps order.', 'Pamamahala sa klase', 'Nagsisimula at nagtatapos sa oras ang klase at napapanatili ng guro ang kaayusan.'],
        ['Fairness in grading', 'Quizzes and grades are fair and match what was taught.', 'Pagiging patas sa grado', 'Patas ang mga quiz at grado at tugma sa itinuro.'],
    ];

    public const PEER = [
        ['Subject expertise', 'Shows strong command of the subjects we share.', 'Kahusayan sa asignatura', 'Mahusay sa mga asignaturang pareho naming itinuturo.'],
        ['Collaboration', 'Works well with colleagues on syllabi, exams and department tasks.', 'Pakikipagtulungan', 'Mahusay makipagtulungan sa kapwa guro sa syllabus, pagsusulit at gawain ng departamento.'],
        ['Professionalism', 'Meets deadlines and follows department policies.', 'Propesyonalismo', 'Tumutupad sa mga deadline at sumusunod sa patakaran ng departamento.'],
        ['Mentoring', 'Shares materials and helps colleagues improve their teaching.', 'Paggabay', 'Nagbabahagi ng materyales at tumutulong sa kapwa guro na mapabuti ang pagtuturo.'],
    ];

    /** Adds any missing default questions to a school, and Filipino wording where it's empty. */
    public static function install(School $school): void
    {
        Tenant::run($school->id, function () {
            foreach (['student' => self::STUDENT, 'peer' => self::PEER] as $audience => $rows) {
                foreach ($rows as $i => [$category, $text, $categoryFil, $textFil]) {
                    $q = Question::firstOrCreate(
                        ['audience' => $audience, 'text' => $text],
                        ['category' => $category, 'type' => 'rating', 'sort_order' => $i + 1]
                    );
                    $q->fill(array_filter(['category_fil' => $q->category_fil ?: $categoryFil, 'text_fil' => $q->text_fil ?: $textFil]))->save();
                }
            }
        });
    }
}
