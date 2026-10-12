<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'audience', 'category', 'category_fil', 'text', 'text_fil', 'type', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    /** Text in the language the app asked for (Filipino when it has been written). */
    public function localized(): array
    {
        $fil = \App\Support\Say::fil();

        return [
            'id' => $this->id,
            'category' => $fil && $this->category_fil ? $this->category_fil : $this->category,
            'text' => $fil && $this->text_fil ? $this->text_fil : $this->text,
            'type' => $this->type,
        ];
    }

    public function scopeFor(Builder $query, string $audience): Builder
    {
        return $query->where('audience', $audience)->where('is_active', true)->orderBy('sort_order')->orderBy('id');
    }
}
