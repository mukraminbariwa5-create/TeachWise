<?php

namespace App\Services;

use App\Models\ChatMessage;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Section;
use App\Models\User;
use App\Support\Say;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Professor Wise, the in-app assistant for every role.
 *
 * It first builds a short, factual summary of the user's own data (pending
 * evaluations, ratings, completion). With Ollama enabled, that summary is the
 * model's context. Without it, or if Ollama fails, Wise answers common
 * questions from the same summary using simple rules, so it always works.
 */
class WiseService
{
    /** @return array{reply: string, source: string} */
    public function reply(User $user, string $message): array
    {
        $facts = $this->facts($user);

        if (config('services.ollama.enabled')) {
            try {
                return ['reply' => $this->askOllama($user, $message, $facts), 'source' => 'ollama'];
            } catch (Throwable $e) {
                Log::warning('Professor Wise: Ollama unavailable, using built-in answers.', ['error' => $e->getMessage()]);
            }
        }

        return ['reply' => $this->ruleBasedReply($user, $message, $facts), 'source' => 'rules'];
    }

    public function greeting(User $user): string
    {
        $f = $this->facts($user);
        $first = Str::of($user->name)->replaceMatches('/^(Prof|Dr|Mr|Ms|Mrs|Engr)\.?\s+/i', '')->before(' ');

        return match ($user->role) {
            User::ROLE_STUDENT => $f['period'] && $f['pending']
                ? Say::it(
                    "Hi {$first}! You have {$f['pending']} pending evaluation(s) for {$f['period']}. Ask me anything about the process.",
                    "Hi {$first}! May {$f['pending']} ka pang evaluation para sa {$f['period']}. Magtanong ka lang tungkol sa proseso."
                )
                : Say::it("Hi {$first}! I can answer questions about teacher evaluations.", "Hi {$first}! Puwede mo akong tanungin tungkol sa teacher evaluations."),
            User::ROLE_TEACHER => $f['responses']
                ? "Hi Prof. {$this->surname($user)}! {$f['responses']} students have rated you this semester. Want a summary?"
                : "Hi Prof. {$this->surname($user)}! Your feedback summary will appear here once students submit evaluations.",
            default => "Hello! Midterm completion is at {$f['completion']}%. Ask me about faculty performance.",
        };
    }

    /** One short, personal tip for the dashboard card. */
    public function tip(User $user): string
    {
        $f = $this->facts($user);

        if ($user->isStudent()) {
            if (! $f['period']) {
                return Say::it('No evaluation period is scheduled yet. I will remind you when one opens.', 'Wala pang nakatakdang evaluation. Ipapaalala ko sa iyo kapag nagbukas na.');
            }
            if (! $f['period_open']) {
                return Say::it("The {$f['period']} evaluation opens on {$f['opens']}. Each one takes about 3 minutes.", "Magbubukas ang {$f['period']} evaluation sa {$f['opens']}. Mga 3 minuto lang bawat isa.");
            }
            if ($f['pending'] === 0) {
                return Say::it("You are all done for {$f['period']}. Thank you for helping your teachers improve!", "Tapos ka na para sa {$f['period']}. Salamat sa pagtulong sa mga guro mo na gumaling pa!");
            }
            $left = $f['pending'] === 1 ? Say::it('1 teacher', '1 guro') : Say::it("{$f['pending']} teachers", "{$f['pending']} guro");
            $minutes = $f['pending'] * 3;
            if ($f['hours_left'] !== null && $f['hours_left'] <= 24) {
                return Say::it(
                    "Only {$f['hours_left']} hours left! You still have {$left} to evaluate, about {$minutes} minutes in total.",
                    "{$f['hours_left']} oras na lang! May {$left} ka pang ie-evaluate, mga {$minutes} minuto lahat."
                );
            }

            return Say::it(
                "You have {$left} left. Each evaluation takes about 3 minutes, so you could finish in {$minutes} minutes.",
                "May {$left} ka pang natitira. Mga 3 minuto bawat evaluation, kaya matatapos mo ito sa loob ng {$minutes} minuto."
            );
        }

        if ($user->isTeacher()) {
            if (! $f['responses']) {
                return 'Your feedback summary will appear here once students submit evaluations.';
            }
            $w = $f['weakest'];

            return $w
                ? "Your lowest area is {$w['category']} ({$w['average']}). ".$this->tipFor($w['category'])
                : "Your overall rating is {$f['average']} from {$f['responses']} responses.";
        }

        $lowest = $f['sections'][0] ?? null;

        return $lowest
            ? "Completion is at {$f['completion']}%. {$lowest['label']} is lowest at {$lowest['percent']}%, so a reminder could help."
            : 'Assign classes to sections to start tracking completion.';
    }

