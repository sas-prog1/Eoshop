// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PLATFORM_SETTINGS } from "../../services/platformSettingsApi";
import PlatformLandingClosure from "./PlatformLandingClosure";

afterEach(cleanup);

describe("PlatformLandingClosure", () => {
  it("answers the current operational questions without unsupported promises", () => {
    render(
      <PlatformLandingClosure
        settings={DEFAULT_PLATFORM_SETTINGS}
        navigation={DEFAULT_PLATFORM_SETTINGS.navigationItems}
        user={null}
        onNavigate={vi.fn()}
        onStart={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "أسئلة واضحة عن إنشاء متجرك" })).toBeTruthy();
    expect(screen.getByText(/الباقات التي تتطلب تفعيلًا إداريًا لا تُعد مدفوعة/)).toBeTruthy();
    expect(screen.getByText(/بعد الاعتماد واكتمال التجهيز وقيام التاجر بالنشر/)).toBeTruthy();
    expect(screen.queryByText(/دفع آمن|آلاف التجار|الأكثر طلبًا/)).toBeNull();
  });

  it("uses server-owned support and routes the real calls to action", async () => {
    const onNavigate = vi.fn();
    const onStart = vi.fn();
    const onLogin = vi.fn();
    const user = userEvent.setup();
    const settings = {
      ...DEFAULT_PLATFORM_SETTINGS,
      supportEmail: "support@example.test",
      supportPhone: "+967700000000",
      supportWhatsapp: "+967711111111",
    };

    render(
      <PlatformLandingClosure
        settings={settings}
        navigation={settings.navigationItems}
        user={null}
        onNavigate={onNavigate}
        onStart={onStart}
        onLogin={onLogin}
      />,
    );

    expect(screen.getByRole("link", { name: /support@example.test/ }).getAttribute("href")).toBe("mailto:support@example.test");
    expect(screen.getByRole("link", { name: /\+967700000000/ }).getAttribute("href")).toBe("tel:+967700000000");
    expect(screen.getByRole("link", { name: "واتساب الدعم" }).getAttribute("href")).toBe("https://wa.me/967711111111");

    await user.click(screen.getByRole("button", { name: "ابدأ إنشاء متجرك" }));
    await user.click(screen.getByRole("button", { name: "لدي حساب بالفعل" }));
    await user.click(screen.getByRole("button", { name: "القوالب" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("templates");
  });
});
