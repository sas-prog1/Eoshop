// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { UiAdaptersProvider } from "../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../adapters/testing/fakeUiAdapters";
import {
  UiAdapterError,
  type PlatformStore,
  type StoreDraft,
  type StoreSubmission,
  type StoreWorkspace,
  type UiAdapters,
  type UserProfile,
} from "../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../types";
import PlatformAdminConsole from "./PlatformAdminConsole";
import ControlPanel from "./ControlPanel";
import ResetPasswordGateway from "./ResetPasswordGateway";

const merchant: UserProfile = {
  id: "01MERCHANT",
  fullName: "تاجر تجريبي",
  email: "merchant@example.com",
  phone: "+967700000000",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const submission: StoreSubmission = {
  id: "01STORE",
  storeName: "متجر الخادم",
  businessType: "تجزئة",
  verificationStatus: "approved",
  provisioningStatus: "active",
  publicationStatus: "requested",
  reviewFeedback: null,
  capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
  internalDomain: "store-01.eoshop.local",
  requestedDomain: "merchant.eoshop.local",
  publicDomain: null,
  plan: { key: "starter", name: "البداية", activationMode: "automatic" },
  subscriptionStatus: "active",
  publicationBlockers: [],
  createdAt: null,
  activeAt: null,
  publishedAt: null,
};

const workspace: StoreWorkspace = {
  tenantId: submission.id,
  revision: 7,
  catalogRevision: 3,
  capabilities: { inventoryView: true, inventoryManage: true },
  config: { ...ELEGANT_PRESET, storeName: "متجر الخادم" },
  updatedAt: null,
};

const serverDraft: StoreDraft = {
  id: "draft-server",
  tenantId: null,
  status: "draft",
  revision: 1,
  onboardingStage: "business",
  onboardingReadiness: { business: true, design: false, review: false, blockers: ["design_incomplete"] },
  nextRequiredStep: "design",
  storeName: "مسودة الحساب أ",
  businessType: "تجزئة",
  themeStyle: "elegant",
  handle: null,
  planKey: null,
  config: { ...ELEGANT_PRESET, storeName: "مسودة الحساب أ" },
  savedAt: "2026-08-19T12:00:00Z",
  submittedAt: null,
};

const platformStore: PlatformStore = {
  id: submission.id,
  storeName: submission.storeName,
  ownerName: merchant.fullName,
  ownerEmail: merchant.email,
  ownerPhone: merchant.phone,
  businessType: submission.businessType,
  verificationStatus: "pending",
  provisioningStatus: "active",
  publicationStatus: "requested",
  rejectionReason: null,
  themeStyle: "elegant",
  domains: ["store-01.eoshop.local"],
  requestedDomain: "merchant.eoshop.local",
  publicDomain: null,
  publicationBlockers: [],
  subscription: {
    id: "01SUBSCRIPTION",
    status: "active",
    endsAt: null,
    plan: { key: "starter", name: "البداية", activationMode: "automatic" },
  },
  createdAt: null,
  activeAt: null,
  latestProvisioningRun: null,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

function renderInterface(node: React.ReactElement, adapters: UiAdapters) {
  return render(<UiAdaptersProvider adapters={adapters}>{node}</UiAdaptersProvider>);
}

function appAdapters(save: UiAdapters["workspace"]["save"]): UiAdapters {
  return createFakeUiAdapters({
    auth: { session: vi.fn().mockResolvedValue(merchant) },
    plans: { list: vi.fn().mockResolvedValue([]) },
    provisioning: { listStores: vi.fn().mockResolvedValue([submission]) },
    workspace: {
      load: vi.fn().mockResolvedValue(workspace),
      save,
    },
    catalog: {
      load: vi.fn().mockResolvedValue({
        tenantId: submission.id,
        revision: workspace.catalogRevision,
        currencyCode: workspace.config.currency,
        products: workspace.config.products,
      }),
    },
  });
}

async function openRestoredBuilder(
  adapters: UiAdapters,
  user: ReturnType<typeof userEvent.setup>,
  section: "design" | "products" = "design",
) {
  renderInterface(<App />, adapters);
  expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "إدارة وتعديل المتجر" }));
  if (section === "products") {
    await user.click((await screen.findAllByRole("button", { name: "المنتجات" }))[0]);
    await user.click(await screen.findByRole("button", { name: "إضافة وتعديل المنتجات" }));
  } else {
    await user.click(await screen.findByRole("button", { name: "التصميم والهوية" }));
  }
  expect(await screen.findByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
}

