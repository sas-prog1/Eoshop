// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import { UiAdapterError } from "../../adapters/uiAdapters";
import { DEFAULT_PLATFORM_SETTINGS, type AdminPlatformSettings } from "../../services/platformSettingsApi";
import PlatformSettingsPanel from "./PlatformSettingsPanel";

const serverSettings = (overrides: Partial<AdminPlatformSettings> = {}): AdminPlatformSettings => ({
  ...structuredClone(DEFAULT_PLATFORM_SETTINGS),
  updatedAt: null,
  updatedByUserId: null,
  ...overrides,
});

function renderPanel(getPlatformSettings: () => Promise<AdminPlatformSettings>, updatePlatformSettings = vi.fn()) {
  const onDirtyChange = vi.fn();
  const administration = {
    ...createFakeUiAdapters().administration,
    getPlatformSettings,
    updatePlatformSettings,
  };
  render(<PlatformSettingsPanel
    administration={administration}
    refreshSignal={0}
    onSessionExpired={vi.fn()}
    onForbiddenChange={vi.fn()}
    onLoadingChange={vi.fn()}
    onDirtyChange={onDirtyChange}
    onSaved={vi.fn()}
    onToast={vi.fn()}
  />);
  return { onDirtyChange, updatePlatformSettings };
}

afterEach(cleanup);

describe("PlatformSettingsPanel", () => {
  it("tracks dirty edits and saves with the server revision", async () => {
    const update = vi.fn().mockResolvedValue(serverSettings({ revision: 2, platformName: "الهوية الجديدة" }));
    const { onDirtyChange } = renderPanel(vi.fn().mockResolvedValue(serverSettings()), update);
    const user = userEvent.setup();

    const name = await screen.findByLabelText("اسم المنصة");
    await user.clear(name);
    await user.type(name, "الهوية الجديدة");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(screen.getByRole("button", { name: "حفظ الإعدادات" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 1,
      platformName: "الهوية الجديدة",
    })));
    expect(update.mock.calls[0][0]).not.toHaveProperty("revision");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  }, 15_000);

  it("keeps a conflicting draft and requires an explicit server reload", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(serverSettings())
      .mockResolvedValueOnce(serverSettings({ revision: 2, platformName: "نسخة المدير الآخر" }));
    const update = vi.fn().mockRejectedValue(new UiAdapterError(
      "نسخة أحدث",
      "conflict",
      "platform_settings_revision_conflict",
    ));
    const { onDirtyChange } = renderPanel(get, update);
    const user = userEvent.setup();

    const name = await screen.findByLabelText("اسم المنصة");
    await user.clear(name);
    await user.type(name, "مسودتي المحلية");
    await user.click(screen.getByRole("button", { name: "حفظ الإعدادات" }));
    expect(await screen.findByText(/حفظ مدير آخر نسخة أحدث/)).toBeTruthy();
    expect((screen.getByLabelText("اسم المنصة").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("اسم المنصة"), " تعديل متأخر");
    expect((screen.getByLabelText("اسم المنصة") as HTMLInputElement).value).toBe("مسودتي المحلية");

    await user.click(screen.getByRole("button", { name: "تحميل نسخة الخادم" }));
    await waitFor(() => expect((screen.getByLabelText("اسم المنصة") as HTMLInputElement).value).toBe("نسخة المدير الآخر"));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "استعادة مسودتي للمراجعة" }));
    expect((screen.getByLabelText("اسم المنصة") as HTMLInputElement).value).toBe("مسودتي المحلية");
  }, 15_000);

  it("never renders an unsafe draft logo before server validation", async () => {
    renderPanel(vi.fn().mockResolvedValue(serverSettings()));
    const user = userEvent.setup();

    const logo = await screen.findByLabelText("رابط شعار HTTPS خارجي");
    await user.type(logo, "data:image/svg+xml,<svg></svg>");

    expect(await screen.findByText(/لن تُعرض معاينة الشعار/)).toBeTruthy();
    expect(document.querySelector('img[src^="data:"]')).toBeNull();
  }, 10_000);

  it("edits the bounded visual identity and previews landing and authentication before saving", async () => {
    const update = vi.fn().mockImplementation(async (payload) => serverSettings({
      ...payload,
      revision: 2,
      updatedAt: "2026-08-29T12:00:00Z",
    }));
    renderPanel(vi.fn().mockResolvedValue(serverSettings()), update);
    const user = userEvent.setup();

    const primary = await screen.findByLabelText("اللون الرئيسي — رمز اللون");
    await user.clear(primary);
    await user.type(primary, "#123456");
    await user.selectOptions(screen.getByLabelText("خط المنصة"), "Cairo");
    await user.type(screen.getByLabelText("رابط صورة الصفحة الرئيسية"), "https://cdn.example.test/platform/landing.jpg");
    await user.type(screen.getByLabelText("رابط صورة نافذة الدخول"), "https://cdn.example.test/platform/auth.jpg");

    expect(screen.getByTestId("platform-landing-preview")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(screen.getByTestId("platform-auth-preview")).toBeTruthy();
    expect(document.querySelector('img[src="https://cdn.example.test/platform/auth.jpg"]')).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "حفظ الإعدادات" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 1,
      brandPrimaryColor: "#123456",
      brandFontFamily: "Cairo",
      landingHeroImageUrl: "https://cdn.example.test/platform/landing.jpg",
      authImageUrl: "https://cdn.example.test/platform/auth.jpg",
    })));
  }, 15_000);

  it("blocks an unsafe visual identity image before any server mutation", async () => {
    const update = vi.fn();
    renderPanel(vi.fn().mockResolvedValue(serverSettings()), update);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("رابط صورة الصفحة الرئيسية"), "data:image/svg+xml,<svg></svg>");

    expect(await screen.findByText(/رابط صورة الصفحة الرئيسية غير آمن/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "حفظ الإعدادات" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('img[src^="data:"]')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  }, 10_000);

  it("fails closed and removes protected fields after a 403", async () => {
    renderPanel(vi.fn().mockRejectedValue(new UiAdapterError("سُحبت الصلاحية", "forbidden")));

    expect(await screen.findByRole("heading", { name: "تم سحب صلاحية إعدادات المنصة" })).toBeTruthy();
    expect(screen.queryByLabelText("اسم المنصة")).toBeNull();
    expect(screen.queryByRole("button", { name: "حفظ الإعدادات" })).toBeNull();
  });
});
