import { apiClient, ApiError } from "./apiClient";
import { randomUuid } from "../utils/randomUuid";
import { isManagedPlatformAssetUrl } from "../utils/platformIdentityImageUrl";
import {
  arrayField,
  booleanField,
  enumField,
  nullableStringField,
  numberField,
  record,
  stringArrayField,
  stringField,
} from "./apiContract";
import { mapApplication, type StoreApplicationDossier } from "./provisioningApi";
import {
  mapAdminPlatformSettings,
  type AdminPlatformSettings,
  type UpdatePlatformSettingsInput,
} from "./platformSettingsApi";

export type { AdminPlatformSettings, UpdatePlatformSettingsInput } from "./platformSettingsApi";

export type PlatformAssetPurpose = "landing_hero" | "authentication";

export interface PlatformAssetUpload {
  id: string;
  url: string;
  purpose: PlatformAssetPurpose;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
}

export interface PlatformAssetUploadOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function mapPlatformAssetUpload(value: unknown): PlatformAssetUpload {
  const envelope = record(value, "رفع أصل هوية المنصة");
  const dto = record(envelope.data, "أصل هوية المنصة");
  const purpose = enumField(dto, "purpose", ["landing_hero", "authentication"] as const, "أصل هوية المنصة");
  const mimeType = enumField(dto, "mimeType", ["image/jpeg", "image/png", "image/webp"] as const, "أصل هوية المنصة");
  const url = stringField(dto, "url", "أصل هوية المنصة");
  if (!isManagedPlatformAssetUrl(url)) {
    throw new ApiError("استجابة الخادم لا تطابق مسار أصل المنصة المُدار.", "unexpected", 200);
  }
  return {
    id: stringField(dto, "id", "أصل هوية المنصة"),
    url,
    purpose,
    mimeType,
    byteSize: numberField(dto, "byteSize", "أصل هوية المنصة"),
    width: numberField(dto, "width", "أصل هوية المنصة"),
    height: numberField(dto, "height", "أصل هوية المنصة"),
  };
}

export type VerificationStatus = "approved" | "pending" | "changes_requested" | "rejected" | "suspended";
export type ProvisioningStatus = "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";
export type PublicationStatus = "requested" | "published" | "unpublished" | "rejected";
export type PlatformAttentionQueue = "review" | "provisioning" | "subscription" | "publication";
export type PlatformUserStatus = "pending" | "active" | "suspended";
export type InvitationDispatchStatus = "accepted" | "throttled" | "failed";

export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PlatformOverview {
  generatedAt: string;
  stores: {
    total: number;
    verification: Record<VerificationStatus, number>;
    provisioning: {
      notStarted: number;
      queued: number;
      provisioning: number;
      retrying: number;
      active: number;
      failed: number;
    };
    publication: Record<PublicationStatus, number>;
  };
  attention: Record<PlatformAttentionQueue, number>;
}

export interface PlatformStoreQuery {
  search?: string;
  verification?: VerificationStatus;
  provisioning?: ProvisioningStatus;
  publication?: PublicationStatus;
  attention?: PlatformAttentionQueue;
  page?: number;
  perPage?: number;
}

export interface AdminAuditQuery {
  search?: string;
  action?: string;
  tenantId?: string;
  page?: number;
  perPage?: number;
}

export interface PlatformUserQuery {
  search?: string;
  status?: PlatformUserStatus;
  role?: string;
  page?: number;
  perPage?: number;
}

