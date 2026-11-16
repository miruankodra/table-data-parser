<?php

namespace App\Http\Requests;

use App\Exceptions\SheetsException;
use App\Services\GoogleSheetsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class StoreSpreadsheetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Accept a full URL or an ID: normalize to the ID before validating */
    protected function prepareForValidation(): void
    {
        $id = GoogleSheetsService::extractId((string) $this->input('google_spreadsheet_id'));

        if ($id) {
            $this->merge(['google_spreadsheet_id' => $id]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'google_spreadsheet_id' => [
                'required',
                'string',
                'regex:/^[a-zA-Z0-9-_]{20,}$/',
                Rule::unique('spreadsheets', 'google_spreadsheet_id'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'google_spreadsheet_id.regex' => 'Paste a valid Google Sheets URL or spreadsheet ID.',
            'google_spreadsheet_id.unique' => 'This spreadsheet has already been added.',
        ];
    }

    /** Runs only after the basic rules pass: asks Google if the sheet is reachable */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                try {
                    app(GoogleSheetsService::class)->getTabs($this->input('google_spreadsheet_id'));
                } catch (SheetsException $e) {
                    $validator->errors()->add('google_spreadsheet_id', $e->getMessage());
                }
            },
        ];
    }
}