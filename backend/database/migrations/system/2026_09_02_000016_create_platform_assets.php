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
        Schema::create('platform_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('purpose', 32);
            $table->string('state', 20);
            $table->string('disk', 64);
            $table->text('path');
            $table->text('quarantine_path')->nullable();
            $table->string('mime_type', 64);
            $table->unsignedBigInteger('byte_size');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->char('checksum_sha256', 64);
            $table->char('uploaded_by_user_id', 26)->nullable();
            $table->uuid('upload_idempotency_key');
            $table->timestampTz('orphaned_at')->nullable();
            $table->timestampTz('quarantined_at')->nullable();
            $table->timestampTz('recoverable_until')->nullable();
            $table->timestampsTz();
            $table->foreign('uploaded_by_user_id')->references('id')->on('users')->nullOnDelete();
        });

        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_purpose_valid CHECK (purpose IN ('landing_hero', 'authentication'))");
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_state_valid CHECK (state IN ('staging', 'ready', 'quarantined', 'purging'))");
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_path_safe CHECK (path !~ '(^|/)\\.\\.(/|$)' AND path !~ '^[\\\\/]' AND path !~ '[\\\\]')");
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_quarantine_path_safe CHECK (quarantine_path IS NULL OR (quarantine_path !~ '(^|/)\\.\\.(/|$)' AND quarantine_path !~ '^[\\\\/]' AND quarantine_path !~ '[\\\\]'))");
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_mime_valid CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))");
        DB::statement('ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_dimensions_positive CHECK (byte_size > 0 AND width > 0 AND height > 0)');
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_checksum_valid CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_lifecycle_valid CHECK ((state IN ('staging', 'ready') AND quarantine_path IS NULL AND quarantined_at IS NULL AND recoverable_until IS NULL) OR (state IN ('quarantined', 'purging') AND orphaned_at IS NOT NULL AND quarantine_path IS NOT NULL AND quarantined_at IS NOT NULL AND recoverable_until IS NOT NULL))");
        DB::statement('CREATE UNIQUE INDEX platform_assets_disk_path_unique ON platform_assets (disk, path)');
        DB::statement('CREATE UNIQUE INDEX platform_assets_upload_idempotency_unique ON platform_assets (uploaded_by_user_id, upload_idempotency_key) WHERE uploaded_by_user_id IS NOT NULL');
        DB::statement('CREATE INDEX platform_assets_orphan_cleanup ON platform_assets (orphaned_at, id) WHERE orphaned_at IS NOT NULL');
    }

    public function down(): void
    {
        if (Schema::hasTable('platform_assets') && DB::table('platform_assets')->exists()) {
            throw new RuntimeException('Refusing to erase recoverable platform asset provenance.');
        }

        Schema::dropIfExists('platform_assets');
    }
};