export interface PlatformRole {
  key: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  status: PlatformUserStatus;
  resumeStatus: "active" | "pending" | null;
  roles: Array<{ key: string; name: string }>;
  platformPermissions: string[];
  activeTenantMembershipCount: number;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface InvitePlatformUserInput {
  name: string;
  email: string;
  roleKeys: string[];
}

export interface InvitePlatformUserResult {
  user: PlatformUser;
  invitationDispatchStatus: InvitationDispatchStatus;
}

export interface AdminAuditEvent {
  id: number;
  actorUserId: string | null;
  tenantId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  changedFields: string[];
  ipAddress: string | null;
  requestId: string | null;
  occurredAt: string | null;
}

export interface PlatformStore {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  businessType: string;
  verificationStatus: VerificationStatus;
  provisioningStatus: ProvisioningStatus;
  publicationStatus: PublicationStatus;
  rejectionReason: string | null;
  themeStyle: "elegant" | "tech";
  domains: string[];
  requestedDomain: string | null;
  publicDomain: string | null;
  publicationBlockers: string[];
  subscription: {
    id: string;
    status: "pending_activation" | "active" | "cancelled" | "expired";
    endsAt: string | null;
    plan: {
      key: string;
      name: string;
      activationMode: "automatic" | "manual";
    };
  } | null;
  createdAt: string | null;
  activeAt: string | null;
  latestProvisioningRun: {
    id: string;
    status: ProvisioningStatus;
    runNumber: number;
    lastCompletedStep: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  } | null;
}

export interface PlatformStoreDetail extends PlatformStore {
  applicationWorkspace: {
    snapshot: {
      draftId: string;
      revision: number;
      submittedAt: string | null;
      storeName: string;
      businessType: string;
      themeStyle: "elegant" | "tech";
      handle: string;
      planKey: string;
      planName: string | null;
      config: Record<string, unknown>;
    };
    dossier: StoreApplicationDossier & {
      reviewReady: boolean;
      reviewBlockers: string[];
    };
    checklist: Array<{
      key: string;
      label: string;
      status: "missing" | "pending" | "accepted" | "rejected";
      resolved: boolean;
    }>;
    decisionReady: boolean;
  } | null;
  operations: {
    tenant: { id: string; schemaName: string };
    health: {
      review: boolean;
      provisioning: boolean;
      domain: boolean;
      subscription: boolean;
      publication: boolean;
    };
    blockers: string[];
    provisioning: null | {
      id: string;
      status: ProvisioningStatus;
      runNumber: number;
      schemaName: string;
      schemaOrigin: "platform_created" | "wp21_adopted";
      queuedAt: string | null;
      startedAt: string | null;
      completedAt: string | null;
      failedAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
      steps: Array<{
        step: string;
        status: "running" | "succeeded" | "failed" | "retained";
        startedAt: string | null;
        finishedAt: string | null;
        errorCode: string | null;
      }>;
    };
    publication: {
      status: PublicationStatus;
      requestedAt: string | null;
      publishedAt: string | null;
      requestedDomain: string | null;
      publicDomain: string | null;
    };
  };
}

interface StoreResponse {
  data: unknown;
  meta: { requestId: string };
}

function queryPath(path: string, query: object): string {
  const parameters = new URLSearchParams();
  Object.entries(query as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined) parameters.set(key, String(value));
  });
  const encoded = parameters.toString();

  return encoded ? `${path}?${encoded}` : path;
}

function mapPagination(value: unknown, contract: string): PaginationMeta {
  const meta = record(value, contract);

  return {
    currentPage: numberField(meta, "current_page", contract),
    lastPage: numberField(meta, "last_page", contract),
    perPage: numberField(meta, "per_page", contract),
    total: numberField(meta, "total", contract),
  };
}

function mapPaginated<T>(value: unknown, contract: string, mapper: (item: unknown) => T): PaginatedResult<T> {
  const payload = record(value, contract);

  return {
    items: arrayField(payload, "data", contract).map(mapper),
    pagination: mapPagination(payload.meta, `${contract} pagination`),
  };
}