    // ---------------------------------------------------------------- facts

    /** Plain facts about the user's own data, used by both answer modes. */
    private function facts(User $user): array
    {
        return match ($user->role) {
            User::ROLE_STUDENT => $this->studentFacts($user),
            User::ROLE_TEACHER => $this->teacherFacts($user),
            default => $this->adminFacts(),
        };
    }

    private function studentFacts(User $student): array
    {
        $student->loadMissing('studentProfile.section');
        $period = EvaluationPeriod::currentOrNext('student');
        $offerings = StudentClasses::offerings($student);
        $done = StudentClasses::evaluatedIds($student, $period);
        $pending = $offerings->reject(fn ($o) => in_array($o->id, $done, true));

        return [
            'section' => $student->studentProfile?->section?->label,
            'period' => $period?->name,
            'period_open' => (bool) $period?->is_open,
            'opens' => $period?->opens_at?->format('M j, g:i A'),
            'closes' => $period?->closes_at?->format('M j, g:i A'),
            'hours_left' => $period?->is_open ? max(0, (int) floor(now()->diffInMinutes($period->closes_at, false) / 60)) : null,
            'total' => $offerings->count(),
            'pending' => $pending->count(),
            'pending_list' => $pending->map(fn ($o) => "{$o->teacher->name} ({$o->subject->code})")->values()->all(),
        ];
    }

    private function teacherFacts(User $teacher): array
    {
        $stats = new RatingStats($teacher->id);
        $overall = $stats->overall();
        $criteria = $stats->byCriteria()->sortBy('average')->values();

        return [
            'average' => $overall['average'],
            'responses' => $overall['responses'],
            'criteria' => $criteria->map(fn ($c) => "{$c['category']}: {$c['average']}")->all(),
            'weakest' => $criteria->first(),
            'strongest' => $criteria->last(),
            'comments' => $stats->recentComments(8)->pluck('comment')->all(),
        ];
    }

    private function adminFacts(): array
    {
        $period = EvaluationPeriod::currentOrNext('student');

        $faculty = User::where('role', User::ROLE_TEACHER)
            ->withAvg(['evaluationsReceived as average' => fn ($q) => $q->where('evaluator_role', 'student')], 'overall_rating')
            ->withCount(['evaluationsReceived as responses' => fn ($q) => $q->where('evaluator_role', 'student')])
            ->get()
            ->filter(fn ($t) => $t->responses > 0)
            ->sortByDesc('average')
            ->values();

        $sections = Section::withCount('students')->get()->map(function (Section $s) use ($period) {
            $offeringIds = $s->offerings()->pluck('id');
            $expected = $offeringIds->count() * $s->students_count;
            $done = $period ? Evaluation::where('evaluation_period_id', $period->id)->whereIn('class_offering_id', $offeringIds)->count() : 0;

            return ['label' => $s->label, 'percent' => $expected ? (int) round($done / $expected * 100) : null, 'expected' => $expected, 'done' => $done];
        })->filter(fn ($s) => $s['percent'] !== null)->sortBy('percent')->values();

        $expected = $sections->sum('expected');

        return [
            'period' => $period?->name,
            'completion' => $expected ? (int) round($sections->sum('done') / $expected * 100) : 0,
            'sections' => $sections->all(),
            'top' => $faculty->take(3)->map(fn ($t) => "{$t->name} (".round($t->average, 2).')')->all(),
            'low' => $faculty->reverse()->take(3)->filter(fn ($t) => $t->average < 3.5)->map(fn ($t) => "{$t->name} (".round($t->average, 2).')')->values()->all(),
            'faculty_count' => $faculty->count(),
        ];
    }

    // --------------------------------------------------------------- ollama

