// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../../../types";
import ElegantCatalog from "./ElegantCatalog";

afterEach(cleanup);

const products = ELEGANT_PRESET.products.slice(0, 2).map((product) => ({
  ...product,
  status: "published" as const,
}));

function renderCatalog(overrides: Partial<React.ComponentProps<typeof ElegantCatalog>> = {}) {
  const props: React.ComponentProps<typeof ElegantCatalog> = {
    products,
    categories: ["الكل", ...new Set(products.map((product) => product.category))],
    selectedCategory: "الكل",
    searchQuery: "",
    currency: "ر.س",
    primaryColor: "#7C3F2D",
    secondaryColor: "#1C1917",
    textColor: "#57534E",
    backgroundColor: "#FDFBF7",
    cardBackground: "#FFFFFF",
    borderColor: "#E7E0D8",
    onSearchChange: vi.fn(),
    onSelectCategory: vi.fn(),
    onReset: vi.fn(),
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };

  return { props, user: userEvent.setup(), ...render(<ElegantCatalog {...props} />) };
}

describe("ElegantCatalog", () => {
  it("renders the server-owned catalog and forwards search, category and product actions", async () => {
    const { props, user } = renderCatalog();

    expect(screen.getByRole("heading", { name: "اكتشف ما يناسب أسلوبك" })).toBeTruthy();
    expect(screen.getByText(products[0].name)).toBeTruthy();
    expect(screen.getByText(products[1].name)).toBeTruthy();

    await user.type(screen.getByRole("searchbox", { name: "البحث في كتالوج المنتجات" }), "عطر");
    expect(props.onSearchChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: products[0].category }));
    expect(props.onSelectCategory).toHaveBeenCalledWith(products[0].category);

    await user.click(screen.getByRole("button", { name: `فتح تفاصيل ${products[0].name}` }));
    expect(props.onOpen).toHaveBeenCalledWith(products[0]);

    await user.click(screen.getByRole("button", { name: `إضافة ${products[0].name} إلى السلة` }));
    expect(props.onAdd).toHaveBeenCalledWith(products[0]);
  });

  it("offers a clear recovery action when filtering returns no products", async () => {
    const onReset = vi.fn();
    const { user } = renderCatalog({ products: [], searchQuery: "غير موجود", onReset });

    expect(screen.getByRole("status").textContent).toContain("لم نجد ما يطابق بحثك");
    await user.click(screen.getByRole("button", { name: "إعادة ضبط الخيارات" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
