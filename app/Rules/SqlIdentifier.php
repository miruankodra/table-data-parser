<?php

namespace App\Rules;

use App\Services\SchemaManager;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

class SqlIdentifier implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! SchemaManager::isValidIdentifier($value)) {
            $fail('The :attribute must be lowercase letters, digits, or underscores (max 64 chars).');
        }
    }
}
