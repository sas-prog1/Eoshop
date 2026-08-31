// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import StorefrontProductDetail from "./StorefrontProductDetail";

afterEach(cleanup);

const product = {
  ...ELEGANT_PRESET.products[0],
  id: "11111111-1111-4111-8111-111111111111",
  name: "عطر تحريري للاختبار",
  description: "وصف التاجر الحقيقي للمنتج المختار.",
  status: "published" as const,
  manageStock: true,
  stockQuantity: 3,
  availableQuantity: 3,
};

describe("Elegant storefront product detail", () => {
  it("uses the editorial detail layout while preserving quantity and cart behavior", async () => {
    const onAdd = vi.fn();
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(
      <StorefrontProductDetail
        product={product}
        config={{ ...ELEGANT_PRESET, products: [product], enableCashOnDelivery: true, freeShippingThreshold: 250 }}
        primaryColor="#7C3F2D"
        secondaryColor="#1C1917"
        onBack={onBack}
        onAdd={onAdd}
      />,
    );

    expect(screen.getByRole("heading", { name: product.name })).toBeTruthy();
    expect(screen.getByText(product.description)).toBeTruthy();
    expect(screen.getByText("المتاح للإضافة: 3")).toBeTruthy();
    expect(screen.getByText(/شحن مجاني ابتداءً من 250/)).toBeTruthy();
    expect(screen.getByText("الدفع عند الاستلام متاح")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "زيادة الكمية" }));
    await user.click(screen.getByRole("button", { name: "إضافة إلى السلة" }));
    expect(onAdd).toHaveBeenCalledWith(product, 2);

    await user.click(screen.getByRole("button", { name: "العودة إلى المجموعة" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("prevents adding a server-reported out-of-stock product", () => {
    render(
      <StorefrontProductDetail
        product={{ ...product, stockQuantity: 0, availableQuantity: 0 }}
        config={{ ...ELEGANT_PRESET, products: [] }}
        primaryColor="#7C3F2D"
        secondaryColor="#1C1917"
        onBack={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("غير متوفر حاليًا")).toBeTruthy();
    expect((screen.getByRole("button", { name: "إضافة إلى السلة" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
