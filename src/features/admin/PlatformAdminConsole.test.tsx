// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import { UiAdapterError, type PlatformOverview, type PlatformStore, type UserProfile } from "../../adapters/uiAdapters";
import PlatformAdminConsole from "../../components/PlatformAdminConsole";
import { DEFAULT_PLATFORM_SETTINGS } from "../../services/platformSettingsApi";

const overview: PlatformOverview = {
  generatedAt: "2026-08-21T12:00:00Z",
  stores: {
    total: 2,
    verification: { pending: 1, changes_requested: 0, approved: 1, rejected: 0, suspended: 0 },
    provisioning: { notStarted: 1, queued: 0, provisioning: 0, retrying: 0, active: 1, failed: 0 },
    publication: { requested: 1, published: 1, unpublished: 0, rejected: 0 },
  },
  attention: { review: 1, provisioning: 0, subscription: 0, publication: 1 },
};

const emptyPage = { items: [], pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: 0 } };

const pendingStore: PlatformStore = {
  id: "store-one",
  storeName: "متجر الاختبار الأول",
  ownerName: "مالك المتجر",
  ownerEmail: "owner@example.com",
  ownerPhone: null,
  businessType: "retail",
  verificationStatus: "pending",
  provisioningStatus: "not_started",
  publicationStatus: "requested",
  rejectionReason: null,
  themeStyle: "elegant",
  domains: [],
  requestedDomain: null,
  publicDomain: null,
  publicationBlockers: ["verification_pending"],
  subscription: null,
  createdAt: "2026-08-21T10:00:00Z",
  activeAt: null,
  latestProvisioningRun: null,
};

const storePage = (items: PlatformStore[]) => ({
  items,
  pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: items.length },
});

