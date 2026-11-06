<?php

namespace App\Services;

use App\Support\TeachingTips;
use App\Models\ChatMessage;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\Section;
use App\Models\User;
use App\Support\Say;
use App\Support\WisePrompt;
use App\Support\Tenant;
use App\Support\AdminScope;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Professor Wise, the in-app assistant for every role.
 *
 * It first builds a short, factual summary of the user's own data (pending
 * evaluations, ratings, completion). With Ollama enabled, reviewed guidance,
 * that summary and recent private conversation form the model's context.
 * If unavailable, Wise explicitly discloses its limited built-in answer mode.
 */
class WiseService
{
    /** @return array{reply: string, source: string} */
    public function reply(User $user, string $message, ?int $conversationId = null): array
    {
        $quick = $this->quickReply($user, $message);
        if ($quick !== null) {
            return ['reply' => $quick, 'source' => 'quick'];
        }
        $facts = $this->facts($user);

        if (config('services.ollama.enabled')) {
            try {
                return ['reply' => $this->askOllama($user, $message, $facts, $conversationId), 'source' => 'ollama'];
            } catch (Throwable $e) {
                Log::warning('Professor Wise: Ollama unavailable, using built-in answers.', ['error' => $e->getMessage()]);
            }
        }

        $notice = Say::it(
            'My AI conversation service is unavailable right now, so this is a limited built-in answer. ',
            'Hindi available ang AI conversation service ko ngayon, kaya limitadong built-in na sagot ito. '
        );

        return ['reply' => $notice.$this->ruleBasedReply($user, $message, $facts), 'source' => 'rules'];
    }

    /** Social acknowledgements do not need a model round trip or evaluation queries. */
    private function quickReply(User $user, string $message): ?string
    {
        $q = trim((string) preg_replace('/[\p{P}\p{Z}\p{S}\s\x{FE0F}]+/u', ' ', mb_strtolower($message)));
        if (in_array($q, ['thanks', 'thank you', 'thank you wise', 'salamat', 'salamat po'], true)) {
            return Say::it("You're welcome. I'm here when you need a hand.", 'Walang anuman. Nandito ako kung kailangan mo ng tulong.');
        }
        if (! in_array($q, ['hello', 'hi', 'hey', 'hello there', 'hi there', 'hey there', 'hello wise', 'hi wise', 'hello prof', 'hi prof', 'hello teachwise', 'hi teachwise', 'hello professor wise', 'hi professor wise', 'good morning', 'good afternoon', 'good evening', 'kumusta', 'kamusta', 'kumusta po', 'kamusta po'], true)) {
            return null;
        }
        $first = Str::of($user->name)->replaceMatches('/^(Prof|Dr|Mr|Ms|Mrs|Engr)\.?\s+/i', '')->before(' ');
        $replies = Say::fil()
            ? ["Kumusta, {$first}! Ano ang gusto mong pag-usapan?", "Hi {$first}! Kumusta ang araw mo? 🙂", "Kumusta, {$first}! Nandito ako para makinig at tumulong. Ano ang nasa isip mo?"]
            : ["Hello, {$first}! What's on your mind?", "Hi {$first}! How's your day going? 🙂", "Hello, {$first}! I'm here to listen and help. What would you like to talk about?"];

        return $replies[random_int(0, count($replies) - 1)];
    }

    public function summary(User $user): array
    {
        $facts = $this->facts($user);

        return ['greeting' => $this->greeting($user, $facts), 'tip' => $this->tip($user, $facts)];
    }