function mapOverview(value: unknown): PlatformOverview {
  const payload = record(value, "ملخص إدارة المنصة");
  const stores = record(payload.stores, "عدادات متاجر المنصة");
  const verification = record(stores.verification, "عدادات مراجعة المتاجر");
  const provisioning = record(stores.provisioning, "عدادات تجهيز المتاجر");
  const publication = record(stores.publication, "عدادات نشر المتاجر");
  const attention = record(payload.attention, "طوابير إدارة المنصة");

  return {
    generatedAt: stringField(payload, "generatedAt", "ملخص إدارة المنصة"),
    stores: {
      total: numberField(stores, "total", "عدادات متاجر المنصة"),
      verification: {
        pending: numberField(verification, "pending", "عدادات مراجعة المتاجر"),
        changes_requested: numberField(verification, "changesRequested", "عدادات مراجعة المتاجر"),
        approved: numberField(verification, "approved", "عدادات مراجعة المتاجر"),
        rejected: numberField(verification, "rejected", "عدادات مراجعة المتاجر"),
        suspended: numberField(verification, "suspended", "عدادات مراجعة المتاجر"),
      },
      provisioning: {
        notStarted: numberField(provisioning, "notStarted", "عدادات تجهيز المتاجر"),
        queued: numberField(provisioning, "queued", "عدادات تجهيز المتاجر"),
        provisioning: numberField(provisioning, "provisioning", "عدادات تجهيز المتاجر"),
        retrying: numberField(provisioning, "retrying", "عدادات تجهيز المتاجر"),
        active: numberField(provisioning, "active", "عدادات تجهيز المتاجر"),
        failed: numberField(provisioning, "failed", "عدادات تجهيز المتاجر"),
      },
      publication: {
        requested: numberField(publication, "requested", "عدادات نشر المتاجر"),
        published: numberField(publication, "published", "عدادات نشر المتاجر"),
        unpublished: numberField(publication, "unpublished", "عدادات نشر المتاجر"),
        rejected: numberField(publication, "rejected", "عدادات نشر المتاجر"),
      },
    },
    attention: {
      review: numberField(attention, "review", "طوابير إدارة المنصة"),
      provisioning: numberField(attention, "provisioning", "طوابير إدارة المنصة"),
      subscription: numberField(attention, "subscription", "طوابير إدارة المنصة"),
      publication: numberField(attention, "publication", "طوابير إدارة المنصة"),
    },
  };
}

function mapAuditEvent(value: unknown): AdminAuditEvent {
  const dto = record(value, "حدث سجل الإدارة");

  return {
    id: numberField(dto, "id", "حدث سجل الإدارة"),
    actorUserId: nullableStringField(dto, "actorUserId", "حدث سجل الإدارة"),
    tenantId: nullableStringField(dto, "tenantId", "حدث سجل الإدارة"),
    action: stringField(dto, "action", "حدث سجل الإدارة"),
    subjectType: stringField(dto, "subjectType", "حدث سجل الإدارة"),
    subjectId: stringField(dto, "subjectId", "حدث سجل الإدارة"),
    changedFields: stringArrayField(dto, "changedFields", "حدث سجل الإدارة"),
    ipAddress: nullableStringField(dto, "ipAddress", "حدث سجل الإدارة"),
    requestId: nullableStringField(dto, "requestId", "حدث سجل الإدارة"),
    occurredAt: nullableStringField(dto, "occurredAt", "حدث سجل الإدارة"),
  };
}

function mapPlatformRole(value: unknown): PlatformRole {
  const dto = record(value, "دور مستخدم المنصة");

  return {
    key: stringField(dto, "key", "دور مستخدم المنصة"),
    name: stringField(dto, "name", "دور مستخدم المنصة"),
    description: nullableStringField(dto, "description", "دور مستخدم المنصة"),
    permissionKeys: stringArrayField(dto, "permissionKeys", "دور مستخدم المنصة"),
  };
}

function mapPlatformUser(value: unknown): PlatformUser {
  const dto = record(value, "مستخدم المنصة");
  const resumeStatus = dto.resumeStatus === null
    ? null
    : enumField(dto, "resumeStatus", ["active", "pending"] as const, "مستخدم المنصة");

  return {
    id: stringField(dto, "id", "مستخدم المنصة"),
    name: stringField(dto, "name", "مستخدم المنصة"),
    email: stringField(dto, "email", "مستخدم المنصة"),
    status: enumField(dto, "status", ["pending", "active", "suspended"] as const, "مستخدم المنصة"),
    resumeStatus,
    roles: arrayField(dto, "roles", "مستخدم المنصة").map((value) => {
      const role = record(value, "دور المستخدم");
      return {
        key: stringField(role, "key", "دور المستخدم"),
        name: stringField(role, "name", "دور المستخدم"),
      };
    }),
    platformPermissions: stringArrayField(dto, "platformPermissions", "مستخدم المنصة"),
    activeTenantMembershipCount: numberField(dto, "activeTenantMembershipCount", "مستخدم المنصة"),
    emailVerifiedAt: nullableStringField(dto, "emailVerifiedAt", "مستخدم المنصة"),
    lastLoginAt: nullableStringField(dto, "lastLoginAt", "مستخدم المنصة"),
    createdAt: nullableStringField(dto, "createdAt", "مستخدم المنصة"),
  };
}

