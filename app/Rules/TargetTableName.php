<?php

namespace App\Rules;

use App\Services\SchemaManager;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class TargetTableName implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/^[a-z_][a-z0-9_]{0,63}$/', $value)) {
            $fail('The :attribute must be lowercase letters, digits, or underscores (max 64 chars).');
            return;
        }

        if (in_array($value, SchemaManager::PROTECTED_TABLES, true)) {
            $fail("The table `{$value}` is reserved by the application and cannot be used as an import target.");
        }
    }
}