    public function greeting(User $user, ?array $facts = null): string
    {
        $f = $facts ?? $this->facts($user);
        $first = Str::of($user->name)->replaceMatches('/^(Prof|Dr|Mr|Ms|Mrs|Engr)\.?\s+/i', '')->before(' ');

        return match ($user->role) {
            User::ROLE_STUDENT => $f['period'] && $f['pending']
                ? Say::it(
                    "Hi {$first}! You have {$f['pending']} pending evaluation(s) for {$f['period']}. We can talk about the process, study habits, or a school concern. What's on your mind?",
                    "Hi {$first}! May {$f['pending']} ka pang evaluation para sa {$f['period']}. Puwede nating pag-usapan ang proseso, pag-aaral, o alalahanin sa paaralan. Ano ang nasa isip mo?"
                )
                : Say::it("Hi {$first}! I'm Professor Wise, your AI guidance assistant. We can talk about school, study habits, evaluations, or something that's been weighing on you. What's on your mind?", "Hi {$first}! Ako si Professor Wise, ang AI guidance assistant mo. Puwede nating pag-usapan ang paaralan, pag-aaral, evaluation, o isang bagay na bumabagabag sa iyo. Ano ang nasa isip mo?"),
            User::ROLE_TEACHER => $f['responses']
                ? Say::it(
                    "Hi Prof. {$this->surname($user)}! You have {$f['responses']} recorded student evaluation responses. We can discuss feedback or a teaching concern.",
                    "Kumusta Prof. {$this->surname($user)}! May {$f['responses']} naitalang sagot sa student evaluation. Puwede nating pag-usapan ang feedback o alalahanin sa pagtuturo."
                )
                : Say::it(
                    "Hi Prof. {$this->surname($user)}! We can talk through teaching challenges, classroom ideas, or how you're feeling about feedback, even before results arrive. What's on your mind?",
                    "Kumusta Prof. {$this->surname($user)}! Kahit wala pang resulta, puwede nating pag-usapan ang mga hamon sa pagtuturo, ideya sa klase, o nararamdaman mo tungkol sa feedback. Ano ang nasa isip mo?"
                ),
            default => Say::it(
                "Hello! Evaluation completion is at {$f['completion']}%. We can discuss evaluation progress, faculty support, or a school concern.",
                "Kumusta! Nasa {$f['completion']}% ang pagkumpleto ng evaluation. Puwede nating pag-usapan ang progreso, suporta sa guro, o alalahanin sa paaralan."
            ),
        };
    }

