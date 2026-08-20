// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import AdminDashboard from "./AdminDashboard";
import ControlPanel from "./ControlPanel";
import ResetPasswordGateway from "./ResetPasswordGateway";

const merchant: UserProfile = {
  id: "01MERCHANT",
  fullName: "تاجر تجريبي",
  email: "merchant@example.com",
  phone: "+967700000000",
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
  await user.click(screen.getByRole("button", { name: "فتح مركز المتجر" }));
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
    expect(screen.getByRole("button", { name: "فتح مركز المتجر" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
  });

  it("keeps an authenticated merchant inside the portal when store recovery fails", async () => {
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockRejectedValue(new UiAdapterError("تعذر الاتصال بالخادم.", "server")) },
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
      provisioning: { listStores: vi.fn().mockResolvedValue([]), currentDraft: vi.fn().mockResolvedValue(null) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new");
  });

  it("detaches an existing workspace before a new-store template can be saved", async () => {
    window.history.replaceState({}, "", "/app/new");
    const saveWorkspace = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue({
      id: "draft-new",
      tenantId: null,
      status: "draft",
      revision: 1,
      storeName: "تيك فيو للأجهزة الذكية",
      businessType: "تجزئة",
      themeStyle: "tech",
      handle: null,
      planKey: null,
      config: { ...ELEGANT_PRESET, themeStyle: "tech" },
      savedAt: "2026-08-19T12:00:00Z",
      submittedAt: null,
    });
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        listStores: vi.fn().mockResolvedValue([submission]),
        currentDraft: vi.fn().mockResolvedValue(null),
        saveDraft,
      },
      workspace: {
        load: vi.fn().mockResolvedValue(workspace),
        save: saveWorkspace,
      },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    expect(await screen.findByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: /تفعيل القالب/ })[1]);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    await user.click(await screen.findByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveWorkspace).not.toHaveBeenCalled();
  }, 15_000);

  it("does not open new-store templates when the authoritative draft request fails", async () => {
    window.history.replaceState({}, "", "/app/new");
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: {
        listStores: vi.fn().mockResolvedValue([submission]),
        currentDraft: vi.fn().mockRejectedValue(new UiAdapterError("draft unavailable", "server")),
      },
      workspace: { load: vi.fn().mockResolvedValue(workspace) },
    });

    renderInterface(<App />, adapters);
    await waitFor(() => expect(adapters.provisioning.currentDraft).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeNull();
  });

  it("ignores a delayed draft save after logout resets the account context", async () => {
    window.history.replaceState({}, "", "/app/new");
    let resolveSave!: (draft: StoreDraft) => void;
    const saveDraft = vi.fn(() => new Promise<StoreDraft>((resolve) => { resolveSave = resolve; }));
    const logout = vi.fn().mockResolvedValue(undefined);
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant), logout },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([]), currentDraft: vi.fn().mockResolvedValue(serverDraft), saveDraft },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    await screen.findByRole("button", { name: "حفظ التعديلات" });
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTitle("تسجيل الخروج وإلغاء توثيق النشاط"));
    await user.click(await screen.findByRole("button", { name: "نعم، تسجيل الخروج" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));

    resolveSave({ ...serverDraft, revision: 2, storeName: "سر الحساب أ", config: { ...serverDraft.config, storeName: "سر الحساب أ" } });
    await Promise.resolve();
    expect(screen.queryByText("سر الحساب أ")).toBeNull();
    expect(window.location.pathname).toBe("/");
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
    await user.click(await screen.findByRole("button", { name: "فتح مركز المتجر" }));
    await user.click(await screen.findByRole("button", { name: "التصميم والهوية" }));
    expect((await screen.findAllByText("متجر الخادم")).length).toBeGreaterThan(0);

    resolveSave({ ...correctionDraft, revision: 2, storeName: "مسودة أ المتأخرة", config: { ...correctionDraft.config, storeName: "مسودة أ المتأخرة" } });
    await Promise.resolve();
    expect(screen.queryByDisplayValue("مسودة أ المتأخرة")).toBeNull();
    expect(screen.getAllByText("متجر الخادم").length).toBeGreaterThan(0);
  });

  it("keeps a deferred draft save usable when server logout fails", async () => {
    window.history.replaceState({}, "", "/app/new");
    let resolveSave!: (draft: StoreDraft) => void;
    const saveDraft = vi.fn(() => new Promise<StoreDraft>((resolve) => { resolveSave = resolve; }));
    const logout = vi.fn().mockRejectedValue(new UiAdapterError("offline", "network"));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant), logout },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([]), currentDraft: vi.fn().mockResolvedValue(serverDraft), saveDraft },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    await screen.findByRole("button", { name: "حفظ التعديلات" });
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTitle("تسجيل الخروج وإلغاء توثيق النشاط"));
    await user.click(await screen.findByRole("button", { name: "نعم، تسجيل الخروج" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));

    resolveSave({ ...serverDraft, revision: 2, storeName: "المسودة المحفوظة", config: { ...serverDraft.config, storeName: "المسودة المحفوظة" } });
    expect(await screen.findByDisplayValue("المسودة المحفوظة")).toBeTruthy();
    expect((screen.getByRole("button", { name: "حفظ التعديلات" }) as HTMLButtonElement).disabled).toBe(false);
    expect(window.location.pathname).toBe("/app/new");
  });

  it("does not treat a second new-store click as an authoritative no-draft result", async () => {
    let resolveDraft!: (draft: StoreDraft | null) => void;
    const currentDraft = vi.fn(() => new Promise<StoreDraft | null>((resolve) => { resolveDraft = resolve; }));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([submission]), currentDraft },
      workspace: { load: vi.fn().mockResolvedValue(workspace) },
    });
    const user = userEvent.setup();

    renderInterface(<App />, adapters);
    await screen.findByRole("heading", { name: /مرحبًا تاجر/ });
    const createButton = screen.getByRole("button", { name: /إنشاء متجر جديد/ });
    await user.click(createButton);
    await user.click(createButton);
    expect(currentDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeNull();

    resolveDraft(null);
    expect(await screen.findByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeTruthy();
  });

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

  it("shows reviewer decisions but keeps manager publication actions hidden", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AdminDashboard
        stores={[platformStore]}
        permissions={["platform.stores.view", "platform.stores.review"]}
        loading={false}
        error={null}
        onReload={vi.fn()}
        onUpdateStoreStatus={updateStatus}
        onRetryProvisioning={vi.fn()}
        onActivateSubscription={vi.fn()}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "قبول" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(platformStore.id, "approved", undefined));
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
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));

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
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));
    const loadingButton = screen.getByRole("button", { name: "جاري تفعيل الإبداع..." });
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
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));
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

    await user.click(screen.getByRole("button", { name: /تم الانتهاء من التخصيص/ }));
    expect(setActiveTab).toHaveBeenCalledWith("export");
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
  });

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
    await user.click(screen.getByRole("button", { name: /منتج قابل للأرشفة/ }));
    await user.click(screen.getByRole("button", { name: "أرشفة المنتج عند الحفظ" }));
    await user.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(await screen.findByText(/أُضيفت نية أرشفة المنتج إلى تعديلاتك غير المحفوظة/)).toBeTruthy();

    await user.click(screen.getByTestId("save-workspace"));
    await waitFor(() => expect(save).toHaveBeenNthCalledWith(1, submission.id, 7, 3, expect.any(Object), [persistedId]));
    expect(await screen.findByText("تعذر الحفظ.")).toBeTruthy();

    await user.click(screen.getByTestId("save-workspace"));
    await waitFor(() => expect(save).toHaveBeenNthCalledWith(2, submission.id, 7, 3, expect.any(Object), [persistedId]));
    expect(await screen.findByText(/تم حفظ إعدادات المتجر والمنتجات/)).toBeTruthy();
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
  });

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
