<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An ID number allowed to sign up, optionally with the student's name and section from the college records. */
class WhitelistedId extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'id_number', 'name', 'section_id', 'notes'];

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }
}