function operator(platformPermissions: string[]): UserProfile {
  return {
    id: "01OPERATOR",
    fullName: "مشغل المنصة",
    email: "operator@example.com",
    phone: "",
    profileRevision: 1,
    createdAt: null,
    updatedAt: null,
    role: platformPermissions.length > 0 ? "admin" : "merchant",
    platformRoles: [],
    platformPermissions,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PlatformAdminConsole", () => {
  it("refreshes approved stores while provisioning advances and stops at the terminal state", async () => {
    vi.useFakeTimers();
    const queuedStore: PlatformStore = {
      ...pendingStore,
      verificationStatus: "approved",
      provisioningStatus: "queued",
      publicationBlockers: ["provisioning_not_ready"],
    };
    const activeStore: PlatformStore = {
      ...queuedStore,
      provisioningStatus: "active",
      publicationBlockers: [],
      activeAt: "2026-08-25T00:00:00Z",
    };
    const listStores = vi.fn()
      .mockResolvedValueOnce(storePage([queuedStore]))
      .mockResolvedValueOnce(storePage([activeStore]));

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view"])}
          section="stores"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(listStores).toHaveBeenCalledTimes(1);
    expect(screen.getByText(queuedStore.storeName)).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(listStores).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(listStores).toHaveBeenCalledTimes(2);
  });

  it("keeps main content and session controls reachable when the desktop sidebar is hidden", async () => {
    const onExit = vi.fn();
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: { overview: vi.fn().mockResolvedValue(overview) } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view"])}
          section="overview"
          onNavigate={vi.fn()}
          onExit={onExit}
          onLogout={onLogout}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    expect(screen.getByRole("link", { name: "تجاوز التنقل والانتقال إلى المحتوى الرئيسي" }).getAttribute("href")).toBe("#platform-admin-main");
    expect(document.getElementById("platform-admin-main")?.getAttribute("tabindex")).toBe("-1");
    const mobileNavigation = screen.getByRole("navigation", { name: "أقسام إدارة المنصة للجوال" });
    expect(within(mobileNavigation).getByRole("button", { name: "النظرة" }).getAttribute("aria-current")).toBe("page");

    await userEvent.click(screen.getByRole("button", { name: "العودة إلى الموقع" }));
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
    expect(onExit).toHaveBeenCalledOnce();
    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it("routes a settings-only manager to the protected settings workspace", async () => {
    const getPlatformSettings = vi.fn().mockResolvedValue({
      ...structuredClone(DEFAULT_PLATFORM_SETTINGS),
      updatedAt: null,
      updatedByUserId: null,
    });
    const onNavigate = vi.fn();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: { getPlatformSettings } })}>
        <PlatformAdminConsole
          user={operator(["platform.settings.manage"])}
          section="overview"
          onNavigate={onNavigate}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("settings"));
    expect(await screen.findByLabelText("اسم المنصة")).toBeTruthy();
    expect(getPlatformSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps the settings dirty guard when server logout fails", async () => {
    const onDirtyChange = vi.fn();
    const onLogout = vi.fn().mockRejectedValue(new Error("logout failed"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        getPlatformSettings: vi.fn().mockResolvedValue({
          ...structuredClone(DEFAULT_PLATFORM_SETTINGS),
          updatedAt: null,
          updatedByUserId: null,
        }),
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.settings.manage"])}
          section="settings"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={onLogout}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      </UiAdaptersProvider>,
    );

    const name = await screen.findByLabelText("اسم المنصة");
    await user.clear(name);
    await user.type(name, "هوية غير محفوظة");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(screen.getByRole("button", { name: "خروج" }));
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("routes a users-only manager to users without requesting store or audit data", async () => {
    const onNavigate = vi.fn();
    const overviewCall = vi.fn();
    const listStores = vi.fn();
    const listAuditLogs = vi.fn();
    const listUsers = vi.fn().mockResolvedValue(emptyPage);
    const listPlatformRoles = vi.fn().mockResolvedValue([]);

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: overviewCall,
        listStores,
        listAuditLogs,
        listUsers,
        listPlatformRoles,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.users.manage"])}
          section="overview"
          onNavigate={onNavigate}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("users"));
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 25 }));
    expect(overviewCall).not.toHaveBeenCalled();
    expect(listStores).not.toHaveBeenCalled();
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it("redirects an audit-only operator to audit and never requests store data", async () => {
    const onNavigate = vi.fn();
    const overviewCall = vi.fn();
    const listStores = vi.fn();
    const listAuditLogs = vi.fn().mockResolvedValue(emptyPage);

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: { overview: overviewCall, listStores, listAuditLogs } })}>
        <PlatformAdminConsole
          user={operator(["platform.audit.view"])}
          section="overview"
          onNavigate={onNavigate}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("audit"));
    await waitFor(() => expect(listAuditLogs).toHaveBeenCalledWith({ page: 1, perPage: 25 }));
    expect(overviewCall).not.toHaveBeenCalled();
    expect(listStores).not.toHaveBeenCalled();
  });

  it("fails closed for a merchant without issuing administration requests", () => {
    const overviewCall = vi.fn();
    const listStores = vi.fn();
    const listAuditLogs = vi.fn();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: { overview: overviewCall, listStores, listAuditLogs } })}>
        <PlatformAdminConsole
          user={operator([])}
          section="overview"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    expect(screen.getByRole("heading", { name: "لا تملك صلاحية دخول إدارة المنصة" })).toBeTruthy();
    expect(overviewCall).not.toHaveBeenCalled();
    expect(listStores).not.toHaveBeenCalled();
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it("opens an overview attention queue with the matching server-side filter", async () => {
    const listStores = vi.fn().mockResolvedValue(emptyPage);
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view"])}
          section="overview"
          onNavigate={onNavigate}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /مراجعات تنتظر قرارًا/ }));
    expect(onNavigate).toHaveBeenCalledWith("stores");
    await waitFor(() => expect(listStores).toHaveBeenLastCalledWith({ page: 1, perPage: 25, attention: "review" }));
  });

  it("expires the administration context on 401 and surfaces 422 without inventing an empty result", async () => {
    const onSessionExpired = vi.fn();
    const listStores = vi.fn().mockRejectedValue(new UiAdapterError("مرشح غير صالح", "validation"));

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockRejectedValue(new UiAdapterError("انتهت الجلسة", "unauthenticated")),
        listStores,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view"])}
          section="stores"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={onSessionExpired}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("مرشح غير صالح")).toBeTruthy();
    expect(screen.queryByText("لا توجد متاجر مطابقة للمرشحات الحالية.")).toBeNull();
  });

  it("keeps the last store data on a network failure but clears it when the server returns 403", async () => {
    const listStores = vi.fn()
      .mockResolvedValueOnce(storePage([pendingStore]))
      .mockRejectedValueOnce(new UiAdapterError("الشبكة غير متاحة", "network"))
      .mockRejectedValueOnce(new UiAdapterError("تم سحب الصلاحية", "forbidden"));
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view", "platform.stores.review"])}
          section="stores"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    expect(await screen.findByText(pendingStore.storeName)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحديث" }));
    expect(await screen.findByText("الشبكة غير متاحة")).toBeTruthy();
    expect(screen.getByText(pendingStore.storeName)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "تحديث" }));
    expect(await screen.findByRole("heading", { name: "تم سحب صلاحية هذا القسم" })).toBeTruthy();
    expect(screen.queryByText(pendingStore.storeName)).toBeNull();
    expect(screen.queryByRole("button", { name: "قبول" })).toBeNull();
  });

  it("clears the audit projection when the server revokes audit access", async () => {
    const listAuditLogs = vi.fn().mockRejectedValue(new UiAdapterError("تم سحب صلاحية التدقيق", "forbidden"));

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: { listAuditLogs } })}>
        <PlatformAdminConsole
          user={operator(["platform.audit.view"])}
          section="audit"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    expect(await screen.findByRole("heading", { name: "تم سحب صلاحية هذا القسم" })).toBeTruthy();
    expect(screen.queryByText("لا توجد أحداث تدقيق مطابقة.")).toBeNull();
  });

  it("fails closed and removes store actions when a mutation returns 403", async () => {
    const updateStoreStatus = vi.fn().mockRejectedValue(new UiAdapterError("لم تعد مخولًا", "forbidden"));
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores: vi.fn().mockResolvedValue(storePage([pendingStore])),
        updateStoreStatus,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view", "platform.stores.review"])}
          section="stores"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "قبول" }));
    await waitFor(() => expect(updateStoreStatus).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "تم سحب صلاحية هذا القسم" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "قبول" })).toBeNull();
  });

  it("serializes store mutations globally while a deferred operation is pending", async () => {
    let resolveMutation!: (store: PlatformStore) => void;
    const updateStoreStatus = vi.fn(() => new Promise<PlatformStore>((resolve) => { resolveMutation = resolve; }));
    const secondStore = { ...pendingStore, id: "store-two", storeName: "متجر الاختبار الثاني" };
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ administration: {
        overview: vi.fn().mockResolvedValue(overview),
        listStores: vi.fn().mockResolvedValue(storePage([pendingStore, secondStore])),
        updateStoreStatus,
      } })}>
        <PlatformAdminConsole
          user={operator(["platform.stores.view", "platform.stores.review"])}
          section="stores"
          onNavigate={vi.fn()}
          onExit={vi.fn()}
          onLogout={vi.fn().mockResolvedValue(undefined)}
          onSessionExpired={vi.fn()}
          onToast={vi.fn()}
        />
      </UiAdaptersProvider>,
    );

    const acceptButtons = await screen.findAllByRole("button", { name: "قبول" });
    await user.click(acceptButtons[0]);
    await waitFor(() => expect(updateStoreStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(acceptButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true));
    await user.click(acceptButtons[1]);
    expect(updateStoreStatus).toHaveBeenCalledTimes(1);

    resolveMutation({ ...pendingStore, verificationStatus: "approved" });
    await waitFor(() => expect((screen.getAllByRole("button", { name: "قبول" })[0] as HTMLButtonElement).disabled).toBe(false));
  });
});
