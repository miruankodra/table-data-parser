<?php

namespace App\Http\Controllers;

use App\Models\SheetTab;
use App\Models\Spreadsheet;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SheetTabController extends Controller
{
    public function store(Request $request, Spreadsheet $spreadsheet)
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('sheet_tabs', 'name')->where('spreadsheet_id', $spreadsheet->id),
            ],
        ]);

        $spreadsheet->tabs()->create($data + ['header_row' => 1, 'is_active' => true]);

        return back();
    }

    public function update(Request $request, SheetTab $tab)
    {
        $tab->update($request->validate([
            'is_active'  => ['sometimes', 'boolean'],
            'header_row' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]));

        return back();
    }

    public function destroy(SheetTab $tab)
    {
        $tab->delete();

        return back();
    }
}