    private function askOllama(User $user, string $message, array $facts): string
    {
        $history = ChatMessage::where('user_id', $user->id)->latest('id')->limit(10)->get()->reverse()
            ->map(fn ($m) => ['role' => $m->role, 'content' => $m->content])->values()->all();

        $role = match ($user->role) {
            User::ROLE_STUDENT => 'a student. Help them understand and complete teacher evaluations. Never reveal other students\' answers.',
            User::ROLE_TEACHER => 'a teacher. Give practical, kind advice to improve their teaching, based only on their feedback.',
            default => 'the college admin. Summarise faculty performance and evaluation progress.',
        };

        $system = "You are Professor Wise, the assistant inside TeachWise, a faculty evaluation app. You are talking to {$role} "
            .'Keep answers short (under 120 words), clear and friendly. Evaluations are anonymous: never guess who wrote a comment. '
            .(Say::fil() ? 'Reply in Filipino (Tagalog) using simple, everyday words; common English school terms are fine. ' : '')
            .'Only use these facts about the user and say so if something is not in them:'."\n"
            .json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $response = Http::timeout(config('services.ollama.timeout'))
            ->post(rtrim(config('services.ollama.endpoint'), '/').'/api/chat', [
                'model' => config('services.ollama.model'),
                'stream' => false,
                'messages' => array_merge([['role' => 'system', 'content' => $system]], $history, [['role' => 'user', 'content' => $message]]),
            ])
            ->throw();

        $reply = trim((string) data_get($response->json(), 'message.content'));
        if ($reply === '') {
            throw new \RuntimeException('Empty reply from Ollama.');
        }

        return $reply;
    }

    // ---------------------------------------------------------------- rules

