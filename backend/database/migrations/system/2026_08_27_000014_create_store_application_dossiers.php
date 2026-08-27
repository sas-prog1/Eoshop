<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_verification_status_valid');
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_verification_status_valid CHECK (verification_status IN ('pending', 'changes_requested', 'approved', 'rejected', 'suspended'))");

        Schema::create('store_application_evidence', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('store_draft_id');
            $table->char('owner_user_id', 26);
            $table->string('tenant_id')->nullable();
            $table->string('requirement_key', 64);
            $table->string('resolution', 16);
            $table->string('review_status', 16)->default('pending');
            $table->string('original_name')->nullable();
            $table->string('disk', 40)->nullable();
            $table->string('path')->nullable();
            $table->string('mime_type', 80)->nullable();
            $table->unsignedBigInteger('byte_size')->nullable();
            $table->char('checksum_sha256', 64)->nullable();
            $table->uuid('upload_idempotency_key')->nullable();
            $table->text('exemption_reason')->nullable();
            $table->timestampTz('uploaded_at')->nullable();
            $table->timestampsTz();

            $table->foreign('store_draft_id')->references('id')->on('store_drafts')->cascadeOnDelete();
            $table->foreign('owner_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unique(['store_draft_id', 'requirement_key'], 'store_application_evidence_requirement_unique');
            $table->unique(['owner_user_id', 'upload_idempotency_key'], 'store_application_evidence_idempotency_unique');
            $table->index(['tenant_id', 'review_status'], 'store_application_evidence_review_index');
        });
        DB::statement("ALTER TABLE store_application_evidence ADD CONSTRAINT store_application_evidence_resolution_valid CHECK (resolution IN ('uploaded', 'exempted'))");
        DB::statement("ALTER TABLE store_application_evidence ADD CONSTRAINT store_application_evidence_review_valid CHECK (review_status IN ('pending', 'accepted', 'rejected'))");
        DB::statement("ALTER TABLE store_application_evidence ADD CONSTRAINT store_application_evidence_shape CHECK ((resolution = 'uploaded' AND disk IS NOT NULL AND path IS NOT NULL AND mime_type IS NOT NULL AND byte_size > 0 AND checksum_sha256 IS NOT NULL AND upload_idempotency_key IS NOT NULL AND exemption_reason IS NULL AND uploaded_at IS NOT NULL) OR (resolution = 'exempted' AND disk IS NULL AND path IS NULL AND mime_type IS NULL AND byte_size IS NULL AND checksum_sha256 IS NULL AND upload_idempotency_key IS NULL AND exemption_reason IS NOT NULL AND uploaded_at IS NULL))");

        Schema::create('store_correction_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->uuid('store_draft_id');
            $table->char('requested_by_user_id', 26);
            $table->string('status', 16);
            $table->json('requested_fields');
            $table->unsignedBigInteger('requested_draft_revision');
            $table->text('reason');
            $table->timestampTz('requested_at');
            $table->timestampTz('resolved_at')->nullable();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('store_draft_id')->references('id')->on('store_drafts')->cascadeOnDelete();
            $table->foreign('requested_by_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->index(['tenant_id', 'requested_at'], 'store_correction_requests_tenant_index');
        });
        DB::statement("ALTER TABLE store_correction_requests ADD CONSTRAINT store_correction_requests_status_valid CHECK (status IN ('open', 'resolved'))");
        DB::statement('ALTER TABLE store_correction_requests ADD CONSTRAINT store_correction_requests_revision_positive CHECK (requested_draft_revision > 0)');
        DB::statement("ALTER TABLE store_correction_requests ADD CONSTRAINT store_correction_requests_fields_array CHECK (jsonb_typeof(requested_fields::jsonb) = 'array' AND jsonb_array_length(requested_fields::jsonb) > 0)");
        DB::statement("CREATE UNIQUE INDEX store_correction_requests_one_open_per_tenant ON store_correction_requests (tenant_id) WHERE status = 'open'");

        Schema::create('store_application_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('store_draft_id');
            $table->string('tenant_id')->nullable();
            $table->char('actor_user_id', 26)->nullable();
            $table->string('actor_type', 16);
            $table->string('event_type', 64);
            $table->text('public_message');
            $table->json('metadata');
            $table->timestampTz('occurred_at');

            $table->foreign('store_draft_id')->references('id')->on('store_drafts')->cascadeOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('actor_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->index(['store_draft_id', 'occurred_at'], 'store_application_events_timeline_index');
            $table->index(['tenant_id', 'occurred_at'], 'store_application_events_tenant_index');
        });
        DB::statement("ALTER TABLE store_application_events ADD CONSTRAINT store_application_events_actor_valid CHECK (actor_type IN ('merchant', 'platform', 'system'))");
        DB::statement("ALTER TABLE store_application_events ADD CONSTRAINT store_application_events_metadata_object CHECK (jsonb_typeof(metadata::jsonb) = 'object')");
    }

    public function down(): void
    {
        if (Schema::hasTable('store_application_evidence') && DB::table('store_application_evidence')->exists()) {
            throw new RuntimeException('Store application evidence exists and cannot be discarded by rollback.');
        }
        if (Schema::hasTable('store_correction_requests') && DB::table('store_correction_requests')->exists()) {
            throw new RuntimeException('Store correction requests exist and cannot be discarded by rollback.');
        }
        if (Schema::hasTable('store_application_events') && DB::table('store_application_events')->exists()) {
            throw new RuntimeException('Store application timeline events exist and cannot be discarded by rollback.');
        }

        Schema::dropIfExists('store_application_events');
        Schema::dropIfExists('store_correction_requests');
        Schema::dropIfExists('store_application_evidence');
        DB::statement('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_verification_status_valid');
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_verification_status_valid CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'))");
    }
};
