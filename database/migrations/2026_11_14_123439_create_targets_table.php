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
        Schema::create('targets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sheet_tab_id')->constrained('sheet_tabs')->onDelete('cascade');
            $table->string('table_name');
            $table->enum('write_mode', ['upsert', 'replace', 'append'])->default('upsert');
            $table->boolean('auto_create_table')->default(true);
            $table->boolean('is_active')->default(true);
            $table->boolean('add_primary_key')->default(true);
            $table->timestamps();

            $table->unique(['sheet_tab_id', 'table_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('targets');
    }
};
