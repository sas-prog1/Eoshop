import { apiClient, ApiError } from "./apiClient";
import { booleanField, enumField, nullableStringField, record, stringArrayField, stringField } from "./apiContract";
import { sanitizeCheckoutConfig } from "../contracts/checkoutPolicy";
import { storeOnboardingAppearance, type StoreOnboardingAppearance } from "../contracts/storeOnboardingAppearance";
import type { StoreConfig } from "../types";
import { randomUuid } from "../utils/randomUuid";
import { requestFingerprint } from "../utils/requestFingerprint";

export interface StoreSubmission {
  id: string;
  storeName: string;
  businessType: string;
  verificationStatus: "pending" | "changes_requested" | "approved" | "rejected" | "suspended";
  provisioningStatus: "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";
  publicationStatus: "requested" | "published" | "unpublished" | "rejected";
  reviewFeedback: string | null;
  capabilities: {
    workspaceManage: boolean;
    catalogManage: boolean;
    inventoryView: boolean;
    inventoryManage: boolean;
    ordersView: boolean;
    ordersManage: boolean;
    draftEdit: boolean;
    resubmit: boolean;
    publish: boolean;
    unpublish: boolean;
  };
  internalDomain: string | null;
  requestedDomain: string | null;
  publicDomain: string | null;
  plan: {
    key: string;
    name: string;
    activationMode: "automatic" | "manual";
  } | null;
  subscriptionStatus: "pending_activation" | "active" | "cancelled" | "expired" | null;
  publicationBlockers: string[];
  createdAt: string | null;
  activeAt: string | null;
  publishedAt: string | null;
  application?: StoreApplicationDossier | null;
}

export interface StoreApplicationEvidence {
  id: string;
  resolution: "uploaded" | "exempted";
  reviewStatus: "pending" | "accepted" | "rejected";
  originalName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  exemptionReason: string | null;
  uploadedAt: string | null;
  downloadUrl: string | null;
}

export interface StoreApplicationRequirement {
  key: string;
  label: string;
  description: string;
  uploadRequired: boolean;
  allowExemption: boolean;
  resolved: boolean;
  evidence: StoreApplicationEvidence | null;
}

export interface StoreApplicationDossier {
  draftId: string;
  tenantId: string | null;
  draftRevision: number;
  ready: boolean;
  blockers: string[];
  requirements: StoreApplicationRequirement[];
  correctionRequest: {
    id: string;
    reason: string;
    requestedFields: string[];
    requestedFieldLabels: string[];
    requestedAt: string | null;
  } | null;
  timeline: Array<{
    id: string;
    type: string;
    actorType: "merchant" | "platform" | "system";
    message: string;
    occurredAt: string | null;
  }>;
}

interface StoreSubmissionResponse {
  data: unknown;
  meta: unknown;
}

