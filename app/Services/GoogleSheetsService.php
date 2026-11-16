<?php

namespace App\Services;

use App\Exceptions\SheetsException;
use Google\Client;
use Google\Service\Exception as GoogleException;
use Google\Service\Sheets;
use Google\Service\Drive;

class GoogleSheetsService
{
    private ?Sheets $sheets = null;
    private ?Client $client = null;
    

    private function client(): Client
    {
        if ($this->client) {
            return $this->client;
        }

        $path = $this->credentialsPath();
        if (! is_file($path)) {
            throw new SheetsException("Service account key not found at {$path}. See GOOGLE_SETUP.md.");
        }

        $client = new Client();
        $client->setApplicationName(config('app.name'));
        $client->setAuthConfig($path);
        $client->setScopes([Sheets::SPREADSHEETS_READONLY, Drive::DRIVE_METADATA_READONLY]);
        $client->setConfig('retry', ['retries' => 3]);

        return $this->client = $client;
    }

    private function sheets(): Sheets
    {
        return new Sheets($this->client());
    }

    private function drive(): Drive
    {
        return new Drive($this->client());
    }

    private function credentialsPath(): string
    {
        return base_path(config('services.google.credentials'));
    }

    public function serviceAccountEmail(): ?string
    {
        $path = $this->credentialsPath();

        return is_file($path) ? (json_decode(file_get_contents($path), true)['client_email'] ?? null) : null;
    }

    public static function extractId(string $input): ?string
    {
        $input = trim($input);

        if (preg_match('#/spreadsheets/d/([a-zA-Z0-9-_]+)#', $input, $m)) {
            return $m[1];
        }

        return preg_match('/^[a-zA-Z0-9-_]{20,}$/', $input) ? $input : null;
    }

    public function getTabs(string $spreadsheetId): array
    {
        $meta = $this->call(fn () => $this->sheets()->spreadsheets->get($spreadsheetId, ['fields' => 'sheets.properties.title']));

        return collect($meta->getSheets())->map(fn ($s) => $s->getProperties()->getTitle())->all();
    }

    public function getHeaders(string $spreadsheetId, string $tab, int $headerRow = 1): array
    {
        $range = $this->quote($tab) . "!{$headerRow}:{$headerRow}";
        $values = $this->call(fn () => $this->sheets()->spreadsheets_values->get($spreadsheetId, $range)->getValues()) ?? [];

        return array_values(array_filter(array_map(fn ($h) => trim((string) $h), $values[0] ?? []), fn ($h) => $h !== ''));
    }

 
    public function readTab(string $spreadsheetId, string $tab, int $headerRow = 1): array
    {
        $values = $this->call(fn () => $this->sheets()->spreadsheets_values->get(
            $spreadsheetId,
            $this->quote($tab),
            ['valueRenderOption' => 'FORMATTED_VALUE']
        )->getValues()) ?? [];

        $warnings = [];
        $headers = [];
        $seen = [];

        foreach ($values[$headerRow - 1] ?? [] as $i => $raw) {
            $h = trim((string) $raw);
            if ($h === '') {
                continue;
            }

            $key = mb_strtolower(preg_replace('/\s+/', ' ', $h));
            if (isset($seen[$key])) {
                $warnings[] = "Duplicate header `{$h}` in column " . ($i + 1) . ' ignored; the first one is used.';
                continue;
            }

            $seen[$key] = true;
            $headers[$i] = $h;
        }

        $rows = [];
        foreach (array_slice($values, $headerRow) as $row) {
            $record = [];
            foreach ($headers as $i => $h) {
                $record[$h] = $row[$i] ?? null;
            }
            $rows[] = $record;
        }

        return ['headers' => array_values($headers), 'rows' => $rows, 'warnings' => $warnings];
    }

    private function quote(string $tab): string
    {
        return "'" . str_replace("'", "''", $tab) . "'";
    }

    private function call(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (GoogleException $e) {
            $email = $this->serviceAccountEmail() ?? 'the service account';

            throw new SheetsException(match ($e->getCode()) {
                400 => 'Tab not found or unreadable range. Check the tab name.',
                403 => "Access denied. Share the spreadsheet with {$email} as Viewer, and check that the Google Sheets and Google Drive APIs are enabled.",
                404 => 'Spreadsheet not found. Check the URL or ID.',
                429 => 'Google rate limit reached. Try again later.',
                default => 'Google API error: ' . $e->getMessage(),
            }, $e->getCode(), $e);
        }
    }

    public function listSpreadsheets(): array
    {
        $files = [];
        $pageToken = null;

        do {
            $params = [
                'q'        => "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                'fields'   => 'nextPageToken, files(id, name, modifiedTime)',
                'pageSize' => 100,
                'orderBy'  => 'name',
                'supportsAllDrives'         => true,
                'includeItemsFromAllDrives' => true,
            ];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            $result = $this->call(fn () => $this->drive()->files->listFiles($params));

            foreach ($result->getFiles() as $file) {
                $files[] = [
                    'id'       => $file->getId(),
                    'name'     => $file->getName(),
                    'modified' => $file->getModifiedTime(),
                ];
            }

            $pageToken = $result->getNextPageToken();
        } while ($pageToken);

        return $files;
    }
}