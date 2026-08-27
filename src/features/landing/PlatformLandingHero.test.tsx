// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PLATFORM_SETTINGS } from "../../services/platformSettingsApi";
import PlatformLandingHero from "./PlatformLandingHero";

afterEach(cleanup);

function renderHero() {
  const actions = {
    onNavigate: vi.fn(),
    onLogin: vi.fn(),
    onRegister: vi.fn(),
    onOpenPortal: vi.fn(),
    onCreateStore: vi.fn(),
    onExplainJourney: vi.fn(),
  };

  render(
    <PlatformLandingHero
      settings={DEFAULT_PLATFORM_SETTINGS}
      navigation={DEFAULT_PLATFORM_SETTINGS.navigationItems}
      user={null}
      {...actions}
    />,
  );

  return actions;
}

describe("PlatformLandingHero", () => {
  it("presents one clear guest journey without experimental visual copy", async () => {
    const operator = userEvent.setup();
    const actions = renderHero();

    expect(screen.getByRole("heading", { level: 1, name: DEFAULT_PLATFORM_SETTINGS.landingHeadline })).toBeTruthy();
    expect(screen.getByText("منصة متاجر إلكترونية لأصحاب الأعمال")).toBeTruthy();
    expect(screen.queryByText(/الجيل القادم من التجارة الإلكترونية/)).toBeNull();
    expect(screen.queryByText(/🚀|👋/)).toBeNull();

    await operator.click(screen.getByRole("button", { name: "ابدأ إنشاء متجرك" }));
    expect(actions.onRegister).toHaveBeenCalledTimes(1);

    await operator.click(screen.getByRole("button", { name: "اكتشف كيف تعمل المنصة" }));
    expect(actions.onExplainJourney).toHaveBeenCalledTimes(1);
  });

  it("keeps navigation and authentication available on the compact menu", async () => {
    const operator = userEvent.setup();
    const actions = renderHero();

    await operator.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي للجوال" })).toBeTruthy();

    const templateButtons = screen.getAllByRole("button", { name: "القوالب" });
    await operator.click(templateButtons.at(-1)!);
    expect(actions.onNavigate).toHaveBeenCalledWith("templates");
  });
});