export function mapSubmission(value: unknown): StoreSubmission {
  const dto = record(value, "طلب المتجر");
  const planValue = dto.plan;

  return {
    id: stringField(dto, "id", "طلب المتجر"),
    storeName: stringField(dto, "storeName", "طلب المتجر"),
    businessType: stringField(dto, "businessType", "طلب المتجر"),
    verificationStatus: enumField(dto, "verificationStatus", ["pending", "changes_requested", "approved", "rejected", "suspended"] as const, "طلب المتجر"),
    provisioningStatus: enumField(dto, "provisioningStatus", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "طلب المتجر"),
    publicationStatus: enumField(dto, "publicationStatus", ["requested", "published", "unpublished", "rejected"] as const, "طلب المتجر"),
    reviewFeedback: nullableStringField(dto, "reviewFeedback", "طلب المتجر"),
    capabilities: (() => {
      const capabilities = record(dto.capabilities, "صلاحيات طلب المتجر");
      return {
        workspaceManage: booleanField(capabilities, "workspaceManage", "صلاحيات طلب المتجر"),
        catalogManage: booleanField(capabilities, "catalogManage", "صلاحيات طلب المتجر"),
        inventoryView: booleanField(capabilities, "inventoryView", "صلاحيات طلب المتجر"),
        inventoryManage: booleanField(capabilities, "inventoryManage", "صلاحيات طلب المتجر"),
        ordersView: booleanField(capabilities, "ordersView", "صلاحيات طلب المتجر"),
        ordersManage: booleanField(capabilities, "ordersManage", "صلاحيات طلب المتجر"),
        draftEdit: booleanField(capabilities, "draftEdit", "صلاحيات طلب المتجر"),
        resubmit: booleanField(capabilities, "resubmit", "صلاحيات طلب المتجر"),
        publish: booleanField(capabilities, "publish", "صلاحيات طلب المتجر"),
        unpublish: booleanField(capabilities, "unpublish", "صلاحيات طلب المتجر"),
      };
    })(),
    internalDomain: nullableStringField(dto, "internalDomain", "طلب المتجر"),
    requestedDomain: nullableStringField(dto, "requestedDomain", "طلب المتجر"),
    publicDomain: nullableStringField(dto, "publicDomain", "طلب المتجر"),
    plan: planValue === null ? null : (() => {
      const plan = record(planValue, "باقة طلب المتجر");
      return {
        key: stringField(plan, "key", "باقة طلب المتجر"),
        name: stringField(plan, "name", "باقة طلب المتجر"),
        activationMode: enumField(plan, "activationMode", ["automatic", "manual"] as const, "باقة طلب المتجر"),
      };
    })(),
    subscriptionStatus: dto.subscriptionStatus === null
      ? null
      : enumField(dto, "subscriptionStatus", ["pending_activation", "active", "cancelled", "expired"] as const, "طلب المتجر"),
    publicationBlockers: stringArrayField(dto, "publicationBlockers", "طلب المتجر"),
    createdAt: nullableStringField(dto, "createdAt", "طلب المتجر"),
    activeAt: nullableStringField(dto, "activeAt", "طلب المتجر"),
    publishedAt: nullableStringField(dto, "publishedAt", "طلب المتجر"),
    application: dto.application === null ? null : mapApplication(dto.application),
  };
}

export interface StoreSubmissionInput {
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string;
  planKey: string;
  config: Record<string, unknown>;
  draftId?: string;
  expectedDraftRevision?: number;
}

export interface StoreDraft {
  id: string;
  tenantId: string | null;
  status: "draft" | "submitted" | "correction_required";
  revision: number;
  onboardingStage: "business" | "design" | "review";
  onboardingReadiness: {
    business: boolean;
    design: boolean;
    review: boolean;
    blockers: string[];
  } | null;
  nextRequiredStep: "business" | "design" | "review" | "submit" | null;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string | null;
  planKey: string | null;
  config: StoreConfig;
  savedAt: string | null;
  submittedAt: string | null;
  application?: StoreApplicationDossier;
}

export interface StoreDraftInput {
  expectedRevision: number;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string | null;
  planKey: string | null;
  config: Record<string, unknown>;
}

function numberField(dto: Record<string, unknown>, key: string, context: string): number {
  const value = dto[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiError(`استجابة ${context} لا تحتوي ${key} صالحًا.`, "unexpected", 200);
  }
  return value;
}

function mapDraft(value: unknown): StoreDraft {
  const dto = record(value, "مسودة المتجر");
  return {
    id: stringField(dto, "id", "مسودة المتجر"),
    tenantId: nullableStringField(dto, "tenantId", "مسودة المتجر"),
    status: enumField(dto, "status", ["draft", "submitted", "correction_required"] as const, "مسودة المتجر"),
    revision: numberField(dto, "revision", "مسودة المتجر"),
    onboardingStage: enumField(dto, "onboardingStage", ["business", "design", "review"] as const, "مسودة المتجر"),
    onboardingReadiness: dto.onboardingReadiness === null ? null : (() => {
      const readiness = record(dto.onboardingReadiness, "جاهزية مسودة المتجر");
      return {
        business: booleanField(readiness, "business", "جاهزية مسودة المتجر"),
        design: booleanField(readiness, "design", "جاهزية مسودة المتجر"),
        review: booleanField(readiness, "review", "جاهزية مسودة المتجر"),
        blockers: stringArrayField(readiness, "blockers", "جاهزية مسودة المتجر"),
      };
    })(),
    nextRequiredStep: dto.nextRequiredStep === null
      ? null
      : enumField(dto, "nextRequiredStep", ["business", "design", "review", "submit"] as const, "مسودة المتجر"),
    storeName: stringField(dto, "storeName", "مسودة المتجر"),
    businessType: stringField(dto, "businessType", "مسودة المتجر"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "مسودة المتجر"),
    handle: nullableStringField(dto, "handle", "مسودة المتجر"),
    planKey: nullableStringField(dto, "planKey", "مسودة المتجر"),
    config: sanitizeCheckoutConfig(record(dto.config, "إعدادات مسودة المتجر") as unknown as StoreConfig),
    savedAt: nullableStringField(dto, "savedAt", "مسودة المتجر"),
    submittedAt: nullableStringField(dto, "submittedAt", "مسودة المتجر"),
    application: mapApplication(dto.application),
  };
}

