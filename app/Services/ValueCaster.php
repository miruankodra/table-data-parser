<?php

namespace App\Services;

use Carbon\Carbon;

class ValueCaster
{
    /** @var array<string,int> column => number of values that could not be converted */
    private array $failures = [];

    public function resetFailures(): void
    {
        $this->failures = [];
    }

    public function failures(): array
    {
        return $this->failures;
    }

    public function cast(mixed $value, string $type, ?string $label = null): mixed
    {
        if ($value === null) {
            return null;
        }

        $value = is_string($value) ? trim($value) : $value;
        if ($value === '') {
            return null;
        }

        $result = match ($type) {
            'integer'  => $this->parseNumber($value, true),
            'decimal'  => $this->parseNumber($value, false),
            'boolean'  => $this->parseBoolean($value),
            'date'     => $this->parseDate((string) $value)?->format('Y-m-d'),
            'datetime' => $this->parseDate((string) $value)?->format('Y-m-d H:i:s'),
            default    => (string) $value,
        };

        if ($result === null && $label !== null) {
            $this->failures[$label] = ($this->failures[$label] ?? 0) + 1;
        }

        return $result;
    }

    /** "1,200.50" -> 1200.5. Anything that isn't a number becomes null instead of 0 */
    private function parseNumber(mixed $value, bool $integer): int|float|null
    {
        $clean = str_replace([',', ' '], '', (string) $value);

        if (! is_numeric($clean)) {
            return null;
        }

        $number = (float) $clean;

        if ($integer) {
            return floor($number) === $number ? (int) $number : null;   // 1.5 in an integer column is a mismatch
        }

        return $number;
    }

    private function parseBoolean(mixed $value): ?bool
    {
        $v = mb_strtolower(trim((string) $value));

        return match (true) {
            in_array($v, ['1', 'true', 'yes', 'y', 'x', '✓', '✔', 'on'], true) => true,
            in_array($v, ['0', 'false', 'no', 'n', 'off', '✗', '✘'], true)     => false,
            default                                                            => null,
        };
    }

    private function parseDate(string $value): ?Carbon
    {
        $formats = array_filter([
            config('sheets.datetime_format'),
            config('sheets.date_format', 'd/m/Y'),
        ]);

        foreach ($formats as $format) {
            try {
                $date = Carbon::createFromFormat('!' . $format, $value);
            } catch (\Throwable) {
                continue;
            }

            $errors = Carbon::getLastErrors();
            $clean = ! $errors || (($errors['warning_count'] ?? 0) === 0 && ($errors['error_count'] ?? 0) === 0);

            if ($date && $clean) {
                return $date;   // 31/02/2026 has a warning, so it is rejected instead of rolling into March
            }
        }

        // Only ISO dates are accepted as a fallback; guessing 01/13/2026 as m/d/Y would hide wrong data
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }
}