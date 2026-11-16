<?php

namespace App\Http\Requests;

use App\Models\ColumnMapping;
use App\Rules\SqlIdentifier;
use App\Rules\TargetTableName;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveTargetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $target = $this->route('target');

        return [
            'table_name' => [
                'required',
                new TargetTableName,
                Rule::unique('targets', 'table_name')
                    ->where('sheet_tab_id', $target->sheet_tab_id)
                    ->ignore($target->id),
            ],
            'write_mode'        => ['required', Rule::in(['upsert', 'replace', 'append'])],
            'auto_create_table' => ['required', 'boolean'],

            'add_primary_key' => ['required', 'boolean'],

            'mappings'                 => ['required', 'array', 'min:1'],
            'mappings.*.source_column' => ['required', 'string', 'max:255'],
            'mappings.*.db_column' => ['required', new SqlIdentifier, 'distinct', 'not_in:internal_id'],
            'mappings.*.data_type'     => ['required', Rule::in(ColumnMapping::TYPES)],
            'mappings.*.is_key'        => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'table_name.unique'           => 'This tab already has a target for that table.',
            'mappings.required'           => 'Add at least one column mapping.',
            'mappings.min'                => 'Add at least one column mapping.',
            'mappings.*.db_column.distinct' => 'Each database column can only be used once.',
            'mappings.*.db_column.not_in' => '`internal_id` is reserved for the generated primary key.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $mappings = collect($this->input('mappings'));

                if ($this->input('write_mode') === 'upsert' && $mappings->where('is_key', true)->isEmpty()) {
                    $validator->errors()->add('mappings', 'Upsert mode needs at least one key column.');
                }

                foreach ($mappings as $i => $m) {
                    if ($m['is_key'] && ! in_array($m['data_type'], ColumnMapping::KEY_TYPES, true)) {
                        $validator->errors()->add("mappings.$i.data_type", 'A key column must be string, integer, date, or datetime.');
                    }
                }
            },
        ];
    }
}