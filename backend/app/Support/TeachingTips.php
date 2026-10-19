<?php

namespace App\Support;

use App\Models\Question;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * "What to work on": turns a teacher's lowest-rated criteria into a few concrete, small things to try.
 * Tips are matched on the question's English category, so they work for every school's wording
 * and are shown in English or Filipino.
 */
class TeachingTips
{
    /**
     * The weakest criterion, plus the second weakest when it is also below 4.
     * Nothing when everything is rated 4.5 or higher (no point nagging a great teacher).
     *
     * @param  Collection<int, array{question_id:int, category:string, average:float}>  $criteria
     * @return array<int, array{question_id:int, category:string, average:float, tips:array<int,string>}>
     */
    public static function focus(Collection $criteria): array
    {
        if ($criteria->count() < 2) {
            return [];
        }

        $sorted = $criteria->sortBy('average')->values();
        $picked = $sorted->take(2)->filter(fn ($c, $i) => $c['average'] < ($i === 0 ? 4.5 : 4.0));
        $english = Question::whereIn('id', $picked->pluck('question_id'))->pluck('category', 'id');

        return $picked->map(fn ($c) => [
            'question_id' => $c['question_id'],
            'category' => $c['category'],
            'average' => $c['average'],
            'tips' => self::for((string) ($english[$c['question_id']] ?? $c['category'])),
        ])->values()->all();
    }

    /** Three small, practical ideas for one criterion. */
    public static function for(string $category): array
    {
        $c = Str::lower($category);

        return match (true) {
            Str::contains($c, ['clarity', 'instruction']) => [
                Say::it('Give each project a one-page checklist with the deliverables and the deadline.', 'Bigyan ang bawat proyekto ng isang-pahinang checklist ng mga ipapasa at deadline.'),
                Say::it('End each class with a 2-minute recap of the key points.', 'Tapusin ang bawat klase sa 2 minutong pagbubuod ng mahahalagang punto.'),
                Say::it('Before exams, show one sample question in the same format.', 'Bago ang pagsusulit, magpakita ng isang halimbawang tanong na pareho ang format.'),
            ],
            Str::contains($c, 'method') => [
                Say::it('Break long lectures with a 5-minute activity or a real-world example.', 'Hatiin ang mahabang lecture gamit ang 5 minutong gawain o totoong halimbawa.'),
                Say::it('Ask a quick check-for-understanding question every 15 minutes.', 'Magtanong ng mabilis na tanong para masuri ang pag-unawa bawat 15 minuto.'),
                Say::it('Let students explain a concept to a seatmate, then discuss.', 'Ipaliwanag ng mga estudyante ang isang konsepto sa katabi, saka pag-usapan.'),
            ],
            Str::contains($c, 'management') => [
                Say::it('Start and end on time, even when a few students are late.', 'Magsimula at magtapos sa oras, kahit may ilang huli.'),
                Say::it('Agree on 3 simple class rules at the start of the term and stick to them.', 'Magkasundo sa 3 simpleng patakaran sa simula ng term at panindigan ito.'),
                Say::it('Post the plan for the day on the board so everyone knows what’s next.', 'Isulat sa pisara ang plano sa araw na iyon para alam ng lahat ang susunod.'),
            ],
            Str::contains($c, ['grading', 'fair']) => [
                Say::it('Share the rubric before the activity, not after.', 'Ibahagi ang rubric bago ang gawain, hindi pagkatapos.'),
                Say::it('Return checked work with one line on how the score was given.', 'Ibalik ang na-check na gawa na may isang linya kung paano ibinigay ang marka.'),
                Say::it('Make sure quiz items only cover what was taught.', 'Siguraduhing ang mga tanong sa quiz ay tungkol lang sa itinuro.'),
            ],
            Str::contains($c, ['mastery', 'expertise']) => [
                Say::it('Prepare two real-world examples for each topic.', 'Maghanda ng dalawang totoong halimbawa sa bawat paksa.'),
                Say::it('Invite questions and answer the hard ones the next meeting if needed.', 'Mag-imbita ng tanong, at sagutin ang mahihirap sa susunod na klase kung kailangan.'),
                Say::it('Link each lesson to what students will use it for.', 'Iugnay ang bawat aralin sa kung saan ito magagamit ng mga estudyante.'),
            ],
            default => [
                Say::it('Ask three students what would help them most in this area.', 'Tanungin ang tatlong estudyante kung ano ang pinakamakakatulong sa kanila rito.'),
                Say::it('Try one small change for two weeks, then check the next evaluation.', 'Subukan ang isang maliit na pagbabago sa loob ng dalawang linggo, saka tingnan ang susunod na evaluation.'),
                Say::it('Ask a colleague who scores well here what they do.', 'Tanungin ang kasamahang mataas ang rating dito kung ano ang ginagawa nila.'),
            ],
        };
    }
}
