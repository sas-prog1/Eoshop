// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { StoreDraft, UserProfile } from "../../adapters/uiAdapters";
import MerchantOnboardingPage from "./MerchantOnboardingPage";
import { createTemplateConfig, ONBOARDING_TEMPLATES } from "./storeTemplates";
import { ApiError } from "../../services/apiClient";

const user: UserProfile = {
  id: "owner-guided",
  fullName: "Guided Owner",
  email: "guided@example.test",
  phone: "",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const businessDraft: StoreDraft = {
  id: "draft-guided",
  tenantId: null,
  status: "draft",
  revision: 1,
  onboardingStage: "business",
  onboardingReadiness: { business: true, design: false, review: false, blockers: ["design_incomplete"] },
  nextRequiredStep: "design",
  storeName: "Guided Store",
  businessType: "تجزئة",
  themeStyle: "elegant",
  handle: null,
  planKey: null,
  config: createTemplateConfig(ONBOARDING_TEMPLATES[0], "Guided Store"),
  savedAt: null,
  submittedAt: null,
};

const starter = {
  key: "starter",
  name: "البداية",
  priceMinor: 0,
  currency: "YER",
  billingInterval: "monthly" as const,
  activationMode: "automatic" as const,
  maxStores: 1,
  maxProducts: 10,
  features: [],
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("MerchantOnboardingPage", () => {
  it("resumes an existing draft at its server-required step from the generic creation entry", async () => {
    window.history.replaceState({}, "", "/app/new");
    const designDraft: StoreDraft = {
      ...businessDraft,
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["domain_unavailable"] },
      nextRequiredStep: "review",
    };
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(designDraft) },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "راجع الطلب قبل الإرسال" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new/review");
    expect(screen.getByText("اكتب عنوانًا للمتجر من 3 أحرف على الأقل.")).toBeTruthy();
  });

  it("explains missing review requirements when the merchant presses submit instead of disabling it silently", async () => {
    const designDraft: StoreDraft = {
      ...businessDraft,
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["domain_unavailable"] },
      nextRequiredStep: "review",
    };
    const saveReview = vi.fn();
    const submit = vi.fn();
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(designDraft), saveReview, submit },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="review" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    await userEvent.click(await screen.findByRole("button", { name: "تأكيد التصميم وإرسال طلب المراجعة" }));

    expect((await screen.findByRole("alert")).textContent).toContain("اكتب عنوانًا للمتجر من 3 أحرف على الأقل.");
    expect(saveReview).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("invalidates a previous available-domain result while a changed handle is being checked", async () => {
    const designDraft: StoreDraft = {
      ...businessDraft,
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["domain_unavailable"] },
      nextRequiredStep: "review",
    };
    let resolveSecond!: (value: { handle: string; domain: string; available: boolean }) => void;
    const domainAvailability = vi.fn((handle: string) => handle === "first-shop"
      ? Promise.resolve({ handle, domain: `${handle}.eoshop.local`, available: true })
      : new Promise<{ handle: string; domain: string; available: boolean }>((resolve) => { resolveSecond = resolve; }));
    const savedReview = { ...designDraft, revision: 3, onboardingStage: "review" as const, nextRequiredStep: "submit" as const, handle: "second-shop", planKey: "starter", onboardingReadiness: { business: true, design: true, review: true, blockers: [] } };
    const saveReview = vi.fn().mockResolvedValue(savedReview);
    const submit = vi.fn(() => new Promise<never>(() => undefined));
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(designDraft), saveReview, submit },
      plans: { list: vi.fn().mockResolvedValue([starter]), domainAvailability },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="review" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    const input = await screen.findByRole("textbox", { name: /معرّف عنوان المتجر/ });
    await userEvent.type(input, "first-shop");
    expect(await screen.findByText("متاح الآن: first-shop.eoshop.local")).toBeTruthy();

    await userEvent.clear(input);
    await userEvent.type(input, "second-shop");
    await waitFor(() => expect(domainAvailability).toHaveBeenCalledWith("second-shop", expect.any(AbortSignal)));
    await userEvent.click(screen.getByRole("button", { name: "تأكيد التصميم وإرسال طلب المراجعة" }));
    expect(saveReview).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain("انتظر حتى يكتمل التحقق");

    resolveSecond({ handle: "second-shop", domain: "second-shop.eoshop.local", available: true });
    expect(await screen.findByText("متاح الآن: second-shop.eoshop.local")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "تأكيد التصميم وإرسال طلب المراجعة" }));
    await waitFor(() => expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ handle: "second-shop", planKey: "starter" }), expect.any(AbortSignal)));
    expect(submit).toHaveBeenCalledOnce();
  }, 30_000);

  it("falls back from an inactive saved plan to the only active non-starter plan", async () => {
    const pro = { ...starter, key: "pro", name: "الاحترافية", maxProducts: 100 };
    const reviewDraft: StoreDraft = {
      ...businessDraft,
      revision: 3,
      onboardingStage: "review",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["plan_unavailable"] },
      nextRequiredStep: "review",
      handle: "pro-only-shop",
      planKey: "retired",
    };
    const savedReview: StoreDraft = {
      ...reviewDraft,
      revision: 4,
      onboardingReadiness: { business: true, design: true, review: true, blockers: [] },
      nextRequiredStep: "submit",
      planKey: "pro",
    };
    const saveReview = vi.fn().mockResolvedValue(savedReview);
    const submit = vi.fn(() => new Promise<never>(() => undefined));
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(reviewDraft), saveReview, submit },
      plans: {
        list: vi.fn().mockResolvedValue([pro]),
        domainAvailability: vi.fn().mockResolvedValue({ handle: "pro-only-shop", domain: "pro-only-shop.eoshop.local", available: true }),
      },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="review" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    const plan = await screen.findByRole("combobox", { name: /الباقة/ }) as HTMLSelectElement;
    expect(plan.value).toBe("pro");
    expect(await screen.findByText("الطلب جاهز للإرسال")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "تأكيد التصميم وإرسال طلب المراجعة" }));
    await waitFor(() => expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ planKey: "pro" }), expect.any(AbortSignal)));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("guards a direct review URL with server readiness then persists design before advancing", async () => {
    window.history.replaceState({}, "", "/app/new/review");
    const designDraft: StoreDraft = {
      ...businessDraft,
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["plan_unavailable", "domain_unavailable"] },
      nextRequiredStep: "review",
    };
    const saveDesign = vi.fn().mockResolvedValue(designDraft);
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(businessDraft), saveDesign },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="review" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "اختر القالب الحقيقي" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new/design");
    await userEvent.click(screen.getByRole("button", { name: /التقنية والابتكار/ }));
    const slogan = screen.getByRole("textbox", { name: "العبارة التعريفية" });
    await userEvent.clear(slogan);
    await userEvent.type(slogan, "هوية تقنية مخصصة قبل الإرسال");
    await userEvent.click(screen.getByRole("button", { name: "معاينة الجوال" }));
    await userEvent.click(screen.getByRole("button", { name: "حفظ التصميم والانتقال للمعاينة النهائية" }));
    await waitFor(() => expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 1,
      themeStyle: "tech",
      config: expect.objectContaining({ slogan: "هوية تقنية مخصصة قبل الإرسال" }),
    }), expect.any(AbortSignal)));
    expect(saveDesign.mock.calls[0][0].config).not.toHaveProperty("products");
    expect(saveDesign.mock.calls[0][0].config).not.toHaveProperty("currency");
    expect(saveDesign.mock.calls[0][0].config).not.toHaveProperty("marketingBlocks");
    expect(saveDesign.mock.calls[0][0].config).not.toHaveProperty("heroBannerImage");
    expect(await screen.findByRole("heading", { name: "راجع الطلب قبل الإرسال" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new/review");
  }, 30_000);

  it("keeps sample products preview-only and resets preview interactions when the template changes", async () => {
    window.history.replaceState({}, "", "/app/new/design");
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(businessDraft) },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="design" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByText("عطر ليالي صنعاء")).toBeTruthy();
    await userEvent.click(screen.getAllByTitle("أضف للسلة")[0]);
    expect(screen.getAllByText("عطر ليالي صنعاء").length).toBeGreaterThan(1);

    await userEvent.click(screen.getByRole("button", { name: /التقنية والابتكار/ }));

    expect((await screen.findAllByText("سماعة لاسلكية")).length).toBeGreaterThan(0);
    expect(screen.queryByText("عطر ليالي صنعاء")).toBeNull();
  }, 30_000);

  it("shows each real storefront composition during template selection and supports a full preview", async () => {
    window.history.replaceState({}, "", "/app/new/design");
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(businessDraft) },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    const view = render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="design" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "اختر القالب الحقيقي" })).toBeTruthy();
    expect(view.container.querySelector('[data-elegant-story-count="5"]')).not.toBeNull();
    expect(view.container.querySelectorAll("[data-elegant-discovery] [role=listitem]")).toHaveLength(6);

    await userEvent.click(screen.getByRole("button", { name: /التقنية والابتكار/ }));
    expect(await screen.findByText("المعروض الآن: Tech Bento")).toBeTruthy();
    expect(view.container.querySelector('[data-tech-bento-count="5"]')).not.toBeNull();
    expect(view.container.querySelector('[data-tech-ad-count="2"]')).not.toBeNull();
    expect(view.container.querySelectorAll("[data-tech-discovery-id]")).toHaveLength(10);

    await userEvent.click(screen.getByRole("button", { name: "فتح المعاينة الكاملة" }));
    expect(screen.getByRole("dialog", { name: "معاينة كاملة للمتجر" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "معاينة كاملة للمتجر" })).toBeNull();
  }, 30_000);

  it("starts a new draft even when the owner already has stores instead of imposing a UI-only one-store limit", async () => {
    window.history.replaceState({}, "", "/app/new");
    const listStores = vi.fn();
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(null), listStores },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    expect(listStores).not.toHaveBeenCalled();
  });

  it("fails closed when the session expires while loading or saving a step", async () => {
    const loadExpired = vi.fn();
    const loadAdapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockRejectedValue(new ApiError("expired", "unauthenticated", 401)) },
    });
    const first = render(<UiAdaptersProvider adapters={loadAdapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={loadExpired} /></UiAdaptersProvider>);
    await waitFor(() => expect(loadExpired).toHaveBeenCalledWith("/app/new"));
    first.unmount();

    const saveExpired = vi.fn();
    const saveAdapters = createFakeUiAdapters({
      provisioning: {
        recoverCommittedSubmission: vi.fn().mockResolvedValue(null),
        currentDraft: vi.fn().mockResolvedValue(businessDraft),
        saveDesign: vi.fn().mockRejectedValue(new ApiError("expired", "unauthenticated", 401)),
      },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    render(<UiAdaptersProvider adapters={saveAdapters}><MerchantOnboardingPage user={user} requestedStep="design" onSessionExpired={saveExpired} /></UiAdaptersProvider>);
    await screen.findByRole("heading", { name: "اختر القالب الحقيقي" });
    await userEvent.click(screen.getByRole("button", { name: "حفظ التصميم والانتقال للمعاينة النهائية" }));
    await waitFor(() => expect(saveExpired).toHaveBeenCalledWith("/app/new/design"));
  });

  it("guards an unsaved first step against browser unload", async () => {
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(null) },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    await userEvent.type(await screen.findByRole("textbox", { name: "اسم المتجر أو النشاط" }), "مسودة غير محفوظة");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("invalidates a delayed draft load when the authenticated owner changes", async () => {
    let resolveFirst!: (value: null) => void;
    const recoverCommittedSubmission = vi.fn((ownerId: string) => ownerId === user.id
      ? new Promise<null>((resolve) => { resolveFirst = resolve; })
      : Promise.resolve(null));
    const currentDraft = vi.fn().mockResolvedValue(null);
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission, currentDraft },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    const view = render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    const nextUser = { ...user, id: "owner-guided-b", email: "guided-b@example.test" };
    view.rerender(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={nextUser} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    resolveFirst(null);
    await Promise.resolve();
    expect(currentDraft).toHaveBeenCalledTimes(1);
  });
});