function mapStore(value: unknown): PlatformStore {
  const dto = record(value, "متجر المنصة");
  const subscriptionValue = dto.subscription;
  const runValue = dto.latestProvisioningRun;

  return {
    id: stringField(dto, "id", "متجر المنصة"),
    storeName: stringField(dto, "storeName", "متجر المنصة"),
    ownerName: stringField(dto, "ownerName", "متجر المنصة"),
    ownerEmail: stringField(dto, "ownerEmail", "متجر المنصة"),
    ownerPhone: nullableStringField(dto, "ownerPhone", "متجر المنصة"),
    businessType: stringField(dto, "businessType", "متجر المنصة"),
    verificationStatus: enumField(dto, "verificationStatus", ["approved", "pending", "changes_requested", "rejected", "suspended"] as const, "متجر المنصة"),
    provisioningStatus: enumField(dto, "provisioningStatus", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "متجر المنصة"),
    publicationStatus: enumField(dto, "publicationStatus", ["requested", "published", "unpublished", "rejected"] as const, "متجر المنصة"),
    rejectionReason: nullableStringField(dto, "rejectionReason", "متجر المنصة"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "متجر المنصة"),
    domains: stringArrayField(dto, "domains", "متجر المنصة"),
    requestedDomain: nullableStringField(dto, "requestedDomain", "متجر المنصة"),
    publicDomain: nullableStringField(dto, "publicDomain", "متجر المنصة"),
    publicationBlockers: stringArrayField(dto, "publicationBlockers", "متجر المنصة"),
    subscription: subscriptionValue === null ? null : (() => {
      const subscription = record(subscriptionValue, "اشتراك المتجر");
      const plan = record(subscription.plan, "باقة الاشتراك");
      return {
        id: stringField(subscription, "id", "اشتراك المتجر"),
        status: enumField(subscription, "status", ["pending_activation", "active", "cancelled", "expired"] as const, "اشتراك المتجر"),
        endsAt: nullableStringField(subscription, "endsAt", "اشتراك المتجر"),
        plan: {
          key: stringField(plan, "key", "باقة الاشتراك"),
          name: stringField(plan, "name", "باقة الاشتراك"),
          activationMode: enumField(plan, "activationMode", ["automatic", "manual"] as const, "باقة الاشتراك"),
        },
      };
    })(),
    createdAt: nullableStringField(dto, "createdAt", "متجر المنصة"),
    activeAt: nullableStringField(dto, "activeAt", "متجر المنصة"),
    latestProvisioningRun: runValue === null ? null : (() => {
      const run = record(runValue, "تشغيل تجهيز المتجر");
      return {
        id: stringField(run, "id", "تشغيل تجهيز المتجر"),
        status: enumField(run, "status", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "تشغيل تجهيز المتجر"),
        runNumber: numberField(run, "runNumber", "تشغيل تجهيز المتجر"),
        lastCompletedStep: nullableStringField(run, "lastCompletedStep", "تشغيل تجهيز المتجر"),
        lastErrorCode: nullableStringField(run, "lastErrorCode", "تشغيل تجهيز المتجر"),
        lastErrorMessage: nullableStringField(run, "lastErrorMessage", "تشغيل تجهيز المتجر"),
      };
    })(),
  };
}

