// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderReceipt } from "../adapters/uiAdapters";
import { ELEGANT_PRESET, TECH_PRESET } from "../types";
import StorePreview from "./StorePreview";

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Server Product",
  price: 10,
  description: "Server product",
  category: "General",
  imageKeyword: "product",
  status: "published" as const,
};

const receipt: OrderReceipt = {
  id: "22222222-2222-4222-8222-222222222222",
  number: "EO-SERVER-001",
  status: "submitted",
  paymentState: "transfer_submitted_unverified",
  currencyCode: "YER",
  totals: {
    itemsSubtotalMinor: 1250,
    discountMinor: 0,
    shippingMinor: 500,
    taxMinor: 188,
    paymentFeeMinor: 100,
    grandTotalMinor: 2038,
  },
  items: [{
    productId: product.id,
    name: "Server Product",
    sku: "SERVER-1",
    unitPriceMinor: 1250,
    quantity: 1,
    lineTotalMinor: 1250,
    tracked: true,
  }],
  createdAt: "2026-08-17T10:00:00Z",
  checkoutPresentation: {
    title: "عنوان الإيصال المثبت من الخادم",
    message: "رسالة الإيصال المثبتة من الخادم.",
    whatsappTarget: "+967700000000",
  },
};

afterEach(cleanup);

function checkoutProps() {
  return {
    config: {
      ...ELEGANT_PRESET,
      products: [product],
      currency: "YER",
      requireEmail: false,
      enableCashOnDelivery: false,
      enableEWallets: false,
      enableBankTransfer: true,
      bankName: "Server Bank",
      bankAccountName: "Server Merchant",
      bankAccountNumber: "SA0380000000608010167519",
    },
    cart: [{ product, quantity: 1 }],
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    calculateTotal: vi.fn(),
    isCartDrawerOpen: false,
    setIsCartDrawerOpen: vi.fn(),
    hasOrdered: false,
    handleCheckout: vi.fn(),
    selectedCategory: "all",
    setSelectedCategory: vi.fn(),
    externalPage: "checkout",
  };
}

async function fillRequiredCheckoutFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/عبدالله محمد/), "Live Customer");
  await user.type(screen.getByPlaceholderText(/0500000000/), "+967700000009");
  await user.type(screen.getByPlaceholderText(/اسم الشارع/), "Server Address");
}