    /** One short, personal tip for the dashboard card. */
    public function tip(User $user, ?array $facts = null): string
    {
        $f = $facts ?? $this->facts($user);

        if ($user->isStudent()) {
            if (! $f['period']) {
                return Say::it('No evaluation period is scheduled yet. Check Home for upcoming evaluations.', 'Wala pang nakatakdang evaluation. Tingnan ang Home para sa mga susunod na evaluation.');
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
            if ($f['privacy_locked']) {
                return 'Your detailed feedback is hidden until the school minimum of '.$f['min_responses'].' responses is reached. You can still ask me for general teaching guidance.';
            }
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
            'opens_at' => $period?->opens_at?->toIso8601String(),
            'closes_at' => $period?->closes_at?->toIso8601String(),
            'timezone' => config('app.timezone'),
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
        $minimum = Tenant::school()?->minResponses() ?? 3;
        if ($overall['responses'] < $minimum) {
            return [
                'average' => null, 'responses' => $overall['responses'], 'criteria' => [],
                'weakest' => null, 'strongest' => null, 'comments' => [],
                'privacy_locked' => true, 'min_responses' => $minimum,
            ];
        }
        $criteria = $stats->byCriteria()->sortBy('average')->values();

        return [
            'privacy_locked' => false,
            'rating_scope' => 'All recorded student evaluations, not restricted to the current semester or period.',
            'min_responses' => $minimum,
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

        $faculty = AdminScope::users(User::query())->where('role', User::ROLE_TEACHER)
            ->withAvg(['evaluationsReceived as average' => fn ($q) => $q->where('evaluator_role', 'student')], 'overall_rating')
            ->withCount(['evaluationsReceived as responses' => fn ($q) => $q->where('evaluator_role', 'student')])
            ->get()
            ->filter(fn ($t) => $t->responses > 0)
            ->sortByDesc('average')
            ->values();

        $sections = AdminScope::sections(Section::query())->withCount('students')->get()->map(function (Section $s) use ($period) {
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

    private function askOllama(User $user, string $message, array $facts, ?int $conversationId): string
    {
        $system = WisePrompt::system($user, $facts);
        $outputTokens = max(100, min(2000, (int) config('services.ollama.max_tokens', 700)));
        // A conservative byte estimate leaves room for the system instructions, current
        // message and answer. A single long multilingual message can expand the window.
        $baseTokens = (int) ceil((strlen($system) + strlen($message)) / 2) + $outputTokens + 512;
        $contextSize = max(8192, min(32768, (int) ceil($baseTokens / 1024) * 1024));
        $history = [];
        $remaining = max(0, min(16000, ($contextSize - $baseTokens) * 2));
        $rows = ChatMessage::where('user_id', $user->id)->whereIn('role', ['user', 'assistant'])
            ->where('conversation_id', $conversationId)
            ->latest('id')->limit(24)->get();
        $assistant = null;
        foreach ($rows as $row) {
            if ($row->role === 'assistant') {
                $assistant = $row;
                continue;
            }
            if (! $assistant) {
                continue;
            }
            $answer = $assistant->source === 'rules' || Str::startsWith($assistant->content, ['My AI conversation service is unavailable', 'Hindi available ang AI conversation service'])
                ? 'The AI service was unavailable for this turn. The user may still need help with this concern.'
                : $assistant->content;
            $length = strlen($row->content) + strlen($answer) + 64;
            if ($length > $remaining) {
                break;
            }
            $remaining -= $length;
            $history = array_merge([
                ['role' => 'user', 'content' => $row->content],
                ['role' => 'assistant', 'content' => $answer],
            ], $history);
            $assistant = null;
        }

        $response = Http::connectTimeout(3)->timeout(config('services.ollama.timeout'))
            ->post(rtrim(config('services.ollama.endpoint'), '/').'/api/chat', [
                'model' => config('services.ollama.model'),
                'stream' => false,
                'keep_alive' => '15m',
                'options' => [
                    'num_ctx' => $contextSize,
                    'num_predict' => $outputTokens,
                    'temperature' => 0.65,
                ],
                'messages' => array_merge([['role' => 'system', 'content' => $system]], $history, [['role' => 'user', 'content' => $message]]),
            ])
            ->throw();

        $payload = $response->json();
        $content = data_get($payload, 'message.content');
        if (! is_string($content) || trim($content) === '' || data_get($payload, 'done') === false) {
            throw new \RuntimeException('Empty or incomplete reply from Ollama.');
        }
        $reply = trim($content);
        if (data_get($payload, 'done_reason') === 'length') {
            $reply .= "\n\n".Say::it(
                'I reached the reply length limit. Ask me to continue if you would like the rest.',
                'Naabot ko ang haba ng isang sagot. Sabihin mong magpatuloy ako kung gusto mo ang kasunod.'
            );
        }

        return $reply;
    }

    // ---------------------------------------------------------------- rules

    private function ruleBasedReply(User $user, string $message, array $f): string
    {
        $q = Str::lower($message);
        $has = fn (string ...$words) => Str::contains($q, $words);

        if ($has('kill myself', 'end my life', 'hurt myself', 'suicid', 'magpakamatay', 'saktan ang sarili')) {
            return Say::it(
                'I am concerned about your safety. If you might act on this now or have already hurt yourself, contact local emergency services or go to the nearest emergency department. Reach out to someone you trust who can stay with you, and move away from anything you could use to hurt yourself. Are you safe right now?',
                'Nag-aalala ako sa kaligtasan mo. Kung maaari mong saktan ang sarili mo ngayon o nasaktan mo na ang sarili mo, makipag-ugnayan sa lokal na emergency services o pumunta sa pinakamalapit na emergency department. Lumapit sa taong pinagkakatiwalaan mo na puwedeng samahan ka, at lumayo sa anumang puwedeng makasakit sa iyo. Ligtas ka ba ngayon?'
            );
        }

        if ($has('stress', 'overwhelm', 'anxious', 'worried', 'sad', 'burnout', 'pagod', 'takot', 'lungkot')) {
            return Say::it(
                'That sounds difficult to carry. For now, pause and choose one small, manageable next step. If this keeps weighing on you, a school counselor or someone you trust can help you work through it. My full conversation service needs to reconnect for a more personal discussion.',
                'Mukhang mabigat ang pinagdaraanan mo. Huminto muna sandali at pumili ng isang maliit na hakbang na kaya mo ngayon. Kung patuloy itong mabigat, puwedeng tumulong ang school counselor o isang taong pinagkakatiwalaan mo. Kailangang kumonekta ulit ang buong conversation service para sa mas personal na usapan.'
            );
        }

        if ($has('purpose', 'what is teachwise', 'who are you', 'what can you do', 'guidance', 'layunin')) {
            return Say::it(
                'TeachWise helps schools gather constructive faculty feedback and supports students and teachers in improving their school experience. I am Professor Wise, its AI guidance assistant. With my conversation service connected, I can discuss school concerns, study habits, teaching strategies and feedback with you. I am not a licensed counselor.',
                'Tumutulong ang TeachWise sa pagkuha ng makabuluhang feedback at sa pag-unlad ng mga estudyante at guro. Ako si Professor Wise, ang AI guidance assistant nito. Kapag konektado ang conversation service, puwede nating pag-usapan ang mga alalahanin sa paaralan, pag-aaral, pagtuturo at feedback. Hindi ako lisensiyadong counselor.'
            );
        }

        if ($has('chat', 'conversation', 'usapan', 'mensahe') && $has('private', 'privacy', 'anonym', 'save', 'store', 'remember', 'pribado', 'tinatago')) {
            return Say::it(
                'This chat is saved to your signed-in account; it is not an anonymous faculty evaluation. Use the conversation menu and Delete this conversation to remove this topic. Other chats and evaluations are preserved. Chatting does not automatically train the AI.',
                'Naka-save ang usapang ito sa naka-sign in mong account; hindi ito anonymous na faculty evaluation. Gamitin ang menu at Delete this conversation para burahin ang usapang ito. Mananatili ang ibang usapan at evaluation. Hindi awtomatikong tine-train ng usapan ang AI.'
            );
        }

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
                $has('edit', 'change', 'undo', 'mistake', 'palitan', 'baguhin', 'mali') => Say::it(
                    'Submitted evaluations cannot be edited, to keep results fair. Please review your answers before tapping Submit.',
                    'Hindi na mababago ang naipasang evaluation para manatiling patas ang resulta. I-check muna ang mga sagot mo bago pindutin ang Submit.'
                ),
                $has('pending', 'left', 'remaining', 'who', 'which', 'teachers', 'natitira', 'sino', 'alin', 'guro') && ! $has('how', 'steps', 'paano') => $f['pending']
                    ? Say::it('You still need to evaluate: ', 'Kailangan mo pang i-evaluate: ').implode(', ', $f['pending_list']).'.'
                    : Say::it('You are all done. Thank you for evaluating all your teachers!', 'Tapos ka na. Salamat sa pag-evaluate sa lahat ng guro mo!'),
                $has('rating', 'scale', 'meaning', 'score', 'ibig sabihin', 'marka') => Say::it(
                    'The school uses this 1–5 rating scale: '.$this->ratingScale().'. Rate based on your experience in class.',
                    'Ito ang 1–5 rating scale ng paaralan: '.$this->ratingScale().'. I-rate base sa naranasan mo sa klase.'
                ),
                $has('evaluate', 'evaluation', 'mag-evaluate') && $has('how', 'start', 'steps', 'paano', 'simulan') => Say::it(
                    'Open Home, tap Evaluate next to a teacher, answer each question from 1 to 5, add an optional comment, then tap Submit. Each teacher can only be evaluated once per period.',
                    'Buksan ang Home, pindutin ang Evaluate sa tabi ng guro, sagutin ang bawat tanong mula 1 hanggang 5, magdagdag ng komento kung gusto mo, tapos pindutin ang Submit. Isang beses lang puwedeng i-evaluate ang bawat guro kada period.'
                ),
                default => Say::it(
                    'I can help with evaluation deadlines, which teachers are left, what the ratings mean, and whether your answers are anonymous. What would you like to know?',
                    'Matutulungan kita sa deadline ng evaluation, kung sinong guro pa ang natitira, ano ang ibig sabihin ng mga rating, at kung anonymous ang sagot mo. Ano ang gusto mong malaman?'
                ),
            };
        }

        if ($user->isTeacher()) {
            if ($f['privacy_locked']) {
                return 'Your detailed feedback is hidden until the school minimum of '.$f['min_responses'].' responses is reached. Once my AI service reconnects, we can still discuss general teaching strategies.';
            }
            if (! $f['responses']) {
                return 'No student evaluations are recorded yet. Once students submit, I can summarise your strengths and areas to improve.';
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
                'Admins don’t create accounts. School admins invite deans through Administrator accounts. Each dean uses People → Invite teachers for their department and adds complete student names and sections under Approved IDs. Students choose their school and register themselves. The school admin manages shared questionnaires and the calendar.',
                'Hindi gumagawa ng account ang admin. Nag-iimbita ang school admin ng dean sa Mga account ng admin. Ginagamit ng dean ang People → Mag-imbita ng guro para sa sariling departamento at nagdaragdag ng kumpletong pangalan at section sa Approved IDs. Ang estudyante ang pumipili ng paaralan at gumagawa ng account.'
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
                : 'No student ratings are recorded yet.',
            $has('support', 'struggl', 'low', 'help') => $f['low']
                ? 'Faculty rated below 3.5 who may need support: '.implode(', ', $f['low']).'.'
                : 'No faculty member is rated below 3.5 right now.',
            default => "Completion for {$f['period']} is {$f['completion']}% across {$f['faculty_count']} rated faculty. Ask about sections that are behind, top-rated faculty, or who needs support.",
        };
    }

    private function ratingScale(): string
    {
        return collect(Tenant::school()?->scaleLabels() ?? [1 => 'Poor', 2 => 'Fair', 3 => 'Good', 4 => 'Very good', 5 => 'Excellent'])
            ->map(fn ($label, $score) => "{$score} {$label}")->implode(', ');
    }

    private function tipFor(string $category): string
    {
        return TeachingTips::for($category)[0];
    }

    private function surname(User $user): string
    {
        $words = preg_split('/\s+/', trim(preg_replace('/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i', '', $user->name)));

        return count($words) > 1 ? implode(' ', array_slice($words, 1)) : $words[0];
    }
}
