// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../../../types";
import ElegantCartDrawer from "./ElegantCartDrawer";

const product: Product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "حقيبة جلدية مختارة",
  price: 12500,
  description: "قطعة من المجموعة المختارة.",
  category: "حقائب",
  imageKeyword: "product",
  status: "published",
  manageStock: true,
  stockQuantity: 2,
  availableQuantity: 2,
};

const themeProps = {
  currency: "YER",
  primaryColor: "#7C2D12",
  primaryForeground: "#FFFFFF",
  pageBackground: "#FDFBF7",
  cardBackground: "#FFFFFF",
  borderColor: "#E7DED4",
  inkColor: "#1C1917",
  mutedInkColor: "#57534E",
  prefersReducedMotion: true,
};

afterEach(cleanup);

describe("ElegantCartDrawer", () => {
  it("presents cart totals and preserves the shared quantity and checkout actions", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    const onCheckout = vi.fn();
    const onClose = vi.fn();

    render(
      <ElegantCartDrawer
        {...themeProps}
        cart={[{ product, quantity: 1 }]}
        totalItems={1}
        subtotal={12500}
        hasOrdered={false}
        dialogRef={React.createRef<HTMLDivElement>()}
        closeButtonRef={React.createRef<HTMLButtonElement>()}
        onClose={onClose}
        onQuantityChange={onQuantityChange}
        onCheckout={onCheckout}
      />,
    );

    expect(screen.getByRole("dialog", { name: "سلة التسوق" })).toBeTruthy();
    expect(screen.getByText(product.name)).toBeTruthy();
    expect(screen.getAllByText(/12500/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: `زيادة كمية ${product.name}` }));
    expect(onQuantityChange).toHaveBeenCalledWith(product.id, 1);

    await user.click(screen.getByRole("button", { name: `تقليل كمية ${product.name}` }));
    expect(onQuantityChange).toHaveBeenCalledWith(product.id, -1);

    await user.click(screen.getByRole("button", { name: "إتمام الطلب وتعبئة البيانات" }));
    expect(onCheckout).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole("button", { name: "إغلاق سلة التسوق" })[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks quantity growth at the server-owned inventory limit", () => {
    render(
      <ElegantCartDrawer
        {...themeProps}
        cart={[{ product, quantity: 2 }]}
        totalItems={2}
        subtotal={25000}
        hasOrdered={false}
        dialogRef={React.createRef<HTMLDivElement>()}
        closeButtonRef={React.createRef<HTMLButtonElement>()}
        onClose={vi.fn()}
        onQuantityChange={vi.fn()}
        onCheckout={vi.fn()}
      />,
    );

    const increase = screen.getByRole("button", { name: `زيادة كمية ${product.name}` }) as HTMLButtonElement;
    expect(increase.disabled).toBe(true);
    expect(increase.title).toBe("وصلت إلى الكمية المتاحة");
  });

  it("shows truthful empty and transmitted states", () => {
    const commonProps = {
      ...themeProps,
      cart: [],
      totalItems: 0,
      subtotal: 0,
      dialogRef: React.createRef<HTMLDivElement>(),
      closeButtonRef: React.createRef<HTMLButtonElement>(),
      onClose: vi.fn(),
      onQuantityChange: vi.fn(),
      onCheckout: vi.fn(),
    };
    const { rerender } = render(<ElegantCartDrawer {...commonProps} hasOrdered={false} />);

    expect(screen.getByRole("heading", { name: "لم تضف أي منتج بعد." })).toBeTruthy();
    expect(screen.queryByText(/وهمي|محاكاة/)).toBeNull();

    rerender(<ElegantCartDrawer {...commonProps} hasOrdered />);
    expect(screen.getByRole("heading", { name: "وصل طلبك إلى المتجر بنجاح." })).toBeTruthy();
    expect(screen.queryByText(/وهمي|محاكاة/)).toBeNull();
  });
});
