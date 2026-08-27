import { apiClient } from "./apiClient";
import {
  arrayField,
  enumField,
  nullableStringField,
  numberField,
  record,
  stringArrayField,
  stringField,
} from "./apiContract";
import {
  mapAdminPlatformSettings,
  type AdminPlatformSettings,
  type UpdatePlatformSettingsInput,
} from "./platformSettingsApi";

export type { AdminPlatformSettings, UpdatePlatformSettingsInput } from "./platformSettingsApi";

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

  async overview(): Promise<PlatformOverview> {
    const payload = record(await apiClient.request<unknown>("/api/admin/overview"), "ملخص إدارة المنصة");

    return mapOverview(payload.data);
  },

  async listStores(query: PlatformStoreQuery = {}, signal?: AbortSignal): Promise<PaginatedResult<PlatformStore>> {
    const payload = await apiClient.request<unknown>(queryPath("/api/admin/stores", query), { signal });

    return mapPaginated(payload, "قائمة متاجر المنصة", mapStore);
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
