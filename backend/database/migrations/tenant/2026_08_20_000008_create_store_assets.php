<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        Schema::create('store_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('state', 20);
            $table->string('disk', 64);
            $table->text('path');
            $table->string('mime_type', 64);
            $table->unsignedBigInteger('byte_size');
            $table->char('checksum_sha256', 64);
            $table->char('uploaded_by_user_id', 26);
            $table->uuid('upload_idempotency_key');
            $table->timestampTz('orphaned_at')->nullable();
            $table->timestampTz('cleanup_started_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE store_assets ADD CONSTRAINT store_assets_state_valid CHECK (state IN ('staging', 'ready', 'cleanup'))");
        DB::statement("ALTER TABLE store_assets ADD CONSTRAINT store_assets_path_safe CHECK (path !~ '(^|/)\\.\\.(/|$)' AND path !~ '^[\\\\/]' AND path !~ '[\\\\]')");
        DB::statement("ALTER TABLE store_assets ADD CONSTRAINT store_assets_mime_valid CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))");
        DB::statement('ALTER TABLE store_assets ADD CONSTRAINT store_assets_bytes_positive CHECK (byte_size > 0)');
        DB::statement("ALTER TABLE store_assets ADD CONSTRAINT store_assets_checksum_valid CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE store_assets ADD CONSTRAINT store_assets_cleanup_state CHECK ((state = 'staging' AND orphaned_at IS NOT NULL AND cleanup_started_at IS NULL) OR (state = 'ready' AND cleanup_started_at IS NULL) OR (state = 'cleanup' AND orphaned_at IS NOT NULL AND cleanup_started_at IS NOT NULL))");
        DB::statement('CREATE UNIQUE INDEX store_assets_disk_path_unique ON store_assets (disk, path)');
        DB::statement('CREATE UNIQUE INDEX store_assets_upload_idempotency_unique ON store_assets (uploaded_by_user_id, upload_idempotency_key)');
        DB::statement('CREATE INDEX store_assets_orphan_cleanup ON store_assets (orphaned_at, id) WHERE orphaned_at IS NOT NULL');
    }

    public function down(): void
    {
        if (Schema::hasTable('store_assets') && DB::table('store_assets')->exists()) {
            throw new RuntimeException('Refusing to erase managed store asset provenance.');
        }

        Schema::dropIfExists('store_assets');
    }
};
