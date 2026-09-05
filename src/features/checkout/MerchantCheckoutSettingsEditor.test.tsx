// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../../types";
import MerchantCheckoutSettingsEditor from "./MerchantCheckoutSettingsEditor";

afterEach(cleanup);

describe("MerchantCheckoutSettingsEditor", () => {
  it("emits controlled operational changes and exposes no unsupported gateway switch", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MerchantCheckoutSettingsEditor config={{ ...ELEGANT_PRESET, enableCoupons: true }} onChange={onChange} />);
    await user.click(screen.getByRole("switch", { name: "التحويل البنكي" }));
    expect(onChange).toHaveBeenCalledWith("enableBankTransfer", true);
    expect(screen.getByRole("spinbutton", { name: "نسبة الخصم الجديدة" }).getAttribute("step")).toBe("0.01");
    expect(screen.queryByRole("switch", { name: /Apple Pay|STC Pay|بطاقات/ })).toBeNull();
    expect(screen.getByText(/غير متاح حتى يتم ربط بوابة دفع حقيقية/)).toBeTruthy();
  });

  it("adds a canonical immutable wallet identifier", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MerchantCheckoutSettingsEditor config={{ ...ELEGANT_PRESET, enableEWallets: true }} onChange={onChange} />);
    await user.type(screen.getByRole("textbox", { name: "اسم المحفظة الجديدة" }), "محفظتي");
    await user.type(screen.getByRole("textbox", { name: "رقم حساب المحفظة الجديدة" }), "999888777");
    await user.type(screen.getByRole("textbox", { name: "اسم مستفيد المحفظة الجديدة" }), "مالك المتجر");
    await user.click(screen.getByRole("button", { name: /إضافة محفظة/ }));
    expect(onChange).toHaveBeenCalledWith("customWallets", [expect.objectContaining({ id: "wallet-11111111-1111-4111-8111-111111111111", active: true })]);
    vi.unstubAllGlobals();
  });
});
