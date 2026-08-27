import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSubmission, provisioningApi, scrubLegacyPendingSubmission } from "./provisioningApi";
import { apiClient } from "./apiClient";
import { ELEGANT_PRESET } from "../types";

const readyApplication = (draftId: string, draftRevision: number, tenantId: string | null = null) => ({
  draftId,
  tenantId,
  draftRevision,
  ready: true,
  blockers: [],
  requirements: [],
  correctionRequest: null,
  timeline: [],
});

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("provisioningApi", () => {
  it("forwards merchant lifecycle cancellation to the HTTP request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(provisioningApi.listStores(controller.signal)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/stores",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("fails closed when a lifecycle enum or critical projection field is malformed", () => {
    expect(() => mapSubmission({
      id: "tenant-invalid",
      storeName: "Invalid store",
      businessType: "retail",
      verificationStatus: "secret_future_state",
      provisioningStatus: "active",
      publicationStatus: "published",
      reviewFeedback: null,
      capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
      internalDomain: null,
      requestedDomain: null,
      publicDomain: "invalid.example.test",
      plan: null,
      subscriptionStatus: "active",
      publicationBlockers: [],
      createdAt: null,
      activeAt: null,
      publishedAt: null,
    })).toThrow(/عقد طلب المتجر/);
  });

  it("submits the store with CSRF and a durable idempotency key", async () => {
    const response = {
      data: {
        id: "tenant-1",
        storeName: "Store One",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: "store-tenant-1.eoshop.local",
        requestedDomain: "store-one.eoshop.local",
        publicDomain: null,
        plan: { key: "starter", name: "Starter", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
        application: readyApplication("draft-one", 4, "tenant-1"),
        createdAt: "2026-08-14T00:00:00Z",
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: false },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "store-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111", subtle: { digest: async () => new Uint8Array(32).buffer } });

    await expect(provisioningApi.submit({
      storeName: "Store One",
      businessType: "retail",
      themeStyle: "elegant",
      handle: "store-one",
      planKey: "starter",
      config: { marker: "one" },
      draftId: "draft-one",
      expectedDraftRevision: 3,
    }, "owner-one")).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/register-store",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
          "X-CSRF-TOKEN": "store-csrf",
        }),
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string)).toMatchObject({
      handle: "store-one",
      planKey: "starter",
    });
  });

  it("retains the bounded recovery receipt when a successful response projection is incomplete", async () => {
    const values = new Map<string, string>();
    const localStorageMock = {
      get length() { return values.size; },
      key: vi.fn((index: number) => [...values.keys()][index] ?? null),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
      clear: vi.fn(() => values.clear()),
    } as unknown as Storage;
    const incomplete = {
      data: {
        id: "tenant-incomplete",
        storeName: "Incomplete Store",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: "store-tenant-incomplete.example.test",
        requestedDomain: "incomplete.example.test",
        // publicDomain is intentionally omitted to reproduce the Pilot defect.
        plan: { key: "starter", name: "Starter", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: ["review_not_approved"],
        createdAt: null,
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: false },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("crypto", { randomUUID: () => "12121212-1212-4212-8212-121212121212", subtle: { digest: async () => new Uint8Array(32).buffer } });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "projection-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(incomplete), { status: 201 })));

    await expect(provisioningApi.submit({
      storeName: "Incomplete Store",
      businessType: "retail",
      themeStyle: "elegant",
      handle: "incomplete",
      planKey: "starter",
      config: { marker: "incomplete" },
      draftId: "draft-incomplete",
      expectedDraftRevision: 3,
    }, "owner-incomplete")).rejects.toMatchObject({ category: "unexpected" });

    const recoveryKey = "eoshop.pending-store-submission.v2:owner-incomplete:draft-incomplete";
    expect([...values.keys()]).toEqual([recoveryKey]);
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recoveryKey);
  });

  it("retains the resubmission receipt when a successful response projection is incomplete", async () => {
    const values = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    } as unknown as Storage;
    const incomplete = {
      data: {
        id: "tenant-resubmit-incomplete",
        storeName: "Resubmit Store",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: null,
        requestedDomain: "resubmit.example.test",
        // publicDomain is intentionally omitted to keep mapping fail-closed.
        plan: { key: "starter", name: "Starter", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: ["review_not_approved"],
        createdAt: null,
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: false },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("crypto", { randomUUID: () => "13131313-1313-4313-8313-131313131313" });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "resubmit-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(incomplete), { status: 200 })));

    await expect(provisioningApi.resubmit("tenant-resubmit-incomplete", 7, "owner-resubmit"))
      .rejects.toMatchObject({ category: "unexpected" });

    const recoveryKey = "eoshop.pending-store-resubmission.v2:owner-resubmit:tenant-resubmit-incomplete";
    expect(values.has(recoveryKey)).toBe(true);
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(recoveryKey);
  });

  it("saves and maps the authenticated server draft with its optimistic revision", async () => {
    const legacyConfig = {
      ...ELEGANT_PRESET,
      enableBankTransfer: true,
      bankName: "Demo Bank",
      bankAccountName: "Demo Owner",
      bankAccountNumber: "123456789012",
      enableOnlineCard: true,
      enableApplePay: true,
      enableStcPay: true,
      enableEWallets: true,
      customWallets: [{ id: "Wallet-One", name: "Demo", accountNumber: "0501234567", accountName: "Demo", active: true }],
      enableCoupons: true,
      customCoupons: [{ code: "WELCOME10", discountPercent: 10, active: true }],
    };
    const draft = {
      data: {
        id: "draft-1",
        tenantId: null,
        status: "draft",
        revision: 1,
        storeName: "Store Draft",
        businessType: "retail",
        themeStyle: "elegant",
        handle: "store-draft",
        planKey: "starter",
        onboardingStage: "review",
        onboardingReadiness: { business: true, design: true, review: true, blockers: [] },
        nextRequiredStep: "submit",
        config: legacyConfig,
        application: readyApplication("draft-1", 3),
        savedAt: "2026-08-19T12:00:00Z",
        submittedAt: null,
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "draft-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...draft, data: { ...draft.data, revision: 1, onboardingStage: "business", onboardingReadiness: { business: true, design: false, review: false, blockers: ["design_incomplete"] }, nextRequiredStep: "design" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...draft, data: { ...draft.data, revision: 2, onboardingStage: "design", onboardingReadiness: { business: true, design: true, review: false, blockers: ["plan_unavailable", "domain_unavailable"] }, nextRequiredStep: "review" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(draft), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provisioningApi.saveDraft({
      expectedRevision: 0,
      storeName: "Store Draft",
      businessType: "retail",
      themeStyle: "elegant",
      handle: "store-draft",
      planKey: "starter",
      config: { marker: "server" },
    });

    expect(result.config).toMatchObject({
      enableBankTransfer: false,
      enableOnlineCard: false,
      enableApplePay: false,
      enableStcPay: false,
      enableEWallets: false,
      enableCoupons: false,
    });
    expect((result.config.customWallets as Array<{ active: boolean }>)[0].active).toBe(false);
    expect((result.config.customCoupons as Array<{ active: boolean }>)[0].active).toBe(false);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/merchant/store-draft/review",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string)).toMatchObject({
      expectedRevision: 2,
      handle: "store-draft",
      planKey: "starter",
    });
  });

  it("reuses the persisted key after an ambiguous network failure", async () => {
    const values = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    } as unknown as Storage;
    const response = {
      data: {
        id: "tenant-2",
        storeName: "Store Two",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: "store-tenant-2.eoshop.local",
        requestedDomain: "store-two.eoshop.local",
        publicDomain: null,
        plan: { key: "pro", name: "Pro", activationMode: "manual" },
        subscriptionStatus: "pending_activation",
        publicationBlockers: ["review_not_approved"],
        application: readyApplication("draft-two", 6, "tenant-2"),
        createdAt: "2026-08-15T00:00:00Z",
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: true },
    };
    let mutations = 0;
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => {
      if (path === "/api/auth/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ csrf_token: "durable-csrf" }), { status: 200 }));
      }
      mutations += 1;
      return mutations === 1
        ? Promise.reject(new TypeError("ambiguous network failure"))
        : Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
    });
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222", subtle: { digest: async () => new Uint8Array(32).buffer } });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      storeName: "Store Two",
      businessType: "retail",
      themeStyle: "tech" as const,
      handle: "store-two",
      planKey: "pro",
      config: { marker: "two" },
      draftId: "draft-two",
      expectedDraftRevision: 5,
    };

    await expect(provisioningApi.submit(input, "owner-two")).rejects.toMatchObject({ category: "network" });
    await expect(provisioningApi.submit(input, "owner-two")).resolves.toEqual(response);

    const mutationHeaders = fetchMock.mock.calls
      .filter(([path]) => path === "/api/register-store")
      .map(([, options]) => (options as RequestInit).headers as Record<string, string>);
    expect(mutationHeaders).toHaveLength(2);
    expect(mutationHeaders[0]["Idempotency-Key"]).toBe(mutationHeaders[1]["Idempotency-Key"]);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it("recovers a committed submission after reload without storing the canonical payload", async () => {
    const values = new Map<string, string>([
      ["eoshop.pending-store-submission.v1", JSON.stringify({ config: { secret: "legacy" } })],
      ["eoshop.pending-store-submission.v2:owner-recovery:draft-recovery", JSON.stringify({
        version: 2,
        ownerId: "owner-recovery",
        draftId: "draft-recovery",
        digest: "a".repeat(64),
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      })],
    ]);
    const localStorageMock = {
      get length() { return values.size; },
      key: vi.fn((index: number) => [...values.keys()][index] ?? null),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
      clear: vi.fn(() => values.clear()),
    } as unknown as Storage;
    const recovered = {
      id: "tenant-recovery",
      storeName: "Recovered Store",
      businessType: "retail",
      verificationStatus: "pending",
      provisioningStatus: "not_started",
      publicationStatus: "requested",
      reviewFeedback: null,
      capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
      internalDomain: null,
      requestedDomain: "recovered.lvh.me",
      publicDomain: null,
      plan: { key: "starter", name: "Starter", activationMode: "automatic" },
      subscriptionStatus: "active",
      publicationBlockers: ["review_not_approved"],
      application: readyApplication("draft-recovery", 4, "tenant-recovery"),
      createdAt: null,
      activeAt: null,
      publishedAt: null,
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: recovered }), { status: 200 })));

    scrubLegacyPendingSubmission();
    await expect(provisioningApi.recoverCommittedSubmission("owner-recovery")).resolves.toMatchObject({ id: "tenant-recovery" });
    expect(values.has("eoshop.pending-store-submission.v1")).toBe(false);
    expect(values.has("eoshop.pending-store-submission.v2:owner-recovery:draft-recovery")).toBe(false);
    expect(JSON.stringify([...values.values()])).not.toContain("secret");
  });
});