function mapStoreDetail(value: unknown): PlatformStoreDetail {
  const dto = record(value, "مساحة عمل متجر المنصة");
  const workspaceValue = dto.applicationWorkspace;
  const operations = record(dto.operations, "تشغيل متجر المنصة");
  const tenant = record(operations.tenant, "مستأجر متجر المنصة");
  const health = record(operations.health, "صحة متجر المنصة");
  const publication = record(operations.publication, "نشر متجر المنصة");
  const provisioningValue = operations.provisioning;

  return {
    ...mapStore(value),
    applicationWorkspace: workspaceValue === null ? null : (() => {
      const workspace = record(workspaceValue, "ملف مراجعة متجر المنصة");
      const snapshot = record(workspace.snapshot, "نسخة طلب المتجر");
      const dossierDto = record(workspace.dossier, "ملف طلب المتجر للمراجع");
      const dossier = mapApplication(workspace.dossier);
      return {
        snapshot: {
          draftId: stringField(snapshot, "draftId", "نسخة طلب المتجر"),
          revision: numberField(snapshot, "revision", "نسخة طلب المتجر"),
          submittedAt: nullableStringField(snapshot, "submittedAt", "نسخة طلب المتجر"),
          storeName: stringField(snapshot, "storeName", "نسخة طلب المتجر"),
          businessType: stringField(snapshot, "businessType", "نسخة طلب المتجر"),
          themeStyle: enumField(snapshot, "themeStyle", ["elegant", "tech"] as const, "نسخة طلب المتجر"),
          handle: stringField(snapshot, "handle", "نسخة طلب المتجر"),
          planKey: stringField(snapshot, "planKey", "نسخة طلب المتجر"),
          planName: nullableStringField(snapshot, "planName", "نسخة طلب المتجر"),
          config: record(snapshot.config, "تصميم طلب المتجر"),
        },
        dossier: {
          ...dossier,
          reviewReady: booleanField(dossierDto, "reviewReady", "ملف طلب المتجر للمراجع"),
          reviewBlockers: stringArrayField(dossierDto, "reviewBlockers", "ملف طلب المتجر للمراجع"),
        },
        checklist: arrayField(workspace, "checklist", "قائمة فحص الطلب").map((value) => {
          const item = record(value, "بند فحص الطلب");
          return {
            key: stringField(item, "key", "بند فحص الطلب"),
            label: stringField(item, "label", "بند فحص الطلب"),
            status: enumField(item, "status", ["missing", "pending", "accepted", "rejected"] as const, "بند فحص الطلب"),
            resolved: booleanField(item, "resolved", "بند فحص الطلب"),
          };
        }),
        decisionReady: booleanField(workspace, "decisionReady", "ملف مراجعة متجر المنصة"),
      };
    })(),
    operations: {
      tenant: {
        id: stringField(tenant, "id", "مستأجر متجر المنصة"),
        schemaName: stringField(tenant, "schemaName", "مستأجر متجر المنصة"),
      },
      health: {
        review: booleanField(health, "review", "صحة متجر المنصة"),
        provisioning: booleanField(health, "provisioning", "صحة متجر المنصة"),
        domain: booleanField(health, "domain", "صحة متجر المنصة"),
        subscription: booleanField(health, "subscription", "صحة متجر المنصة"),
        publication: booleanField(health, "publication", "صحة متجر المنصة"),
      },
      blockers: stringArrayField(operations, "blockers", "تشغيل متجر المنصة"),
      provisioning: provisioningValue === null ? null : (() => {
        const run = record(provisioningValue, "تفاصيل تجهيز المتجر");
        return {
          id: stringField(run, "id", "تفاصيل تجهيز المتجر"),
          status: enumField(run, "status", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "تفاصيل تجهيز المتجر"),
          runNumber: numberField(run, "runNumber", "تفاصيل تجهيز المتجر"),
          schemaName: stringField(run, "schemaName", "تفاصيل تجهيز المتجر"),
          schemaOrigin: enumField(run, "schemaOrigin", ["platform_created", "wp21_adopted"] as const, "تفاصيل تجهيز المتجر"),
          queuedAt: nullableStringField(run, "queuedAt", "تفاصيل تجهيز المتجر"),
          startedAt: nullableStringField(run, "startedAt", "تفاصيل تجهيز المتجر"),
          completedAt: nullableStringField(run, "completedAt", "تفاصيل تجهيز المتجر"),
          failedAt: nullableStringField(run, "failedAt", "تفاصيل تجهيز المتجر"),
          lastErrorCode: nullableStringField(run, "lastErrorCode", "تفاصيل تجهيز المتجر"),
          lastErrorMessage: nullableStringField(run, "lastErrorMessage", "تفاصيل تجهيز المتجر"),
          steps: arrayField(run, "steps", "خطوات تجهيز المتجر").map((value) => {
            const step = record(value, "خطوة تجهيز المتجر");
            return {
              step: stringField(step, "step", "خطوة تجهيز المتجر"),
              status: enumField(step, "status", ["running", "succeeded", "failed", "retained"] as const, "خطوة تجهيز المتجر"),
              startedAt: nullableStringField(step, "startedAt", "خطوة تجهيز المتجر"),
              finishedAt: nullableStringField(step, "finishedAt", "خطوة تجهيز المتجر"),
              errorCode: nullableStringField(step, "errorCode", "خطوة تجهيز المتجر"),
            };
          }),
        };
      })(),
      publication: {
        status: enumField(publication, "status", ["requested", "published", "unpublished", "rejected"] as const, "نشر متجر المنصة"),
        requestedAt: nullableStringField(publication, "requestedAt", "نشر متجر المنصة"),
        publishedAt: nullableStringField(publication, "publishedAt", "نشر متجر المنصة"),
        requestedDomain: nullableStringField(publication, "requestedDomain", "نشر متجر المنصة"),
        publicDomain: nullableStringField(publication, "publicDomain", "نشر متجر المنصة"),
      },
    },
  };
}

