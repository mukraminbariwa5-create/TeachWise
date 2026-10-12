<?php

namespace App\Console\Commands;

use App\Models\ClassOffering;
use App\Models\Evaluation;
use App\Models\EvaluationPeriod;
use App\Models\School;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Tenant;
use Illuminate\Console\Command;

/**
 * Runs every hour (see routes/console.php):
 * - "Midterm evaluation is open" when a period opens (students, or teachers for peer periods);
 * - "Closes in 24 hours" to students who still have pending evaluations.
 */
class SendScheduledNotifications extends Command
{
    protected $signature = 'teachwise:notify';

    protected $description = 'Send "evaluation is open" and "closes soon" notifications';

    public function handle(): int
    {
        // Each school separately, so people only hear about their own school's periods.
        foreach (School::where('status', School::ACTIVE)->get() as $school) {
            Tenant::run($school->id, fn () => $this->forCurrentSchool());
        }

        return self::SUCCESS;
    }

    private function forCurrentSchool(): void
    {
        foreach (EvaluationPeriod::whereNull('announced_at')->where('opens_at', '<=', now())->where('closes_at', '>', now())->get() as $period) {
            if ($period->type === 'peer' && ! Tenant::school()?->setting('peer_evaluation')) {
                $period->update(['announced_at' => now()]);

                continue;
            }
            $audience = $period->type === 'peer'
                ? User::where('role', User::ROLE_TEACHER)->where('is_active', true)->get()
                : User::where('role', User::ROLE_STUDENT)->where('is_active', true)->get();
            Notifier::send(
                $audience,
                'periods',
                "{$period->name} evaluation is open",
                "You can evaluate until {$period->closes_at->format('M j, g:i A')}. It only takes a few minutes and it's anonymous.",
                ['screen' => 'home']
            );
            $period->update(['announced_at' => now()]);
            $this->info("Announced {$period->name} to {$audience->count()} people.");
        }

        $closing = EvaluationPeriod::where('type', 'student')->whereNull('reminded_at')
            ->where('closes_at', '>', now())->where('closes_at', '<=', now()->addDay())->get();
        foreach ($closing as $period) {
            $sent = 0;
            StudentProfile::whereNotNull('section_id')->whereHas('user')->with('user')->chunkById(200, function ($profiles) use ($period, &$sent) {
                foreach ($profiles as $profile) {
                    if (! $profile->user?->is_active) {
                        continue;
                    }
                    $offeringIds = ClassOffering::where('section_id', $profile->section_id)->pluck('id');
                    $pending = $offeringIds->count() - Evaluation::where('evaluator_id', $profile->user_id)
                        ->where('evaluation_period_id', $period->id)->whereIn('class_offering_id', $offeringIds)->count();
                    if ($pending > 0) {
                        Notifier::send($profile->user, 'reminders', "{$period->name} closes in 24 hours", "You still have {$pending} teacher(s) to evaluate. It takes about ".($pending * 3).' minutes.', ['screen' => 'home']);
                        $sent++;
                    }
                }
            });
            $period->update(['reminded_at' => now()]);
            $this->info("Reminded {$sent} students about {$period->name}.");
        }
    }
}
