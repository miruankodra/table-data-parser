<?php

namespace App\Http\Requests;

use App\Rules\TargetTableName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTargetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_name' => [
                'required',
                new TargetTableName,
                Rule::unique('targets', 'table_name')->where('sheet_tab_id', $this->route('tab')->id),
            ],
            'write_mode' => ['required', Rule::in(['upsert', 'replace', 'append'])],
        ];
    }

    public function messages(): array
    {
        return ['table_name.unique' => 'This tab already has a target for that table.'];
    }
}