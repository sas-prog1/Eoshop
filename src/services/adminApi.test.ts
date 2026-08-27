import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./adminApi";
import { apiClient } from "./apiClient";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

const store = {
  id: "store-test",
  storeName: "Test Store",
  ownerName: "Owner",
  ownerEmail: "owner@example.com",
  ownerPhone: null,
  businessType: "retail",
  verificationStatus: "pending" as const,
  provisioningStatus: "not_started" as const,
  publicationStatus: "requested" as const,
  rejectionReason: null,
  themeStyle: "elegant" as const,
  domains: ["store-test"],
  requestedDomain: "store-test.eoshop.local",
  publicDomain: null,
  publicationBlockers: ["review_not_approved"],
  subscription: {
    id: "subscription-test",
    status: "pending_activation" as const,
    endsAt: null,
    plan: { key: "pro", name: "Pro", activationMode: "manual" as const },
  },
  createdAt: "2026-08-13T00:00:00Z",
  activeAt: null,
  latestProvisioningRun: null,
};

const platformRole = {
  key: "platform_reviewer",
  name: "Platform Reviewer",
  description: null,
  permissionKeys: ["platform.audit.view", "platform.stores.review", "platform.stores.view"],
};

const platformUser = {
  id: "01PLATFORMUSER",
  name: "Platform Operator",
  email: "operator@example.test",
  status: "active" as const,
  resumeStatus: null,
  roles: [{ key: platformRole.key, name: platformRole.name }],
  platformPermissions: platformRole.permissionKeys,
  activeTenantMembershipCount: 1,
  emailVerifiedAt: "2026-08-21T10:00:00Z",
  lastLoginAt: null,
  createdAt: "2026-08-21T09:00:00Z",
};

const storeDetail = {
  ...store,
  applicationWorkspace: {
    snapshot: {
      draftId: "draft-test",
      revision: 4,
      submittedAt: "2026-08-27T10:00:00Z",
      storeName: store.storeName,
      businessType: store.businessType,
      themeStyle: store.themeStyle,
      handle: "store-test",
      planKey: "pro",
      planName: "Pro",
      config: { storeName: store.storeName, slogan: "Frozen submission" },
    },
    dossier: {
      draftId: "draft-test",
      tenantId: store.id,
      draftRevision: 4,
      ready: true,
      reviewReady: false,
      blockers: [],
      reviewBlockers: ["owner_identity"],
      requirements: [{
        key: "owner_identity",
        label: "Owner identity",
        description: "Private evidence",
        uploadRequired: true,
        allowExemption: false,
        resolved: true,
        evidence: {
          id: "00000000-0000-4000-8000-000000000001",
          resolution: "uploaded",
          reviewStatus: "pending",
          originalName: "identity.pdf",
          mimeType: "application/pdf",
          byteSize: 1024,
          exemptionReason: null,
          uploadedAt: "2026-08-27T09:00:00Z",
          downloadUrl: `/api/admin/stores/${store.id}/application/evidence/00000000-0000-4000-8000-000000000001`,
        },
      }],
      correctionRequest: null,
      timeline: [],
    },
    checklist: [{ key: "owner_identity", label: "Owner identity", status: "pending", resolved: true }],
    decisionReady: false,
  },
  operations: {
    tenant: { id: store.id, schemaName: "tenant_store_test" },
    health: { review: false, provisioning: false, domain: true, subscription: false, publication: false },
    blockers: ["review_not_approved"],
    provisioning: null,
    publication: {
      status: "requested",
      requestedAt: "2026-08-27T10:00:00Z",
      publishedAt: null,
      requestedDomain: store.requestedDomain,
      publicDomain: null,
    },
  },
};