describe("server-backed checkout interface", () => {
  it("scopes the editorial checkout treatment to Elegant while Tech keeps the shared flow", () => {
    const props = checkoutProps();
    const { container, rerender } = render(<StorePreview {...props} mode="preview" />);

    const elegantCheckout = container.querySelector('[data-elegant-checkout="true"]');
    expect(elegantCheckout).toBeTruthy();
    expect(elegantCheckout?.classList.contains("elegant-checkout")).toBe(true);
    expect(elegantCheckout?.querySelector(".elegant-checkout__progress")).toBeTruthy();
    expect(screen.getByText("الخطوة الأخيرة")).toBeTruthy();

    rerender(<StorePreview {...props} config={{ ...TECH_PRESET, products: [product] }} mode="preview" />);
    expect(container.querySelector('[data-elegant-checkout="true"]')).toBeNull();
    expect(container.querySelector(".elegant-checkout__progress")).toBeNull();
    expect(screen.queryByText("الخطوة الأخيرة")).toBeNull();
  });

  it("submits bank transfer once and renders the server receipt instead of browser totals", async () => {
    let resolveOrder!: (value: OrderReceipt) => void;
    const pending = new Promise<OrderReceipt>((resolve) => { resolveOrder = resolve; });
    const submitOrder = vi.fn().mockReturnValue(pending);
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} mode="live" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.click(screen.getByText("الدفع عبر المحافظ الإلكترونية"));
    await user.type(screen.getByPlaceholderText(/رقم مرجع التحويل/), "TRX-94281");
    const submit = screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][0].payment).toEqual({ method: "bank_transfer", reference: "TRX-94281" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    resolveOrder(receipt);
    expect(await screen.findByText("EO-SERVER-001")).toBeTruthy();
    expect(screen.getByText("عنوان الإيصال المثبت من الخادم")).toBeTruthy();
    const elegantReceipt = document.querySelector(".elegant-checkout__receipt");
    expect(elegantReceipt?.querySelector(".elegant-checkout__success")).toBeTruthy();
    expect(elegantReceipt?.querySelector(".elegant-checkout__invoice")).toBeTruthy();
    expect(elegantReceipt?.querySelector(".elegant-checkout__receipt-total")).toBeTruthy();
    expect(screen.queryByText(/معاينة تصميمية/)).toBeNull();
    expect(screen.getByRole("link", { name: /مشاركة تفاصيل الفاتورة/ }).getAttribute("href")).toContain("967700000000");
    expect(screen.getByText("20.38 YER")).toBeTruthy();
    expect(props.handleCheckout).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("keeps preview checkout non-persistent", async () => {
    const submitOrder = vi.fn();
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} mode="preview" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.type(await screen.findByPlaceholderText(/رقم مرجع التحويل/), "PREVIEW-REF");
    await user.click(screen.getByRole("button", { name: "معاينة إرسال الطلب" }));

    await waitFor(() => expect(screen.getByText(/^PREVIEW-\d+$/)).toBeTruthy());
    expect(screen.getByText("تم استلام طلبك بنجاح")).toBeTruthy();
    expect(screen.getByText(/معاينة تصميمية ولا تنشئ طلبًا فعليًا/)).toBeTruthy();
    expect(screen.queryByText(/🎉/)).toBeNull();
    expect(submitOrder).not.toHaveBeenCalled();
  }, 20_000);

  it("keeps a real wallet named bank-transfer distinct from the bank option", async () => {
    const submitOrder = vi.fn().mockResolvedValue(receipt);
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} config={{
      ...props.config,
      enableEWallets: true,
      customWallets: [{ id: "bank-transfer", name: "Merchant Wallet", accountNumber: "999888777", accountName: "Merchant", active: true }],
    }} mode="live" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.click(screen.getByText("الدفع عبر المحافظ الإلكترونية"));
    await user.type(screen.getByPlaceholderText(/رقم مرجع التحويل/), "WALLET-REF");
    await user.click(screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" }));

    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][0].payment).toEqual({ method: "wallet", channelId: "bank-transfer", reference: "WALLET-REF" });
  }, 20_000);

  it("blocks preview completion below the saved post-discount minimum", async () => {
    const submitOrder = vi.fn();
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} config={{ ...props.config, minOrderAmount: 100 }} mode="preview" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.type(screen.getByPlaceholderText(/رقم مرجع التحويل/), "MINIMUM-REF");
    await user.click(screen.getByRole("button", { name: "معاينة إرسال الطلب" }));

    expect(await screen.findByText(/الطلب أقل من الحد الأدنى المحفوظ/)).toBeTruthy();
    expect(screen.queryByText(/^PREVIEW-\d+$/)).toBeNull();
    expect(submitOrder).not.toHaveBeenCalled();
  }, 20_000);

  it("does not synthesize a payment method when every supported method is disabled", async () => {
    const props = checkoutProps();
    render(<StorePreview {...props} config={{ ...props.config, enableCashOnDelivery: false, enableBankTransfer: false, enableEWallets: false, customWallets: [] }} mode="preview" />);
    expect(await screen.findByText(/لا توجد وسيلة دفع مفعلة/)).toBeTruthy();
    expect(screen.queryByText(/STC Pay|الكريمي|PREVIEW-ACCOUNT/)).toBeNull();
    expect((screen.getByRole("button", { name: "معاينة إرسال الطلب" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows an honest contact empty state without fallback destinations or delivery claims", async () => {
    const props = checkoutProps();
    render(<StorePreview {...props} config={{ ...props.config, phone: "", whatsapp: "", email: "", address: "", workingHours: "" }} externalPage="contact" mode="preview" />);
    expect(await screen.findByText(/لم يضف المتجر وسيلة تواصل/)).toBeTruthy();
    expect(screen.queryByText(/support@store|الرياض - المملكة|أقل من 24|تم استلام رسالتك/)).toBeNull();
  });
});