describe("adapter-backed interface flows", () => {
  it("routes an authenticated merchant to the durable portal and keeps pending stores visible", async () => {
    const pendingStore: StoreSubmission = {
      ...submission,
      verificationStatus: "pending",
      provisioningStatus: "not_started",
      publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
    };
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([pendingStore]) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    expect(window.location.pathname).toBe("/app");
    expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "إدارة وتعديل المتجر" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
  }, 15_000);

  it.each([
    ["التصميم والهوية", "design"],
    ["صفحات المتجر", "pages"],
  ])("opens the %s shortcut directly in the existing builder", async (label, section) => {
    const user = userEvent.setup();
    const adapters = appAdapters(vi.fn().mockResolvedValue(workspace));

    renderInterface(<App />, adapters);
    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: label }));

    expect(await screen.findByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/${section}`);
  }, 15_000);

  it("presents the store setup shell with concise actions and persistent section navigation", async () => {
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(vi.fn()), user);

    expect(screen.getByRole("heading", { name: /تهيئة متجري/ })).toBeTruthy();
    expect(screen.getByText("مساحة إعداد المتجر")).toBeTruthy();
    expect(screen.getByRole("button", { name: "معلومات المتجر" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("products-tab")).toBeTruthy();
    expect(screen.getByRole("button", { name: "الدفع والتوصيل" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "توسيع المعاينة" })).toBeTruthy();
    const expandedPreview = screen.getByRole("button", { name: "معاينة مكبّرة" });
    expect(expandedPreview).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ والعودة" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /وضع العميل/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "شاشة كاملة" })).toBeNull();

    const sectionNavigation = screen.getByRole("navigation", { name: "أقسام تهيئة المتجر" });
    await user.click(within(sectionNavigation).getByRole("button", { name: "الدفع والتوصيل" }));
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/checkout`);
    await user.click(within(sectionNavigation).getByRole("button", { name: "الصفحات" }));
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/pages`);

    await user.click(expandedPreview);
    expect(screen.getByRole("dialog", { name: /معاينة متجر/ })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /معاينة متجر/ })).toBeNull());
    expect(document.activeElement).toBe(expandedPreview);
  }, 15_000);

  it("shows submitted stores without waiting for a hanging draft recovery request", async () => {
    const pendingStore: StoreSubmission = {
      ...submission,
      verificationStatus: "pending",
      provisioningStatus: "not_started",
      publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
    };
    const currentDraft = vi.fn(() => new Promise<StoreDraft | null>(() => undefined));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      provisioning: { listStores: vi.fn().mockResolvedValue([pendingStore]), currentDraft },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "إدارة وتعديل المتجر" })).toBeTruthy();
    expect(screen.getByText(/جاري التحقق من وجود مسودة محفوظة/)).toBeTruthy();
    expect(currentDraft).toHaveBeenCalledOnce();
  });

  it("restores an unfinished server draft into the merchant portal without fabricating a submitted store", async () => {
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      provisioning: {
        listStores: vi.fn().mockResolvedValue([]),
        currentDraft: vi.fn().mockResolvedValue(serverDraft),
      },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: "مسودة الحساب أ" })).toBeTruthy();
    expect(screen.getByText("مسودة محفوظة — لم تُرسل للمراجعة")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "ابدأ متجرك الأول" })).toBeNull();
    expect(screen.queryByText("قيد المراجعة")).toBeNull();
  });

  it("keeps an authenticated merchant inside the portal when store recovery fails", async () => {
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        listStores: vi.fn().mockRejectedValue(new UiAdapterError("تعذر الاتصال بالخادم.", "server")),
        currentDraft: vi.fn().mockResolvedValue(null),
      },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("تعذر الاتصال بالخادم");
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app");
  });

  it("restores the owned new-store route for an authenticated merchant", async () => {
    window.history.replaceState({}, "", "/app/new");
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), listStores: vi.fn().mockResolvedValue([]), currentDraft: vi.fn().mockResolvedValue(null) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new");
  });

  it("preserves ambiguous submission recovery across passive expiry and clears it after same-owner recovery", async () => {
    const pendingKey = `eoshop.pending-store-submission.v2:${merchant.id}:${serverDraft.id}`;
    localStorage.setItem(pendingKey, JSON.stringify({
      version: 2,
      ownerId: merchant.id,
      draftId: serverDraft.id,
      digest: "pending-digest",
      idempotencyKey: "pending-idempotency-key",
    }));
    window.history.replaceState({}, "", "/app/new");
    const clearPendingForOwner = vi.fn();
    const recoverCommittedSubmission = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("انتهت الجلسة.", "unauthenticated"))
      .mockImplementationOnce(async () => {
        localStorage.removeItem(pendingKey);
        return submission;
      });
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      provisioning: {
        clearPendingForOwner,
        recoverCommittedSubmission,
        listStores: vi.fn().mockResolvedValue([]),
      },
    });

    const first = renderInterface(<App />, adapters);
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/app/new");
    expect(localStorage.getItem(pendingKey)).not.toBeNull();
    expect(clearPendingForOwner).not.toHaveBeenCalled();

    first.unmount();
    window.history.replaceState({}, "", "/app/new");
    renderInterface(<App />, adapters);

    await waitFor(() => expect(recoverCommittedSubmission).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem(pendingKey)).toBeNull();
    expect(clearPendingForOwner).not.toHaveBeenCalled();
  });

  it("persists a new-store business step without writing an existing workspace", async () => {
    window.history.replaceState({}, "", "/app/new");
    const saveWorkspace = vi.fn();
    const saveBusiness = vi.fn().mockResolvedValue({ ...serverDraft, id: "draft-new", storeName: "تيك فيو للأجهزة الذكية" });
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        recoverCommittedSubmission: vi.fn().mockResolvedValue(null),
        currentDraft: vi.fn().mockResolvedValue(null),
        saveBusiness,
      },
      workspace: {
        load: vi.fn().mockResolvedValue(workspace),
        save: saveWorkspace,
      },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    await user.type(screen.getByLabelText("اسم المتجر أو النشاط"), "تيك فيو للأجهزة الذكية");
    await user.click(screen.getByRole("button", { name: "حفظ واختيار القالب" }));

    await waitFor(() => expect(saveBusiness).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 0,
      storeName: "تيك فيو للأجهزة الذكية",
    }), expect.any(AbortSignal)));
    expect(saveWorkspace).not.toHaveBeenCalled();
  }, 15_000);

  it("does not open new-store templates when the authoritative draft request fails", async () => {
    window.history.replaceState({}, "", "/app/new");
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        recoverCommittedSubmission: vi.fn().mockResolvedValue(null),
        listStores: vi.fn().mockResolvedValue([submission]),
        currentDraft: vi.fn().mockRejectedValue(new UiAdapterError("draft unavailable", "server")),
      },
      workspace: { load: vi.fn().mockResolvedValue(workspace) },
    });

    renderInterface(<App />, adapters);
    await waitFor(() => expect(adapters.provisioning.currentDraft).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeNull();
  });

  it("ignores a delayed draft save after switching to an existing store workspace", async () => {
    const correctionStore: StoreSubmission = {
      ...submission,
      id: "01CORRECTION",
      storeName: "متجر التصحيح أ",
      verificationStatus: "rejected",
      provisioningStatus: "not_started",
      capabilities: { ...submission.capabilities, workspaceManage: false, draftEdit: true, resubmit: true },
    };
    const correctionDraft: StoreDraft = {
      ...serverDraft,
      id: "draft-correction-a",
      tenantId: correctionStore.id,
      status: "correction_required",
    };
    window.history.replaceState({}, "", `/app/stores/${correctionStore.id}/correction`);
    let resolveSave!: (draft: StoreDraft) => void;
    const saveCorrection = vi.fn(() => new Promise<StoreDraft>((resolve) => { resolveSave = resolve; }));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        listStores: vi.fn().mockResolvedValue([submission, correctionStore]),
        correctionDraft: vi.fn().mockResolvedValue(correctionDraft),
        saveCorrection,
      },
      workspace: { load: vi.fn().mockResolvedValue(workspace) },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    await screen.findByRole("button", { name: "حفظ التعديلات" });
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(saveCorrection).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTitle("الرجوع إلى بوابة التاجر"));
    await user.click(await screen.findByRole("button", { name: "إدارة وتعديل المتجر" }));
    await user.click(await screen.findByRole("button", { name: "التصميم والهوية" }));
    expect((await screen.findAllByText("متجر الخادم")).length).toBeGreaterThan(0);

    resolveSave({ ...correctionDraft, revision: 2, storeName: "مسودة أ المتأخرة", config: { ...correctionDraft.config, storeName: "مسودة أ المتأخرة" } });
    await Promise.resolve();
    expect(screen.queryByDisplayValue("مسودة أ المتأخرة")).toBeNull();
    expect(screen.getAllByText("متجر الخادم").length).toBeGreaterThan(0);
  }, 15_000);

  it("restores an exact ready store design route without passing through templates", async () => {
    window.history.replaceState({}, "", `/app/stores/${submission.id}/design`);
    const adapters = appAdapters(vi.fn());

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/design`);
    expect(adapters.workspace.load).toHaveBeenCalledWith(submission.id, expect.any(AbortSignal));
  });

  it("keeps a direct products route read-only when the exact membership lacks combined edit permission", async () => {
    const catalogOnly = {
      ...submission,
      capabilities: { ...submission.capabilities, workspaceManage: false, catalogManage: true },
    };
    window.history.replaceState({}, "", `/app/stores/${submission.id}/products`);
    const workspaceLoad = vi.fn();
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      provisioning: { listStores: vi.fn().mockResolvedValue([catalogOnly]) },
      workspace: { load: workspaceLoad },
      catalog: { load: vi.fn().mockResolvedValue({ tenantId: submission.id, revision: 1, currencyCode: "YER", products: [] }) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("button", { name: "العودة إلى متاجري" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "المنتجات" })).toBeTruthy();
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/products`);
    expect(workspaceLoad).not.toHaveBeenCalled();
  });

  it("guards dirty builder state when browser history targets the operations center", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(vi.fn()), user);
    fireEvent.change(screen.getByLabelText("اسم المتجر"), { target: { value: "تعديل عبر السجل" } });

    window.history.pushState({}, "", `/app/stores/${submission.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/design`);
    expect(screen.getByDisplayValue("تعديل عبر السجل")).toBeTruthy();

    window.history.pushState({}, "", `/app/stores/${submission.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("button", { name: "العودة إلى متاجري" })).toBeTruthy();
    expect(confirm).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("clears the merchant context when a route-owned operation reports an expired session", async () => {
    window.history.replaceState({}, "", `/app/stores/${submission.id}/orders`);
    const adapters = appAdapters(vi.fn());
    adapters.orders.list = vi.fn().mockRejectedValue(new UiAdapterError("انتهت الجلسة.", "unauthenticated"));

    renderInterface(<App />, adapters);

    await waitFor(() => expect(adapters.orders.list).toHaveBeenCalled());
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: /أنشئ متجرك الإلكتروني/ })).toBeTruthy();
  });

  it("requires an explicit decision before leaving a dirty workspace for the merchant portal", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(vi.fn()), user);
    fireEvent.change(screen.getByLabelText("اسم المتجر"), { target: { value: "اسم غير محفوظ" } });

    await user.click(screen.getByTitle("الرجوع إلى بوابة التاجر"));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();

    await user.click(screen.getByTitle("الرجوع إلى بوابة التاجر"));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
  }, 15_000);

  it("resets a password through the injected auth action", async () => {
    window.history.replaceState({}, "", "/reset-password?token=reset-token&email=merchant%40example.com");
    const resetPassword = vi.fn().mockResolvedValue("تم تحديث كلمة المرور.");
    const user = userEvent.setup();
    renderInterface(
      <ResetPasswordGateway />,
      createFakeUiAdapters({ auth: { resetPassword } }),
    );

    await user.type(screen.getByPlaceholderText("كلمة المرور الجديدة"), "new-secure-password");
    await user.type(screen.getByPlaceholderText("تأكيد كلمة المرور"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "تحديث كلمة المرور" }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1));
    expect(resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      email: merchant.email,
      password: "new-secure-password",
      passwordConfirmation: "new-secure-password",
    });
    expect(await screen.findByText("تم تحديث كلمة المرور.")).toBeTruthy();
  });

  it("routes reviewers into the request dossier while keeping manager publication actions hidden", async () => {
    const reviewer = {
      ...merchant,
      role: "admin" as const,
      platformRoles: ["platform_reviewer"],
      platformPermissions: ["platform.stores.view", "platform.stores.review"],
    };
    const page = { items: [platformStore], pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: 1 } };
    const overview = {
      generatedAt: "2026-08-21T12:00:00Z",
      stores: {
        total: 1,
        verification: { pending: 1, changes_requested: 0, approved: 0, rejected: 0, suspended: 0 },
        provisioning: { notStarted: 0, queued: 0, provisioning: 0, retrying: 0, active: 1, failed: 0 },
        publication: { requested: 1, published: 0, unpublished: 0, rejected: 0 },
      },
      attention: { review: 1, provisioning: 0, subscription: 0, publication: 1 },
    };
    const onOpenStore = vi.fn();
    const user = userEvent.setup();
    renderInterface(
      <PlatformAdminConsole
        user={reviewer}
        section="stores"
        onNavigate={vi.fn()}
        onOpenStore={onOpenStore}
        onExit={vi.fn()}
        onLogout={vi.fn().mockResolvedValue(undefined)}
        onSessionExpired={vi.fn()}
        onToast={vi.fn()}
      />,
      createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores: vi.fn().mockResolvedValue(page),
      } }),
    );

    await screen.findByText(platformStore.storeName);
    expect(screen.queryByRole("button", { name: /نشر/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "قبول" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "فتح ملف الطلب" }));
    expect(onOpenStore).toHaveBeenCalledWith(platformStore.id);
  });

  it("calls the assistant once and renders its server-backed proposal", async () => {
    const generateStoreIdeas = vi.fn().mockResolvedValue({
      storeName: "متجر ذكي",
      slogan: "شعار من الخادم",
      logoIcon: null,
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      themeStyle: "elegant",
      bannerText: "عرض من الخادم",
      products: [{
        name: "منتج",
        price: 100,
        description: "وصف من الخادم",
        category: "عام",
        imageKeyword: "default",
      }],
    });
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة الحملة");
    await user.click(screen.getByRole("button", { name: "إنشاء مقترحات" }));

    await waitFor(() => expect(generateStoreIdeas).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/شعار من الخادم/)).toBeTruthy();
    expect(screen.getByText(/عرض من الخادم/)).toBeTruthy();
  });

  it("guards a deferred assistant request against a second submit", async () => {
    let resolveIdeas!: (value: Awaited<ReturnType<UiAdapters["assistant"]["generateStoreIdeas"]>>) => void;
    const generateStoreIdeas = vi.fn(() => new Promise<Awaited<ReturnType<UiAdapters["assistant"]["generateStoreIdeas"]>>>((resolve) => {
      resolveIdeas = resolve;
    }));
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة مؤجلة");
    await user.click(screen.getByRole("button", { name: "إنشاء مقترحات" }));
    const loadingButton = screen.getByRole("button", { name: "جارٍ إنشاء المقترحات…" });
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(loadingButton);
    expect(generateStoreIdeas).toHaveBeenCalledTimes(1);

    resolveIdeas({
      storeName: "متجر",
      slogan: "شعار مؤجل",
      logoIcon: null,
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      themeStyle: "elegant",
      bannerText: "عرض",
      products: [],
    });
    expect(await screen.findByText(/شعار مؤجل/)).toBeTruthy();
  });

  it("preserves the assistant fallback when generation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas: vi.fn().mockRejectedValue(new Error("offline")) } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة");
    await user.click(screen.getByRole("button", { name: "إنشاء مقترحات" }));
    expect(await screen.findByText(/التميز يبدأ من الاختيار الصحيح لهويتك/)).toBeTruthy();
  });

  it("keeps completion fallback in the coordinator when no domain callback is supplied", async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="branding"
        setActiveTab={setActiveTab}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters(),
    );

    await user.click(screen.getByRole("button", { name: "متابعة إلى العنوان" }));
    expect(setActiveTab).toHaveBeenCalledWith("export");
  });

  it("keeps an existing workspace completion separate from the new-store domain journey", async () => {
    const onCompleteCustomization = vi.fn().mockResolvedValue(undefined);
    const onOpenDomainModal = vi.fn();
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId="tenant-existing"
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="branding"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
        onCompleteCustomization={onCompleteCustomization}
        onOpenDomainModal={onOpenDomainModal}
      />,
      createFakeUiAdapters(),
    );

    await user.click(screen.getByRole("button", { name: "حفظ والعودة" }));
    expect(onCompleteCustomization).toHaveBeenCalledOnce();
    expect(onOpenDomainModal).not.toHaveBeenCalled();
  });

  it("aborts an in-flight catalog upload when the active tenant changes", async () => {
    let resolveUpload!: (value: { id: string; url: string; mimeType: string; byteSize: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadMedia = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;

      return new Promise<{ id: string; url: string; mimeType: string; byteSize: number }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const handleProductChange = vi.fn();
    const handleProductMediaChange = vi.fn();
    const adapters = createFakeUiAdapters({ catalog: { uploadMedia } });
    const catalogConfig = {
      ...ELEGANT_PRESET,
      products: [{
        ...ELEGANT_PRESET.products[0],
        imageKeyword: "custom",
        imageUrl: "https://images.example.test/current.jpg",
        imageUrls: ["https://images.example.test/current.jpg"],
      }],
    };
    const panel = (tenantId: string) => (
      <UiAdaptersProvider adapters={adapters}>
        <ControlPanel
          config={catalogConfig}
          activeTenantId={tenantId}
          handleConfigChange={vi.fn()}
          handleProductChange={handleProductChange}
          handleProductMediaChange={handleProductMediaChange}
          addEmptyProduct={vi.fn()}
          deleteProduct={vi.fn()}
          activeTab="products"
          setActiveTab={vi.fn()}
          previewDevice="desktop"
          setPreviewDevice={vi.fn()}
        />
      </UiAdaptersProvider>
    );
    const view = render(panel("tenant-a"));
    const productCard = screen.getByText(catalogConfig.products[0].name).closest("article");
    const editButton = productCard?.querySelector("button");
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton as HTMLButtonElement);
    const input = view.container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));

    view.rerender(panel("tenant-b"));
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      url: "/api/catalog-media/tenant-a/7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      mimeType: "image/png",
      byteSize: 5,
    });
    await Promise.resolve();
    expect(handleProductChange).not.toHaveBeenCalled();
    expect(handleProductMediaChange).not.toHaveBeenCalled();
  });

  it("rejects a deferred catalog upload when the product collection changes", async () => {
    let resolveUpload!: (value: { id: string; url: string; mimeType: string; byteSize: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadMedia = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;

      return new Promise<{ id: string; url: string; mimeType: string; byteSize: number }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const handleProductMediaChange = vi.fn();
    const adapters = createFakeUiAdapters({ catalog: { uploadMedia } });
    const catalogConfig = {
      ...ELEGANT_PRESET,
      products: [{
        ...ELEGANT_PRESET.products[0],
        imageKeyword: "custom",
        imageUrl: "https://images.example.test/current.jpg",
        imageUrls: ["https://images.example.test/current.jpg"],
      }],
    };
    const panel = (config: typeof catalogConfig) => (
      <UiAdaptersProvider adapters={adapters}>
        <ControlPanel
          config={config}
          activeTenantId="tenant-a"
          handleConfigChange={vi.fn()}
          handleProductChange={vi.fn()}
          handleProductMediaChange={handleProductMediaChange}
          addEmptyProduct={vi.fn()}
          deleteProduct={vi.fn()}
          activeTab="products"
          setActiveTab={vi.fn()}
          previewDevice="desktop"
          setPreviewDevice={vi.fn()}
        />
      </UiAdaptersProvider>
    );
    const view = render(panel(catalogConfig));
    const productCard = screen.getByText(catalogConfig.products[0].name).closest("article");
    fireEvent.click(productCard?.querySelector("button") as HTMLButtonElement);
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));

    view.rerender(panel({
      ...catalogConfig,
      products: [{ ...catalogConfig.products[0], id: "new-draft", name: "New draft" }, ...catalogConfig.products],
    }));
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      url: "/api/catalog-media/tenant-a/7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      mimeType: "image/png",
      byteSize: 5,
    });
    await Promise.resolve();
    expect(handleProductMediaChange).not.toHaveBeenCalled();
  });

  it("keeps base and sale price edits together in the saved workspace", async () => {
    const save = vi.fn(async (_tenantId, _revision, _catalogRevision, config) => ({
      ...workspace,
      revision: 8,
      catalogRevision: 4,
      config,
    }));
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(save), user, "products");
    const product = workspace.config.products[0];
    const productCard = screen.getAllByText(product.name)[0].closest("article");
    fireEvent.click(productCard?.querySelector("button") as HTMLButtonElement);

    fireEvent.change(screen.getByTestId(`product-base-price-${product.id}`), { target: { value: "200" } });
    fireEvent.change(screen.getByTestId(`product-sale-price-${product.id}`), { target: { value: "150" } });
    await user.click(screen.getByTestId("save-workspace"));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const savedConfig = save.mock.calls[0][3];
    expect(savedConfig.products[0]).toMatchObject({ basePrice: 200, salePrice: 150, price: 150 });
  });

  it("creates collision-safe draft products and keeps them controlled until workspace save", async () => {
    const save = vi.fn(async (_tenantId, _revision, _catalogRevision, config) => ({
      ...workspace,
      revision: 8,
      catalogRevision: 4,
      config,
    }));
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(save), user, "products");
    await user.click(screen.getByRole("button", { name: "إضافة منتج" }));
    await user.click(screen.getByRole("button", { name: "إضافة منتج" }));
    await user.click(screen.getByTestId("save-workspace"));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const products = save.mock.calls[0][3].products as Array<{ id: string }>;
    expect(products[0].id).toMatch(/^draft:[0-9a-f-]{36}$/i);
    expect(products[1].id).toMatch(/^draft:[0-9a-f-]{36}$/i);
    expect(products[0].id).not.toBe(products[1].id);
  }, 15_000);

  it("retains a persisted archive intent after a failed save and clears it only on success", async () => {
    const persistedId = "77777777-7777-4777-8777-777777777777";
    const persistedWorkspace: StoreWorkspace = {
      ...workspace,
      config: {
        ...workspace.config,
        products: [{ ...workspace.config.products[0], id: persistedId, name: "منتج قابل للأرشفة" }],
      },
    };
    const save = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("تعذر الحفظ.", "server"))
      .mockImplementationOnce(async (_tenantId, _revision, _catalogRevision, config) => ({
        ...persistedWorkspace,
        revision: 8,
        catalogRevision: 4,
        config,
      }));
    const adapters = appAdapters(save);
    adapters.workspace.load = vi.fn().mockResolvedValue(persistedWorkspace);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user, "products");
    await user.click(screen.getByText("منتج قابل للأرشفة", { selector: "h3" }).closest("button")!);
    await user.click(screen.getByRole("button", { name: "أرشفة المنتج عند الحفظ" }));
    await user.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(await screen.findByText(/أُضيفت نية أرشفة المنتج إلى تعديلاتك غير المحفوظة/)).toBeTruthy();

    await user.click(screen.getByTestId("save-workspace"));
    await waitFor(() => expect(save).toHaveBeenNthCalledWith(1, submission.id, 7, 3, expect.any(Object), [persistedId]));
    expect(await screen.findByText("تعذر الحفظ.")).toBeTruthy();

    await user.click(screen.getByTestId("save-workspace"));
    await waitFor(() => expect(save).toHaveBeenNthCalledWith(2, submission.id, 7, 3, expect.any(Object), [persistedId]));
    expect(await screen.findByText("تم حفظ تغييرات المتجر.")).toBeTruthy();
  }, 15_000);

  it("removes duplicate operational tabs and guards the dirty inventory handoff", async () => {
    const confirm = vi.spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(vi.fn()), user, "products");
    expect(screen.queryByTestId("inventory-tab")).toBeNull();
    expect(screen.queryByRole("button", { name: "الطلبات" })).toBeNull();

    const product = workspace.config.products[0];
    await user.click(screen.getAllByRole("button", { name: new RegExp(product.name) })[0]);
    fireEvent.change(screen.getByLabelText("اسم المنتج"), { target: { value: "تعديل غير محفوظ" } });
    await user.click(screen.getByRole("button", { name: /فتح المخزون/ }));
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/products`);

    await user.click(screen.getByRole("button", { name: /فتح المخزون/ }));
    await waitFor(() => expect(window.location.pathname).toBe(`/app/stores/${submission.id}/inventory`));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("سيتجاهل تعديلات المحرر غير المحفوظة"));
  }, 15_000);

  it("restores the workspace, saves the current revision and opens only revision-code recovery", async () => {
    const save = vi.fn()
      .mockImplementationOnce(async (_tenantId, _revision, _catalogRevision, config) => ({
        ...workspace,
        revision: 8,
        catalogRevision: 4,
        config,
      }))
      .mockRejectedValueOnce(new UiAdapterError("نسخة أحدث موجودة.", "conflict", "workspace_revision_conflict"));
    const adapters = appAdapters(save);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);

    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(submission.id, 7, 3, expect.any(Object), []));
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(submission.id, 8, 4, expect.any(Object), []));
    expect(await screen.findByText("تعارضت تعديلاتك مع نسخة أحدث")).toBeTruthy();
    expect(localStorage.getItem("mobtaker_custom_store")).toBeNull();
  });

  it("fails closed and clears tenant-owned state when a save reports an expired session", async () => {
    const save = vi.fn().mockRejectedValue(new UiAdapterError("انتهت الجلسة.", "unauthenticated"));
    const adapters = appAdapters(save);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);

    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("انتهت الجلسة.")).toBeTruthy();
    expect(localStorage.getItem("mobtaker_custom_store")).toBeNull();
  });
});
