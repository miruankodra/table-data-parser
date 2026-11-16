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
        Schema::create('column_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('target_id')->constrained('targets')->onDelete('cascade');
            $table->string('source_column');
            $table->string('db_column');
            $table->string('data_type')->default('text');
            $table->boolean('is_key')->default(false);
            $table->timestamps();

            $table->unique(['target_id', 'db_column']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('column_mappings');
    }
};
