// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAuthModal from "./AdminAuthModal";
import AuthGateway from "./AuthGateway";
import DomainSetupModal from "./DomainSetupModal";
import ServerPricingPlans from "./ServerPricingPlans";
import { UiAdaptersProvider } from "../adapters/UiAdaptersContext";
import { UiAdapterError, type StorePlan, type UiAdapters, type UserProfile } from "../adapters/uiAdapters";
import { createFakeUiAdapters } from "../adapters/testing/fakeUiAdapters";

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

const starterPlan: StorePlan = {
  key: "starter",
  name: "البداية",
  priceMinor: 0,
  currency: "YER",
  billingInterval: "monthly",
  activationMode: "automatic",
  maxStores: 1,
  maxProducts: 10,
  features: ["platform_subdomain"],
};

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
  cleanup();
  vi.restoreAllMocks();
});

function renderInterface(node: React.ReactElement, adapters: UiAdapters) {
  return render(<UiAdaptersProvider adapters={adapters}>{node}</UiAdaptersProvider>);
}

describe("current interface behavior", () => {
  it("logs a merchant in once and returns the existing UI profile", async () => {
    const login = vi.fn().mockResolvedValue(merchant);
    const onLoginSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <AuthGateway
        isOpen
        initialMode="login"
        currentUser={null}
        onClose={onClose}
        onLoginSuccess={onLoginSuccess}
        onLogout={vi.fn()}
        onStartStoreCreation={vi.fn()}
      />,
      createFakeUiAdapters({ auth: { login } }),
    );

    await user.type(screen.getByPlaceholderText("name@company.com"), merchant.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "very-secure-password");
    await user.click(screen.getByRole("button", { name: /تسجيل الدخول للحساب/ }));

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith(merchant.email, "very-secure-password");
    expect(onLoginSuccess).toHaveBeenCalledWith(expect.objectContaining({
      id: merchant.id,
      email: merchant.email,
      role: "merchant",
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ends an unauthorized platform session instead of opening administration", async () => {
    const login = vi.fn().mockResolvedValue({
      ...merchant,
      platformRoles: ["platform_reviewer"],
      platformPermissions: [],
    });
    const logout = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <AdminAuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />,
      createFakeUiAdapters({ auth: { login, logout } }),
    );

    await user.type(screen.getByPlaceholderText("name@example.com"), merchant.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "very-secure-password");
    await user.click(screen.getByRole("button", { name: /تسجيل دخول المسؤول/ }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/لا يملك صلاحية الدخول/)).toBeTruthy();
  });

  it("loads server plans, checks the handle and submits the current store once", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    const availability = vi.fn().mockResolvedValue({
      handle: "my-shop",
      domain: "my-shop.eoshop.local",
      available: true,
    });
    const submit = vi.fn().mockResolvedValue({
      data: {
        id: "01STORE",
        storeName: "متجري",
        businessType: "تجزئة",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: null,
        requestedDomain: "my-shop.eoshop.local",
        plan: { key: "starter", name: "البداية", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: [],
        createdAt: null,
      },
      meta: { replayed: false },
    });
    const saveDraft = vi.fn().mockResolvedValue({
      id: "draft-1",
      tenantId: null,
      status: "draft",
      revision: 1,
      storeName: "متجري",
      businessType: "تجزئة",
      themeStyle: "elegant",
      handle: "my-shop",
      planKey: "starter",
      config: { storeName: "متجري" },
      application: readyApplication("draft-1", 1),
      savedAt: "2026-08-19T12:00:00Z",
      submittedAt: null,
    });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <DomainSetupModal
        ownerId="01MERCHANT"
        isOpen
        onClose={vi.fn()}
        storeName="متجري"
        businessType="تجزئة"
        themeStyle="elegant"
        config={{ storeName: "متجري" }}
        onSubmitted={onSubmitted}
      />,
      createFakeUiAdapters({
        plans: { list: listPlans, domainAvailability: availability },
        provisioning: { submit, saveDraft },
      }),
    );

    expect(await screen.findByText("البداية")).toBeTruthy();
    await user.type(screen.getByLabelText("عنوان المتجر داخل المنصة"), "my-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledWith("my-shop", expect.any(AbortSignal)), { timeout: 1500 });
    expect(await screen.findByText(/my-shop\.eoshop\.local متاح/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "حفظ العنوان والباقة والانتقال للوثائق" }));
    await user.click(await screen.findByRole("button", { name: "إرسال ملف الطلب للمراجعة" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 0,
      storeName: "متجري",
      handle: "my-shop",
      planKey: "starter",
    }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      storeName: "متجري",
      handle: "my-shop",
      planKey: "starter",
      draftId: "draft-1",
      expectedDraftRevision: 1,
    }), "01MERCHANT");
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("replays an ambiguous first submission without saving the linked draft again", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    const availability = vi.fn().mockResolvedValue({ handle: "replay-shop", domain: "replay-shop.eoshop.local", available: true });
    const savedDraft = {
      id: "draft-replay", tenantId: null, status: "draft" as const, revision: 1,
      storeName: "متجر الاستعادة", businessType: "تجزئة", themeStyle: "elegant" as const,
      handle: "replay-shop", planKey: "starter", config: { storeName: "متجر الاستعادة" },
      application: readyApplication("draft-replay", 1),
      savedAt: "2026-08-19T12:00:00Z", submittedAt: null,
    };
    const submission = {
      id: "01REPLAY", storeName: savedDraft.storeName, businessType: savedDraft.businessType,
      verificationStatus: "pending" as const, provisioningStatus: "not_started" as const,
      publicationStatus: "requested" as const, reviewFeedback: null,
      capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false },
      internalDomain: null, requestedDomain: "replay-shop.eoshop.local", publicDomain: null,
      plan: { key: "starter", name: "البداية", activationMode: "automatic" as const },
      subscriptionStatus: "active" as const, publicationBlockers: ["review_not_approved"],
      createdAt: null, activeAt: null, publishedAt: null,
    };
    const saveDraft = vi.fn().mockResolvedValue(savedDraft);
    const submit = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("نتيجة الإرسال السابق غير مؤكدة", "network"))
      .mockResolvedValueOnce({ data: submission, meta: { replayed: true } });
    const user = userEvent.setup();

    const Harness = () => {
      const [draft, setDraft] = React.useState<Awaited<ReturnType<UiAdapters["provisioning"]["saveDraft"]>> | null>(null);
      return <DomainSetupModal ownerId="01MERCHANT" isOpen onClose={vi.fn()} draft={draft} onDraftChanged={setDraft} storeName={savedDraft.storeName} businessType={savedDraft.businessType} themeStyle="elegant" config={savedDraft.config} />;
    };
    renderInterface(
      <Harness />,
      createFakeUiAdapters({ plans: { list: listPlans, domainAvailability: availability }, provisioning: { saveDraft, submit } }),
    );

    await screen.findByText("البداية");
    await user.type(screen.getByLabelText("عنوان المتجر داخل المنصة"), "replay-shop");
    await screen.findByText(/replay-shop\.eoshop\.local متاح/, {}, { timeout: 1500 });
    await user.click(screen.getByRole("button", { name: "حفظ العنوان والباقة والانتقال للوثائق" }));
    await user.click(await screen.findByRole("button", { name: "إرسال ملف الطلب للمراجعة" }));
    expect(await screen.findByText(/نتيجة الإرسال السابق غير مؤكدة/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "إرسال ملف الطلب للمراجعة" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenNthCalledWith(2, submit.mock.calls[0][0], "01MERCHANT");
  });

  it("offers an explicit server reload after a draft revision conflict", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    const availability = vi.fn().mockResolvedValue({ handle: "conflict-shop", domain: "conflict-shop.eoshop.local", available: true });
    const reloadDraft = vi.fn().mockResolvedValue(undefined);
    const saveDraft = vi.fn().mockRejectedValue(new UiAdapterError("stale", "conflict", "draft_revision_conflict"));
    const user = userEvent.setup();

    renderInterface(
      <DomainSetupModal ownerId="01MERCHANT" isOpen onClose={vi.fn()} onReloadDraft={reloadDraft} storeName="متجر متعارض" businessType="تجزئة" themeStyle="elegant" config={{ storeName: "متجر متعارض" }} />,
      createFakeUiAdapters({ plans: { list: listPlans, domainAvailability: availability }, provisioning: { saveDraft } }),
    );

    await screen.findByText("البداية");
    await user.type(screen.getByLabelText("عنوان المتجر داخل المنصة"), "conflict-shop");
    await screen.findByText(/conflict-shop\.eoshop\.local متاح/, {}, { timeout: 1500 });
    await user.click(screen.getByRole("button", { name: "حفظ العنوان والباقة والانتقال للوثائق" }));
    await user.click(await screen.findByRole("button", { name: "تحميل نسخة الخادم" }));
    expect(reloadDraft).toHaveBeenCalledTimes(1);
  });

  it("replays an ambiguous resubmission without saving the correction twice", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    const availability = vi.fn().mockResolvedValue({ handle: "corrected-shop", domain: "corrected-shop.eoshop.local", available: true });
    const correction = {
      id: "draft-correction", tenantId: "tenant-correction", status: "correction_required" as const, revision: 4,
      storeName: "متجر مصحح", businessType: "تجزئة", themeStyle: "elegant" as const,
      handle: "corrected-shop", planKey: "starter", config: { storeName: "متجر مصحح" },
      application: readyApplication("draft-correction", 4, "tenant-correction"),
      savedAt: "2026-08-19T12:00:00Z", submittedAt: "2026-08-18T12:00:00Z",
    };
    const saveCorrection = vi.fn().mockResolvedValue(correction);
    const resubmit = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("نتيجة الإرسال السابق غير مؤكدة", "network"))
      .mockResolvedValueOnce({ data: {
        id: "tenant-correction", storeName: correction.storeName, businessType: correction.businessType,
        verificationStatus: "pending", provisioningStatus: "not_started", publicationStatus: "requested", reviewFeedback: null,
        capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: null, requestedDomain: "corrected-shop.eoshop.local", publicDomain: null,
        plan: { key: "starter", name: "البداية", activationMode: "automatic" }, subscriptionStatus: "active",
        publicationBlockers: ["review_not_approved"], createdAt: null, activeAt: null, publishedAt: null,
      }, meta: { replayed: true } });
    const user = userEvent.setup();

    const Harness = () => {
      const [draft, setDraft] = React.useState({ ...correction, revision: 3 });
      return <DomainSetupModal ownerId="01MERCHANT" isOpen onClose={vi.fn()} draft={draft} onDraftChanged={setDraft} storeName={correction.storeName} businessType={correction.businessType} themeStyle="elegant" config={correction.config} />;
    };
    renderInterface(
      <Harness />,
      createFakeUiAdapters({ plans: { list: listPlans, domainAvailability: availability }, provisioning: { saveCorrection, resubmit } }),
    );

    await screen.findByText(/corrected-shop\.eoshop\.local متاح/, {}, { timeout: 1500 });
    await user.click(screen.getByRole("button", { name: "حفظ العنوان والباقة والانتقال للوثائق" }));
    await user.click(await screen.findByRole("button", { name: "إرسال ملف الطلب للمراجعة" }));
    expect(await screen.findByText(/نتيجة الإرسال السابق غير مؤكدة/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "إرسال ملف الطلب للمراجعة" }));

    await waitFor(() => expect(resubmit).toHaveBeenCalledTimes(2));
    expect(saveCorrection).toHaveBeenCalledTimes(1);
    expect(resubmit).toHaveBeenNthCalledWith(1, correction.tenantId, correction.revision, "01MERCHANT");
    expect(resubmit).toHaveBeenNthCalledWith(2, correction.tenantId, correction.revision, "01MERCHANT");
  });

  it("retains the current server-pricing headings without a screen redesign", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);

    renderInterface(
      <ServerPricingPlans onStart={vi.fn()} />,
      createFakeUiAdapters({ plans: { list: listPlans } }),
    );

    expect(screen.getByRole("heading", { name: "الباقات والأسعار" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "البداية" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ابدأ تصميم المتجر/ })).toBeTruthy();
  });

  it("ignores a stale domain response after the merchant changes the handle", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    let resolveFirst!: (value: { handle: string; domain: string; available: boolean }) => void;
    let resolveSecond!: (value: { handle: string; domain: string; available: boolean }) => void;
    const availability = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const user = userEvent.setup();

    renderInterface(
      <DomainSetupModal
        ownerId="01MERCHANT"
        isOpen
        onClose={vi.fn()}
        storeName="متجري"
        businessType="تجزئة"
        themeStyle="elegant"
        config={{ storeName: "متجري" }}
      />,
      createFakeUiAdapters({
        plans: { list: listPlans, domainAvailability: availability },
      }),
    );

    const handleInput = screen.getByLabelText("عنوان المتجر داخل المنصة");
    await user.type(handleInput, "first-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await user.clear(handleInput);
    await user.type(handleInput, "second-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledTimes(2), { timeout: 1500 });

    resolveSecond({ handle: "second-shop", domain: "second-shop.eoshop.local", available: true });
    expect(await screen.findByText(/second-shop\.eoshop\.local متاح/)).toBeTruthy();
    resolveFirst({ handle: "first-shop", domain: "first-shop.eoshop.local", available: true });

    await waitFor(() => expect(screen.queryByText(/first-shop\.eoshop\.local متاح/)).toBeNull());
    expect(screen.getByText(/second-shop\.eoshop\.local متاح/)).toBeTruthy();
  });
});
