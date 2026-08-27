// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import PlatformCapabilitiesSection from "./PlatformCapabilitiesSection";

afterEach(cleanup);

describe("PlatformCapabilitiesSection", () => {
  it("presents only currently supported merchant capabilities", () => {
    render(<PlatformCapabilitiesSection />);

    expect(screen.getByRole("heading", { level: 2, name: "كل ما تحتاجه لإدارة متجرك من مكان واحد" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "المنتجات والمخزون" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("إضافة المنتجات وتعديل بياناتها")).toBeTruthy();
    expect(screen.queryByText(/بوابات الدفع الإلكتروني|شركات الشحن|التسويق الآلي/)).toBeNull();
  });

  it("switches the accessible preview when a capability is selected", async () => {
    const operator = userEvent.setup();
    render(<PlatformCapabilitiesSection />);

    await operator.click(screen.getByRole("tab", { name: "الطلبات والعملاء" }));

    expect(screen.getByRole("tab", { name: "الطلبات والعملاء" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("capability-tab-orders");
    expect(screen.getByText("كل طلب واضح من لحظة استلامه")).toBeTruthy();
    expect(screen.getByText("سجل زمني لحالة الطلب")).toBeTruthy();
  });
});