    private function ruleBasedReply(User $user, string $message, array $f): string
    {
        $q = Str::lower($message);
        $has = fn (string ...$words) => Str::contains($q, $words);

        if ($user->isStudent()) {
            return match (true) {
                $has('anonym', 'my name', 'identity', 'see who', 'can see', 'privacy', 'private', 'pangalan', 'makikita', 'malalaman') => Say::it(
                    'Yes, your evaluation is anonymous. Teachers only see combined ratings and comments, never your name or ID number.',
                    'Oo, anonymous ang evaluation mo. Pinagsama-samang rating at komento lang ang nakikita ng mga guro, hindi ang pangalan o ID number mo.'
                ),
                $has('deadline', 'when', 'close', 'until', 'due', 'open', 'kailan', 'hanggang', 'sarado', 'bukas') => $f['period']
                    ? ($f['period_open']
                        ? Say::it("The {$f['period']} evaluation is open until {$f['closes']}.", "Bukas ang {$f['period']} evaluation hanggang {$f['closes']}.")
                        : Say::it("The {$f['period']} evaluation opens on {$f['opens']} and closes on {$f['closes']}.", "Magbubukas ang {$f['period']} evaluation sa {$f['opens']} at magsasara sa {$f['closes']}."))
                    : Say::it('There is no evaluation period scheduled right now. You will get a notification when one opens.', 'Walang nakatakdang evaluation ngayon. Makakatanggap ka ng notification kapag nagbukas na.'),
                $has('pending', 'left', 'remaining', 'who', 'which', 'teachers', 'natitira', 'sino', 'alin', 'guro') => $f['pending']
                    ? Say::it('You still need to evaluate: ', 'Kailangan mo pang i-evaluate: ').implode(', ', $f['pending_list']).'.'
                    : Say::it('You are all done. Thank you for evaluating all your teachers!', 'Tapos ka na. Salamat sa pag-evaluate sa lahat ng guro mo!'),
                $has('rating', 'scale', 'mean', 'score', 'ibig sabihin', 'marka') => Say::it(
                    'Ratings go from 1 to 5: 1 Poor, 2 Fair, 3 Good, 4 Very good, 5 Excellent. Rate based on your experience in class this semester.',
                    'Mula 1 hanggang 5 ang rating: 1 Mahina, 2 Katamtaman, 3 Mabuti, 4 Napakabuti, 5 Napakahusay. I-rate base sa naranasan mo sa klase ngayong semester.'
                ),
                $has('how', 'evaluate', 'start', 'steps', 'paano', 'simulan') => Say::it(
                    'Open Home, tap Evaluate next to a teacher, answer each question from 1 to 5, add an optional comment, then tap Submit. Each teacher can only be evaluated once per period.',
                    'Buksan ang Home, pindutin ang Evaluate sa tabi ng guro, sagutin ang bawat tanong mula 1 hanggang 5, magdagdag ng komento kung gusto mo, tapos pindutin ang Submit. Isang beses lang puwedeng i-evaluate ang bawat guro kada period.'
                ),
                $has('edit', 'change', 'undo', 'mistake', 'palitan', 'baguhin', 'mali') => Say::it(
                    'Submitted evaluations cannot be edited, to keep results fair. Please review your answers before tapping Submit.',
                    'Hindi na mababago ang naipasang evaluation para manatiling patas ang resulta. I-check muna ang mga sagot mo bago pindutin ang Submit.'
                ),
                default => Say::it(
                    'I can help with evaluation deadlines, which teachers are left, what the ratings mean, and whether your answers are anonymous. What would you like to know?',
                    'Matutulungan kita sa deadline ng evaluation, kung sinong guro pa ang natitira, ano ang ibig sabihin ng mga rating, at kung anonymous ang sagot mo. Ano ang gusto mong malaman?'
                ),
            };
        }

        if ($user->isTeacher()) {
            if (! $f['responses']) {
                return 'No student evaluations yet this semester. Once students submit, I can summarise your strengths and areas to improve.';
            }

            return match (true) {
                $has('weak', 'improve', 'lowest', 'better', 'raise') => $f['weakest']
                    ? "Your lowest area is {$f['weakest']['category']} ({$f['weakest']['average']}). ".$this->tipFor($f['weakest']['category'])
                    : 'I need a few more responses to find your weakest area.',
                $has('strong', 'best', 'highest', 'good at') => $f['strongest']
                    ? "Your strongest area is {$f['strongest']['category']} ({$f['strongest']['average']}). Keep doing what works there."
                    : 'I need a few more responses to find your strongest area.',
                $has('comment', 'summar', 'say', 'feedback') => $f['comments']
                    ? 'Recent comments include: "'.implode('" · "', array_slice($f['comments'], 0, 3)).'"'
                    : 'Students rated you but have not written comments yet.',
                $has('average', 'overall', 'rating', 'score') =>
                    "Your overall rating is {$f['average']} out of 5 from {$f['responses']} responses. By area: ".implode(', ', $f['criteria']).'.',
                default => "Your overall rating is {$f['average']} from {$f['responses']} responses. Ask me about your strongest or weakest area, or for a summary of comments.",
            };
        }

        return match (true) {
            $has('invite', 'add teacher', 'add user', 'new teacher', 'create account', 'account', 'join', 'sign up', 'signup', 'register') => Say::it(
                'Admins don’t create accounts. Teachers and other admins join with an invite code: People → Invite teachers, paste their names, send each person their code. Students create their own account once their ID is on Approved IDs; share your join link from School settings.',
                'Hindi gumagawa ng account ang admin. Sumasali ang guro at ibang admin gamit ang invite code: People → Mag-imbita ng guro, i-paste ang mga pangalan, ipadala ang code sa bawat isa. Gumagawa ng sariling account ang estudyante kapag nasa Approved IDs na ang ID nila; ibahagi ang join link mula sa School settings.'
            ),
            $has('password', 'forgot', 'locked out', "can't sign in", 'cannot sign in') => Say::it(
                'Open Requests to answer “Forgot password?” requests, or open the person in People and choose “Give a temporary password”. They should change it in Profile right after.',
                'Buksan ang Requests para sa mga “Nakalimutan ang password?”, o buksan ang tao sa People at piliin ang “Magbigay ng temporary password”. Dapat nila itong palitan agad sa Profile.'
            ),
            $has('behind', 'lowest', 'section', 'complet', 'progress') => $f['sections']
                ? "Overall completion is {$f['completion']}%. Lowest: ".collect($f['sections'])->take(3)->map(fn ($s) => "{$s['label']} {$s['percent']}%")->implode(', ').'. Sending a reminder from the dashboard usually helps.'
                : 'No sections have students and classes assigned yet.',
            $has('top', 'best', 'highest') => $f['top']
                ? 'Top-rated faculty: '.implode(', ', $f['top']).'.'
                : 'No ratings yet this semester.',
            $has('support', 'struggl', 'low', 'help') => $f['low']
                ? 'Faculty rated below 3.5 who may need support: '.implode(', ', $f['low']).'.'
                : 'No faculty member is rated below 3.5 right now.',
            default => "Completion for {$f['period']} is {$f['completion']}% across {$f['faculty_count']} rated faculty. Ask about sections that are behind, top-rated faculty, or who needs support.",
        };
    }

    private function tipFor(string $category): string
    {
        $c = Str::lower($category);

        return match (true) {
            Str::contains($c, 'clarity') => 'Try writing clear checklists for projects and recapping the key points at the end of each class.',
            Str::contains($c, 'method') => 'Mix short activities or real examples into lectures, and check understanding with quick questions.',
            Str::contains($c, 'management') => 'Start and end on time, and set clear class rules at the start of the term.',
            Str::contains($c, 'grading', 'fair') => 'Share rubrics before activities and explain how each score was given.',
            Str::contains($c, 'mastery', 'expertise') => 'Prepare a few real-world examples per topic and invite questions.',
            default => 'Ask a few students what would help most, and try one small change for two weeks.',
        };
    }

    private function surname(User $user): string
    {
        $words = preg_split('/\s+/', trim(preg_replace('/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i', '', $user->name)));

        return count($words) > 1 ? implode(' ', array_slice($words, 1)) : $words[0];
    }
}
