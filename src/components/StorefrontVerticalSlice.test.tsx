// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderReceipt } from "../adapters/uiAdapters";
import { ELEGANT_PRESET, type Product, type StoreConfig } from "../types";
import { addProductToCart, changeCartLineQuantity, type CartLine } from "../workflows/orderState";
import StorePreview from "./StorePreview";

const product: Product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "منتج الرحلة الخادمية",
  price: 10,
  description: "وصف منتج منشور لاختبار الرحلة الكاملة.",
  category: "اختبار",
  imageKeyword: "product",
  status: "published",
  manageStock: true,
  stockQuantity: 2,
  availableQuantity: 2,
};

const config: StoreConfig = {
  ...ELEGANT_PRESET,
  products: [product],
  currency: "YER",
  enableCashOnDelivery: true,
  cashOnDeliveryFee: 0,
  enableBankTransfer: false,
  enableEWallets: false,
  requireEmail: false,
  requireAddressDetails: true,
};

const receipt: OrderReceipt = {
  id: "22222222-2222-4222-8222-222222222222",
  number: "EO-T2-001",
  status: "submitted",
  paymentState: "due_on_delivery",
  currencyCode: "YER",
  totals: {
    itemsSubtotalMinor: 1250,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    paymentFeeMinor: 0,
    grandTotalMinor: 1250,
  },
  items: [{
    productId: product.id,
    name: product.name,
    sku: "SERVER-T2",
    unitPriceMinor: 1250,
    quantity: 1,
    lineTotalMinor: 1250,
    tracked: true,
  }],
  createdAt: "2026-08-29T12:00:00Z",
  checkoutPresentation: {
    title: "تم تثبيت الطلب من الخادم",
    message: "استلم الخادم الطلب وحجز المخزون.",
    whatsappTarget: null,
  },
};

afterEach(cleanup);

function VerticalSlice({ submitOrder }: { submitOrder: (input: any) => Promise<OrderReceipt> }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  return (
    <StorePreview
      config={config}
      cart={cart}
      addToCart={(selected, quantity = 1) => setCart((current) => addProductToCart(current, selected, quantity).items)}
      updateQuantity={(productId, amount) => setCart((current) => changeCartLineQuantity(current, productId, amount).items)}
      calculateTotal={() => undefined}
      isCartDrawerOpen={drawerOpen}
      setIsCartDrawerOpen={setDrawerOpen}
      hasOrdered={false}
      handleCheckout={() => undefined}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      mode="live"
      submitOrder={submitOrder}
    />
  );
}

describe("public storefront functional vertical slice", () => {
  it("completes home to product to cart to a server-owned order receipt", async () => {
    const submitOrder = vi.fn().mockResolvedValue(receipt);
    const user = userEvent.setup();
    render(<VerticalSlice submitOrder={submitOrder} />);

    await user.click(screen.getByRole("button", { name: `فتح تفاصيل ${product.name}` }));
    expect(screen.getByRole("heading", { level: 1, name: product.name })).toBeTruthy();
    expect(screen.getByText("المتاح للإضافة: 2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "إضافة إلى السلة" }));
    await user.click(screen.getAllByRole("button", { name: /فتح سلة التسوق، 1 منتج/ })[0]);
    expect(await screen.findByRole("dialog", { name: /سلة التسوق/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /إتمام الطلب وتعبئة البيانات/ }));

    await user.type(screen.getByPlaceholderText(/عبدالله محمد/), "عميل T2");
    await user.type(screen.getByPlaceholderText(/0500000000/), "+967700000009");
    await user.type(screen.getByPlaceholderText(/اسم الشارع/), "عنوان محلي غير حساس");
    fireEvent.click(screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" }));

    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1), { timeout: 5_000 });
    expect(submitOrder.mock.calls[0][0]).toMatchObject({
      lines: [{ productId: product.id, quantity: 1 }],
      payment: { method: "cod" },
    });
    expect(await screen.findByText("EO-T2-001")).toBeTruthy();
    expect(screen.getByText("تم تثبيت الطلب من الخادم")).toBeTruthy();

    const receiptProductHeading = screen.getByRole("heading", { level: 5, name: product.name });
    const receiptProductRow = receiptProductHeading.parentElement?.parentElement?.parentElement;
    expect(receiptProductRow).not.toBeNull();
    const receiptProductTotal = receiptProductRow?.lastElementChild;
    expect(receiptProductTotal).not.toBeNull();
    expect(receiptProductTotal?.textContent?.trim()).toBe(`${(receipt.items[0].lineTotalMinor / 100).toLocaleString()} ${receipt.currencyCode}`);

    const expectedReceiptTotal = `${receipt.totals.itemsSubtotalMinor / 100} ${receipt.currencyCode}`;

    const subtotalRow = screen.getByText("المجموع الفرعي:").parentElement;
    expect(subtotalRow).not.toBeNull();
    expect(within(subtotalRow as HTMLElement).getByText(expectedReceiptTotal)).toBeTruthy();

    const totalRow = screen.getByText("الإجمالي النهائي المستحق:").parentElement;
    expect(totalRow).not.toBeNull();
    expect(within(totalRow as HTMLElement).getByText(expectedReceiptTotal)).toBeTruthy();
  }, 30_000);

  it("shows a clear unavailable state when the selected product disappears", async () => {
    const user = userEvent.setup();
    const props = {
      config,
      cart: [] as CartLine[],
      addToCart: vi.fn(),
      updateQuantity: vi.fn(),
      calculateTotal: vi.fn(),
      isCartDrawerOpen: false,
      setIsCartDrawerOpen: vi.fn(),
      hasOrdered: false,
      handleCheckout: vi.fn(),
      selectedCategory: "الكل",
      setSelectedCategory: vi.fn(),
      mode: "live" as const,
    };
    const { rerender } = render(<StorePreview {...props} />);

    await user.click(screen.getByRole("button", { name: `فتح تفاصيل ${product.name}` }));
    rerender(<StorePreview {...props} config={{ ...config, products: [] }} />);

    expect(await screen.findByRole("heading", { name: "المنتج غير متاح" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: product.name })).toBeNull();
  });
});
