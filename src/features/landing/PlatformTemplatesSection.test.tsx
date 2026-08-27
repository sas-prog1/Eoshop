// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlatformTemplatesSection from "./PlatformTemplatesSection";

afterEach(cleanup);

describe("PlatformTemplatesSection", () => {
  it("uses the onboarding template catalog and switches the displayed preview", async () => {
    const operator = userEvent.setup();
    render(<PlatformTemplatesSection onStart={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 2, name: "اختر نقطة البداية الأقرب إلى نشاطك" })).toBeTruthy();
    expect(screen.getByText("تفاصيل جميلة تصنع فرقًا")).toBeTruthy();

    await operator.click(screen.getByRole("button", { name: /التقنية والابتكار/ }));

    expect(screen.getByRole("button", { name: /التقنية والابتكار/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("التقنية التي تناسب يومك")).toBeTruthy();
    expect(screen.getByText("سماعة لاسلكية")).toBeTruthy();
  });

  it("supports device previews and starts the real merchant journey", async () => {
    const operator = userEvent.setup();
    const onStart = vi.fn();
    render(<PlatformTemplatesSection onStart={onStart} />);

    await operator.click(screen.getByRole("button", { name: "جوال" }));
    expect(screen.getByTestId("template-preview").getAttribute("data-device")).toBe("mobile");

    await operator.click(screen.getByRole("button", { name: "ابدأ إنشاء متجرك" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