function nullableNumberField(dto: Record<string, unknown>, key: string, context: string): number | null {
  if (dto[key] === null) return null;
  const value = dto[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiError(`استجابة ${context} لا تحتوي ${key} صالحًا.`, "unexpected", 200);
  }
  return value;
}

function mapApplication(value: unknown): StoreApplicationDossier {
  const dto = record(value, "ملف طلب المتجر");
  if (!Array.isArray(dto.requirements) || !Array.isArray(dto.timeline)) {
    throw new ApiError("استجابة ملف طلب المتجر غير مكتملة.", "unexpected", 200);
  }
  const correctionValue = dto.correctionRequest;

  return {
    draftId: stringField(dto, "draftId", "ملف طلب المتجر"),
    tenantId: nullableStringField(dto, "tenantId", "ملف طلب المتجر"),
    draftRevision: numberField(dto, "draftRevision", "ملف طلب المتجر"),
    ready: booleanField(dto, "ready", "ملف طلب المتجر"),
    blockers: stringArrayField(dto, "blockers", "ملف طلب المتجر"),
    requirements: dto.requirements.map((value) => {
      const requirement = record(value, "متطلب طلب المتجر");
      const evidenceValue = requirement.evidence;
      return {
        key: stringField(requirement, "key", "متطلب طلب المتجر"),
        label: stringField(requirement, "label", "متطلب طلب المتجر"),
        description: stringField(requirement, "description", "متطلب طلب المتجر"),
        uploadRequired: booleanField(requirement, "uploadRequired", "متطلب طلب المتجر"),
        allowExemption: booleanField(requirement, "allowExemption", "متطلب طلب المتجر"),
        resolved: booleanField(requirement, "resolved", "متطلب طلب المتجر"),
        evidence: evidenceValue === null ? null : (() => {
          const evidence = record(evidenceValue, "وثيقة طلب المتجر");
          return {
            id: stringField(evidence, "id", "وثيقة طلب المتجر"),
            resolution: enumField(evidence, "resolution", ["uploaded", "exempted"] as const, "وثيقة طلب المتجر"),
            reviewStatus: enumField(evidence, "reviewStatus", ["pending", "accepted", "rejected"] as const, "وثيقة طلب المتجر"),
            originalName: nullableStringField(evidence, "originalName", "وثيقة طلب المتجر"),
            mimeType: nullableStringField(evidence, "mimeType", "وثيقة طلب المتجر"),
            byteSize: nullableNumberField(evidence, "byteSize", "وثيقة طلب المتجر"),
            exemptionReason: nullableStringField(evidence, "exemptionReason", "وثيقة طلب المتجر"),
            uploadedAt: nullableStringField(evidence, "uploadedAt", "وثيقة طلب المتجر"),
            downloadUrl: nullableStringField(evidence, "downloadUrl", "وثيقة طلب المتجر"),
          };
        })(),
      };
    }),
    correctionRequest: correctionValue === null ? null : (() => {
      const correction = record(correctionValue, "طلب استكمال المتجر");
      return {
        id: stringField(correction, "id", "طلب استكمال المتجر"),
        reason: stringField(correction, "reason", "طلب استكمال المتجر"),
        requestedFields: stringArrayField(correction, "requestedFields", "طلب استكمال المتجر"),
        requestedFieldLabels: stringArrayField(correction, "requestedFieldLabels", "طلب استكمال المتجر"),
        requestedAt: nullableStringField(correction, "requestedAt", "طلب استكمال المتجر"),
      };
    })(),
    timeline: dto.timeline.map((value) => {
      const event = record(value, "سجل طلب المتجر");
      return {
        id: stringField(event, "id", "سجل طلب المتجر"),
        type: stringField(event, "type", "سجل طلب المتجر"),
        actorType: enumField(event, "actorType", ["merchant", "platform", "system"] as const, "سجل طلب المتجر"),
        message: stringField(event, "message", "سجل طلب المتجر"),
        occurredAt: nullableStringField(event, "occurredAt", "سجل طلب المتجر"),
      };
    }),
  };
}

