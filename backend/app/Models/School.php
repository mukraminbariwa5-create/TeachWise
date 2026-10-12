<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * One school (university or college) using TeachWise. Everything else belongs to a school.
 * New schools apply from the app ("pending"), the platform owner approves them ("active"),
 * and can suspend them.
 */
class School extends Model
{
    public const PENDING = 'pending';
    public const ACTIVE = 'active';
    public const SUSPENDED = 'suspended';

    protected $fillable = [
        'name', 'short_name', 'code', 'location', 'logo_path', 'status',
        'contact_name', 'contact_email', 'contact_phone', 'contact_position', 'student_count', 'message',
        'settings', 'approved_at', 'suspended_reason',
    ];

    protected $hidden = ['message'];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'approved_at' => 'datetime',
            'student_count' => 'integer',
        ];
    }

    /** Settings each school can change. Anything not saved yet uses these. */
    public const DEFAULT_SETTINGS = [
        'term_label' => 'semester',
        'peer_evaluation' => true,
        'min_responses' => 3,
        'scale' => ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
        'scale_fil' => ['Mahina', 'Katamtaman', 'Mabuti', 'Napakabuti', 'Napakahusay'],
        'support_email' => null,
        'dpo_email' => null,
        'email_domains' => [],
        'setup_completed' => false,
    ];

    public function allSettings(): array
    {
        return array_replace(self::DEFAULT_SETTINGS, $this->settings ?? []);
    }

    public function setting(string $key): mixed
    {
        return $this->allSettings()[$key] ?? null;
    }

    /** Rating labels 1–5 in the person's language, e.g. [1 => 'Poor', …]. */
    public function scaleLabels(): array
    {
        $s = $this->allSettings();
        $labels = \App\Support\Say::fil() ? ($s['scale_fil'] ?: $s['scale']) : $s['scale'];

        return array_combine([1, 2, 3, 4, 5], array_pad(array_slice(array_values($labels), 0, 5), 5, ''));
    }

    /** Teachers only see detailed results once at least this many people answered (protects anonymity). */
    public function minResponses(): int
    {
        return max(1, (int) $this->setting('min_responses'));
    }

    public function peerEvaluationOn(): bool
    {
        return (bool) $this->setting('peer_evaluation');
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }

    /** Relative to the API address (the app adds it), e.g. "/schools/3/logo?v=1760000000". */
    public function logoUrl(): ?string
    {
        return $this->logo_path ? "/schools/{$this->id}/logo?v=".$this->updated_at?->timestamp : null;
    }

    /** A short, readable join code from the school's short name, e.g. "MSUSULU". */
    public static function makeCode(string $from): string
    {
        $base = Str::upper(preg_replace('/[^A-Za-z0-9]/', '', Str::ascii($from))) ?: 'SCHOOL';
        $base = mb_substr($base, 0, 12);
        $code = $base;
        $n = 2;
        while (static::where('code', $code)->exists()) {
            $code = mb_substr($base, 0, 10).$n++;
        }

        return $code;
    }

    /** What anyone may see: for the school picker and sign-up. */
    public function publicInfo(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'short_name' => $this->short_name,
            'code' => $this->code,
            'location' => $this->location,
            'logo_url' => $this->logoUrl(),
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }
}