describe("adminApi", () => {
  it("loads authoritative platform stores with same-origin credentials", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      data: [{ ...store, databasePassword: "must-not-escape" }],
      meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
    }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await adminApi.listStores({ attention: "review", page: 2 });
    expect(result.items).toEqual([store]);
    expect(result.items[0]).not.toHaveProperty("databasePassword");
    expect(result.pagination).toEqual({ currentPage: 1, lastPage: 1, perPage: 25, total: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores?attention=review&page=2", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("maps the strict review workspace and sends bounded evidence decisions", async () => {
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "evidence-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ data: { ...storeDetail, databasePassword: "must-not-escape" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const detail = await adminApi.getStore(store.id);
    expect(detail.applicationWorkspace?.snapshot.config).toEqual({ storeName: store.storeName, slogan: "Frozen submission" });
    expect(detail.applicationWorkspace?.decisionReady).toBe(false);
    expect(detail.operations.tenant.schemaName).toBe("tenant_store_test");
    expect(detail).not.toHaveProperty("databasePassword");

    await adminApi.reviewStoreEvidence(store.id, "00000000-0000-4000-8000-000000000001", "rejected", "Image is incomplete");
    const mutation = fetchMock.mock.calls.find(([path]) => path.includes("/application/evidence/"));
    expect(mutation?.[0]).toBe(`/api/admin/stores/${store.id}/application/evidence/00000000-0000-4000-8000-000000000001`);
    expect(JSON.parse((mutation?.[1] as RequestInit).body as string)).toEqual({ status: "rejected", note: "Image is incomplete" });
  });

  it("maps the overview and allowlisted audit projection", async () => {
    const overview = {
      generatedAt: "2026-08-21T12:00:00Z",
      stores: {
        total: 4,
        verification: { pending: 1, changesRequested: 0, approved: 2, rejected: 1, suspended: 0 },
        provisioning: { notStarted: 1, queued: 0, provisioning: 0, retrying: 0, active: 2, failed: 1 },
        publication: { requested: 2, published: 1, unpublished: 1, rejected: 0 },
      },
      attention: { review: 1, provisioning: 1, subscription: 1, publication: 2 },
    };
    const audit = {
      id: 17,
      actorUserId: "01ADMIN",
      tenantId: store.id,
      action: "platform.store.verification_status.changed",
      subjectType: "tenant",
      subjectId: store.id,
      changedFields: ["verification_status"],
      ipAddress: null,
      requestId: "11111111-1111-4111-8111-111111111111",
      occurredAt: "2026-08-21T12:01:00Z",
    };
    const fetchMock = vi.fn((path: string) => Promise.resolve(new Response(JSON.stringify(
      path === "/api/admin/overview"
        ? { data: overview }
        : { data: [{ ...audit, oldValues: { secret: true }, userAgent: "must-not-escape" }], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.overview()).resolves.toEqual({
      ...overview,
      stores: {
        ...overview.stores,
        verification: { pending: 1, changes_requested: 0, approved: 2, rejected: 1, suspended: 0 },
      },
    });
    const events = await adminApi.listAuditLogs({ search: "verification", page: 1 });
    expect(events.items).toEqual([audit]);
    expect(events.items[0]).not.toHaveProperty("oldValues");
    expect(events.items[0]).not.toHaveProperty("userAgent");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/audit-logs?search=verification&page=1");
  });

  it("maps allowlisted platform roles and users", async () => {
    const fetchMock = vi.fn((path: string) => Promise.resolve(new Response(JSON.stringify(
      path === "/api/admin/platform-roles"
        ? { data: [{ ...platformRole, internalId: 7 }] }
        : {
          data: [{ ...platformUser, password: "must-not-escape", rememberToken: "must-not-escape" }],
          meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
        },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.listPlatformRoles()).resolves.toEqual([platformRole]);
    const result = await adminApi.listUsers({ status: "active", page: 1 });
    expect(result.items).toEqual([platformUser]);
    expect(result.items[0]).not.toHaveProperty("password");
    expect(result.items[0]).not.toHaveProperty("rememberToken");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/users?status=active&page=1");
  });

  it("uses explicit optimistic platform-user mutations", async () => {
    const pending = { ...platformUser, status: "pending" as const, emailVerifiedAt: null };
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "users-csrf" }), { status: 200 })
      : path === "/api/admin/users"
        ? new Response(JSON.stringify({ data: pending, invitationDispatch: { status: "accepted" } }), { status: 201 })
        : path.endsWith("/invitation")
          ? new Response(JSON.stringify({ invitationDispatch: { status: "accepted" } }), { status: 202 })
          : new Response(JSON.stringify({ data: platformUser, meta: { requestId: "request-id" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.inviteUser({
      name: pending.name,
      email: pending.email,
      roleKeys: [platformRole.key],
    })).resolves.toEqual({ user: pending, invitationDispatchStatus: "accepted" });
    await adminApi.replaceUserRoles(platformUser.id, [platformRole.key], ["platform_super_admin"]);
    await adminApi.updateUserStatus(platformUser.id, "active", "suspended");
    await expect(adminApi.resendUserInvitation(platformUser.id)).resolves.toBe("accepted");

    const calls = fetchMock.mock.calls.filter(([path]) => path !== "/api/auth/csrf");
    expect(calls.map(([path]) => path)).toEqual([
      "/api/admin/users",
      "/api/admin/users/01PLATFORMUSER/roles",
      "/api/admin/users/01PLATFORMUSER/status",
      "/api/admin/users/01PLATFORMUSER/invitation",
    ]);
    expect(JSON.parse((calls[1][1] as RequestInit).body as string)).toEqual({
      expectedRoleKeys: [platformRole.key],
      roleKeys: ["platform_super_admin"],
    });
    expect(JSON.parse((calls[2][1] as RequestInit).body as string)).toEqual({
      expectedStatus: "active",
      status: "suspended",
    });
  });

  it("uses CSRF and PATCH for a review decision", async () => {
    const approved = { ...store, verificationStatus: "approved" as const };
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "admin-csrf" }), { status: 200 })
      : new Response(JSON.stringify({
        data: approved,
        meta: { requestId: "11111111-1111-4111-8111-111111111111" },
      }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.updateStoreStatus(store.id, "approved")).resolves.toEqual(approved);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/stores/store-test/status",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "admin-csrf" }),
      }),
    );
  });

  it("queues a manage-only provisioning retry", async () => {
    const retrying = { ...store, verificationStatus: "approved" as const, provisioningStatus: "retrying" as const };
    const fetchMock = vi.fn((path: string) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "retry-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ data: retrying, meta: { requestId: "11111111-1111-4111-8111-111111111111" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.retryProvisioning(store.id)).resolves.toEqual(retrying);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/stores/store-test/provisioning/retry",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("calls the explicit subscription and publication lifecycle endpoints", async () => {
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "publication-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ data: store, meta: { requestId: "request-id" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await adminApi.activateSubscription(store.id, "2026-09-15T00:00:00.000Z");
    await adminApi.publish(store.id);
    await adminApi.unpublish(store.id);

    const mutationPaths = fetchMock.mock.calls.map(([path]) => path).filter((path) => path !== "/api/auth/csrf");
    expect(mutationPaths).toEqual([
      "/api/admin/stores/store-test/subscription/activate",
      "/api/admin/stores/store-test/publication/publish",
      "/api/admin/stores/store-test/publication/unpublish",
    ]);
    expect(JSON.parse((fetchMock.mock.calls.find(([path]) => path.includes("subscription/activate"))?.[1] as RequestInit).body as string))
      .toEqual({ endsAt: "2026-09-15T00:00:00.000Z" });
  });
});