export const adminApi = {
  async getPlatformSettings(): Promise<AdminPlatformSettings> {
    const payload = record(await apiClient.request<unknown>("/api/admin/platform-settings"), "إعدادات إدارة المنصة");
    return mapAdminPlatformSettings(payload.data);
  },

  async updatePlatformSettings(input: UpdatePlatformSettingsInput): Promise<AdminPlatformSettings> {
    const payload = record(await apiClient.request<unknown>("/api/admin/platform-settings", {
      method: "PUT",
      body: input,
    }), "تحديث إعدادات المنصة");
    return mapAdminPlatformSettings(payload.data);
  },

  async uploadPlatformAsset(purpose: PlatformAssetPurpose, file: File, options: PlatformAssetUploadOptions = {}): Promise<PlatformAssetUpload> {
    const idempotencyKey = options.idempotencyKey ?? randomUuid();
    const body = new FormData();
    body.append("purpose", purpose);
    body.append("image", file);

    return mapPlatformAssetUpload(await apiClient.request("/api/admin/platform-assets", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
      signal: options.signal,
    }));
  },

  async overview(): Promise<PlatformOverview> {
    const payload = record(await apiClient.request<unknown>("/api/admin/overview"), "ملخص إدارة المنصة");

    return mapOverview(payload.data);
  },

  async listStores(query: PlatformStoreQuery = {}, signal?: AbortSignal): Promise<PaginatedResult<PlatformStore>> {
    const payload = await apiClient.request<unknown>(queryPath("/api/admin/stores", query), { signal });

    return mapPaginated(payload, "قائمة متاجر المنصة", mapStore);
  },

  async getStore(storeId: string, signal?: AbortSignal): Promise<PlatformStoreDetail> {
    const payload = record(await apiClient.request<unknown>(`/api/admin/stores/${encodeURIComponent(storeId)}`, { signal }), "مساحة عمل متجر المنصة");

    return mapStoreDetail(payload.data);
  },

  async listAuditLogs(query: AdminAuditQuery = {}): Promise<PaginatedResult<AdminAuditEvent>> {
    const payload = await apiClient.request<unknown>(queryPath("/api/admin/audit-logs", query));

    return mapPaginated(payload, "سجل إدارة المنصة", mapAuditEvent);
  },

  async listPlatformRoles(): Promise<PlatformRole[]> {
    const payload = record(await apiClient.request<unknown>("/api/admin/platform-roles"), "أدوار مستخدمي المنصة");

    return arrayField(payload, "data", "أدوار مستخدمي المنصة").map(mapPlatformRole);
  },

  async listUsers(query: PlatformUserQuery = {}): Promise<PaginatedResult<PlatformUser>> {
    const payload = await apiClient.request<unknown>(queryPath("/api/admin/users", query));

    return mapPaginated(payload, "قائمة مستخدمي المنصة", mapPlatformUser);
  },

  async inviteUser(input: InvitePlatformUserInput): Promise<InvitePlatformUserResult> {
    const payload = record(await apiClient.request<unknown>("/api/admin/users", {
      method: "POST",
      body: input,
    }), "دعوة مستخدم المنصة");
    const dispatch = record(payload.invitationDispatch, "حالة إرسال الدعوة");

    return {
      user: mapPlatformUser(payload.data),
      invitationDispatchStatus: enumField(
        dispatch,
        "status",
        ["accepted", "throttled", "failed"] as const,
        "حالة إرسال الدعوة",
      ),
    };
  },

  async replaceUserRoles(
    userId: string,
    expectedRoleKeys: string[],
    roleKeys: string[],
  ): Promise<PlatformUser> {
    const payload = record(await apiClient.request<unknown>(
      `/api/admin/users/${encodeURIComponent(userId)}/roles`, {
        method: "PUT",
        body: { expectedRoleKeys, roleKeys },
      }), "تعديل أدوار مستخدم المنصة");

    return mapPlatformUser(payload.data);
  },

  async updateUserStatus(
    userId: string,
    expectedStatus: PlatformUserStatus,
    status: PlatformUserStatus,
  ): Promise<PlatformUser> {
    const payload = record(await apiClient.request<unknown>(
      `/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: "PATCH",
        body: { expectedStatus, status },
      }), "تحديث حالة مستخدم المنصة");

    return mapPlatformUser(payload.data);
  },

  async resendUserInvitation(userId: string): Promise<InvitationDispatchStatus> {
    const payload = record(await apiClient.request<unknown>(
      `/api/admin/users/${encodeURIComponent(userId)}/invitation`, {
        method: "POST",
        body: {},
      }), "إعادة إرسال دعوة مستخدم المنصة");
    const dispatch = record(payload.invitationDispatch, "حالة إرسال الدعوة");

    return enumField(
      dispatch,
      "status",
      ["accepted", "throttled", "failed"] as const,
      "حالة إرسال الدعوة",
    );
  },

  async updateStoreStatus(
    storeId: string,
    status: VerificationStatus,
    reason?: string,
    requestedFields?: string[],
  ): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
        method: "PATCH",
        body: { status, reason: reason || null, ...(status === "changes_requested" ? { requestedFields: requestedFields ?? [] } : {}) },
      });

    return mapStore(record(payload, "تحديث حالة المتجر").data);
  },

  async reviewStoreEvidence(
    storeId: string,
    evidenceId: string,
    status: "accepted" | "rejected",
    note?: string,
  ): Promise<PlatformStoreDetail> {
    const payload = record(await apiClient.request<unknown>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/application/evidence/${encodeURIComponent(evidenceId)}`,
      { method: "PATCH", body: { status, note: note?.trim() || null } },
    ), "مراجعة وثيقة طلب المتجر");

    return mapStoreDetail(payload.data);
  },

  async retryProvisioning(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/provisioning/retry`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "إعادة تجهيز المتجر").data);
  },

  async activateSubscription(storeId: string, endsAt: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/subscription/activate`, {
        method: "POST",
        body: { endsAt },
      });

    return mapStore(record(payload, "تفعيل اشتراك المتجر").data);
  },

  async publish(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/publication/publish`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "نشر المتجر").data);
  },

  async unpublish(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/publication/unpublish`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "إيقاف نشر المتجر").data);
  },
};