interface PendingSubmission {
  version: 2;
  ownerId: string;
  draftId: string;
  digest: string;
  idempotencyKey: string;
}

const legacyPendingStorageKey = "eoshop.pending-store-submission.v1";
let volatilePending: PendingSubmission | null = null;

export function scrubLegacyPendingSubmission(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(legacyPendingStorageKey);
  } catch {
    // Browser storage is optional; server state remains authoritative.
  }
}

scrubLegacyPendingSubmission();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

async function fingerprint(input: StoreSubmissionInput): Promise<string> {
  return requestFingerprint(JSON.stringify(canonicalize(input)));
}

function pendingStorageKey(ownerId: string, draftId: string): string {
  return `eoshop.pending-store-submission.v2:${ownerId}:${draftId}`;
}

function sameDigest(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

async function acquireIdempotencyKey(input: StoreSubmissionInput, ownerId: string, draftId: string): Promise<PendingSubmission> {
  const requestDigest = await fingerprint(input);
  const persistentStorage = storage();
  let pending = volatilePending;

  if (persistentStorage) {
    try {
      persistentStorage.removeItem(legacyPendingStorageKey);
      pending = JSON.parse(persistentStorage.getItem(pendingStorageKey(ownerId, draftId)) || "null") as PendingSubmission | null;
    } catch {
      pending = null;
    }
  }

  if (!pending || pending.version !== 2 || pending.ownerId !== ownerId || pending.draftId !== draftId || !sameDigest(pending.digest, requestDigest)) {
    pending = { version: 2, ownerId, draftId, digest: requestDigest, idempotencyKey: randomUuid() };
  }

  volatilePending = pending;
  persistentStorage?.setItem(pendingStorageKey(ownerId, draftId), JSON.stringify(pending));

  return pending;
}

function clearPendingSubmission(pending: PendingSubmission): void {
  if (volatilePending?.idempotencyKey === pending.idempotencyKey) volatilePending = null;
  const persistentStorage = storage();
  if (!persistentStorage) return;

  try {
    const key = pendingStorageKey(pending.ownerId, pending.draftId);
    const stored = JSON.parse(persistentStorage.getItem(key) || "null") as PendingSubmission | null;
    if (stored?.idempotencyKey === pending.idempotencyKey) persistentStorage.removeItem(key);
  } catch {
    persistentStorage.removeItem(pendingStorageKey(pending.ownerId, pending.draftId));
  }
}

function pendingSubmissionsForOwner(ownerId: string): PendingSubmission[] {
  const candidates: PendingSubmission[] = [];
  if (volatilePending?.ownerId === ownerId) candidates.push(volatilePending);
  const persistentStorage = storage();
  if (!persistentStorage) return candidates;

  const prefix = `eoshop.pending-store-submission.v2:${ownerId}:`;
  for (let index = 0; index < persistentStorage.length; index += 1) {
    const key = persistentStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const pending = JSON.parse(persistentStorage.getItem(key) || "null") as PendingSubmission | null;
      if (pending?.version === 2 && pending.ownerId === ownerId && typeof pending.draftId === "string"
        && typeof pending.digest === "string" && typeof pending.idempotencyKey === "string"
        && !candidates.some((candidate) => candidate.draftId === pending.draftId)) candidates.push(pending);
    } catch {
      persistentStorage.removeItem(key);
    }
  }
  return candidates;
}

