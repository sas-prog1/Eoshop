// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { PlatformSettingsProvider } from "../../adapters/PlatformSettingsContext";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { UserProfile } from "../../adapters/uiAdapters";
import { DEFAULT_PLATFORM_SETTINGS } from "../../services/platformSettingsApi";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("platform settings application", () => {
  it("applies public support, mobile navigation and a deliberately empty tagline", async () => {
    const settings = {
      ...structuredClone(DEFAULT_PLATFORM_SETTINGS),
      platformName: "منصة الاختبار",
      tagline: null,
      supportEmail: "support@example.test",
      supportPhone: "+967700000000",
      supportWhatsapp: "+967711111111",
      navigationItems: DEFAULT_PLATFORM_SETTINGS.navigationItems.map((item) => ({
        ...item,
        label: `رابط ${item.position}`,
      })),
    };
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(null) },
      platformSettings: { load: vi.fn().mockResolvedValue(settings) },
    });

    render(
      <UiAdaptersProvider adapters={adapters}>
        <PlatformSettingsProvider><App /></PlatformSettingsProvider>
      </UiAdaptersProvider>,
    );

    expect((await screen.findAllByText("منصة الاختبار")).length).toBeGreaterThan(0);
    const visitor = userEvent.setup();
    await visitor.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي للجوال" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "support@example.test" }).getAttribute("href")).toBe("mailto:support@example.test");
    expect(screen.getByRole("link", { name: "+967700000000" }).getAttribute("href")).toBe("tel:+967700000000");
    expect(screen.getByRole("link", { name: "واتساب الدعم" }).getAttribute("href")).toBe("https://wa.me/967711111111");
    await waitFor(() => expect(screen.queryByText("منصة المتاجر الرقمية")).toBeNull());
  });

  it("guards browser unload and history while administrator settings are dirty", async () => {
    window.history.replaceState({}, "", "/admin/settings");
    const operator: UserProfile = {
      id: "01SETTINGSOPERATOR",
      fullName: "مدير الإعدادات",
      email: "settings@example.test",
      phone: "",
      profileRevision: 1,
      createdAt: null,
      updatedAt: null,
      role: "admin",
      platformRoles: ["platform_super_admin"],
      platformPermissions: ["platform.settings.manage"],
    };
    const adminSettings = {
      ...structuredClone(DEFAULT_PLATFORM_SETTINGS),
      updatedAt: null,
      updatedByUserId: null,
    };
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(operator) },
      platformSettings: { load: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_SETTINGS) },
      administration: { getPlatformSettings: vi.fn().mockResolvedValue(adminSettings) },
    });
    const user = userEvent.setup();

    render(
      <UiAdaptersProvider adapters={adapters}>
        <PlatformSettingsProvider><App /></PlatformSettingsProvider>
      </UiAdaptersProvider>,
    );

    const name = await screen.findByLabelText("اسم المنصة");
    await user.clear(name);
    await user.type(name, "هوية غير محفوظة");

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe("/admin/settings");
  }, 15_000);
});
