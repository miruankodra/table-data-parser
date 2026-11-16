<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sheet_tabs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->foreignUuid('spreadsheet_id')->references('id')->on('spreadsheets')->onDelete('cascade');
            $table->unsignedTinyInteger('header_row')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['spreadsheet_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sheet_tabs');
    }
};