export const provisioningApi = {
  clearPendingForOwner(ownerId: string): void {
    if (volatilePending?.ownerId === ownerId) volatilePending = null;
    const persistentStorage = storage();
    if (!persistentStorage) return;
    const prefix = `eoshop.pending-store-submission.v2:${ownerId}:`;
    const remove: string[] = [];
    for (let index = 0; index < persistentStorage.length; index += 1) {
      const key = persistentStorage.key(index);
      if (key?.startsWith(prefix) || key?.startsWith(`eoshop.pending-store-resubmission.v2:${ownerId}:`)) remove.push(key);
    }
    remove.forEach((key) => persistentStorage.removeItem(key));
    persistentStorage.removeItem(legacyPendingStorageKey);
  },

  async currentDraft(signal?: AbortSignal): Promise<StoreDraft | null> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft", { signal });
    const envelope = record(response, "استجابة المسودة الحالية");
    return envelope.data === null ? null : mapDraft(envelope.data);
  },

  async application(draftId: string, signal?: AbortSignal): Promise<StoreApplicationDossier> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/store-drafts/${encodeURIComponent(draftId)}/application`, { signal });
    return mapApplication(record(response, "ملف طلب المتجر").data);
  },

  async uploadApplicationEvidence(draftId: string, requirementKey: string, expectedRevision: number, file: File, signal?: AbortSignal): Promise<StoreApplicationDossier> {
    const idempotencyKey = randomUuid();
    const body = new FormData();
    body.append("expectedRevision", String(expectedRevision));
    body.append("document", file);
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/store-drafts/${encodeURIComponent(draftId)}/evidence/${encodeURIComponent(requirementKey)}`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
      signal,
    });
    return mapApplication(record(response, "رفع وثيقة طلب المتجر").data);
  },

  async exemptApplicationRequirement(draftId: string, requirementKey: string, expectedRevision: number, reason: string, signal?: AbortSignal): Promise<StoreApplicationDossier> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/store-drafts/${encodeURIComponent(draftId)}/exemptions/${encodeURIComponent(requirementKey)}`, {
      method: "PUT",
      body: { expectedRevision, reason },
      signal,
    });
    return mapApplication(record(response, "إعفاء متطلب طلب المتجر").data);
  },

  async recoverCommittedSubmission(ownerId: string, signal?: AbortSignal): Promise<StoreSubmission | null> {
    for (const pending of pendingSubmissionsForOwner(ownerId)) {
      try {
        const response = await apiClient.request<{ data: unknown }>(
          `/api/merchant/store-drafts/${encodeURIComponent(pending.draftId)}/submission`,
          { signal },
        );
        const submission = mapSubmission(record(response, "استعادة طلب المتجر").data);
        clearPendingSubmission(pending);
        return submission;
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) continue;
        throw caught;
      }
    }
    return null;
  },

  async correctionDraft(tenantId: string, signal?: AbortSignal): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/draft`, { signal });
    return mapDraft(record(response, "استجابة مسودة التصحيح").data);
  },

  async saveDraft(input: StoreDraftInput): Promise<StoreDraft> {
    const businessResponse = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/business", {
      method: "PUT",
      body: {
        expectedRevision: input.expectedRevision,
        storeName: input.storeName,
        businessType: input.businessType,
      },
    });
    let draft = mapDraft(record(businessResponse, "استجابة حفظ بيانات النشاط").data);
    const designResponse = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/design", {
      method: "PUT",
      body: {
        expectedRevision: draft.revision,
        themeStyle: input.themeStyle,
        config: storeOnboardingAppearance(input.config as unknown as StoreConfig),
      },
    });
    draft = mapDraft(record(designResponse, "استجابة حفظ تصميم المسودة").data);
    if (input.handle && input.planKey) {
      const reviewResponse = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/review", {
        method: "PUT",
        body: { expectedRevision: draft.revision, handle: input.handle, planKey: input.planKey },
      });
      draft = mapDraft(record(reviewResponse, "استجابة حفظ مراجعة المسودة").data);
    }
    return draft;
  },

  async saveBusiness(input: { expectedRevision: number; storeName: string; businessType: string }, signal?: AbortSignal): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/business", { method: "PUT", body: input, signal });
    return mapDraft(record(response, "استجابة حفظ بيانات النشاط").data);
  },

  async saveDesign(input: { expectedRevision: number; themeStyle: "elegant" | "tech"; config: StoreOnboardingAppearance }, signal?: AbortSignal): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/design", { method: "PUT", body: input, signal });
    return mapDraft(record(response, "استجابة حفظ تصميم المتجر").data);
  },

  async saveReview(input: { expectedRevision: number; handle: string; planKey: string }, signal?: AbortSignal): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft/review", { method: "PUT", body: input, signal });
    return mapDraft(record(response, "استجابة حفظ مراجعة المتجر").data);
  },

  async saveCorrection(tenantId: string, input: StoreDraftInput): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/draft`, {
      method: "PATCH",
      body: input,
    });
    return mapDraft(record(response, "استجابة حفظ التصحيح").data);
  },

  async listStores(signal?: AbortSignal): Promise<StoreSubmission[]> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/stores", { signal });
    const envelope = record(response, "قائمة متاجر التاجر");
    const data = envelope.data;
    if (!Array.isArray(data)) throw new ApiError("استجابة الخادم لا تطابق عقد قائمة متاجر التاجر.", "unexpected", 200);

    return data.map(mapSubmission);
  },

  async submit(input: StoreSubmissionInput, ownerId: string, signal?: AbortSignal): Promise<{ data: StoreSubmission; meta: { replayed: boolean } }> {
    if (!input.draftId) throw new ApiError("يتطلب إرسال المتجر مسودة خادم محفوظة.", "validation", 422);
    const pending = await acquireIdempotencyKey(input, ownerId, input.draftId);
    const response = await apiClient.request<StoreSubmissionResponse>("/api/register-store", {
      method: "POST",
      body: {
        storeName: input.storeName,
        businessType: input.businessType,
        themeStyle: input.themeStyle,
        handle: input.handle,
        planKey: input.planKey,
        config: input.config,
        draftId: input.draftId,
        expectedDraftRevision: input.expectedDraftRevision,
      },
      headers: { "Idempotency-Key": pending.idempotencyKey },
      retrySafety: "idempotent",
      signal,
    });

    const envelope = record(response, "استجابة طلب المتجر");
    const meta = record(envelope.meta, "بيانات تكرار طلب المتجر");
    const result = {
      data: mapSubmission(envelope.data),
      meta: { replayed: booleanField(meta, "replayed", "بيانات تكرار طلب المتجر") },
    };

    // A 2xx response is authoritative only after its complete resource
    // projection is mapped. Keeping the bounded receipt on a malformed or
    // truncated response lets the same owner recover the committed operation.
    clearPendingSubmission(pending);

    return result;
  },

  async resubmit(tenantId: string, expectedRevision: number, ownerId: string): Promise<{ data: StoreSubmission; meta: { replayed: boolean } }> {
    const storageKey = `eoshop.pending-store-resubmission.v2:${ownerId}:${tenantId}`;
    let idempotencyKey: string = randomUuid();
    try {
      const pending = JSON.parse(localStorage.getItem(storageKey) || "null") as { revision?: number; key?: string } | null;
      if (pending?.revision === expectedRevision && typeof pending.key === "string") idempotencyKey = pending.key;
      localStorage.setItem(storageKey, JSON.stringify({ revision: expectedRevision, key: idempotencyKey }));
    } catch {
      // Browser recovery is optional; the server remains authoritative.
    }
    const response = await apiClient.request<StoreSubmissionResponse>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/resubmit`, {
      method: "POST",
      body: { expectedRevision },
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
    });
    const envelope = record(response, "استجابة إعادة إرسال المتجر");
    const meta = record(envelope.meta, "بيانات تكرار إعادة الإرسال");
    const result = {
      data: mapSubmission(envelope.data),
      meta: { replayed: booleanField(meta, "replayed", "بيانات تكرار إعادة الإرسال") },
    };
    try { localStorage.removeItem(storageKey); } catch { /* optional recovery */ }
    return result;
  },

  async publish(tenantId: string): Promise<StoreSubmission> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/publication/publish`, { method: "POST" });
    return mapSubmission(record(response, "استجابة نشر المتجر").data);
  },

  async unpublish(tenantId: string): Promise<StoreSubmission> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/publication/unpublish`, { method: "POST" });
    return mapSubmission(record(response, "استجابة إلغاء نشر المتجر").data);
  },
};
