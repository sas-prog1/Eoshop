// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product, StoreConfig } from "../types";
import { ELEGANT_PRESET, TECH_PRESET } from "../types";
import StorePreview from "./StorePreview";

afterEach(cleanup);

const published: Product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Published truth product",
  price: 1250,
  description: "Published description from the merchant catalog.",
  category: "Published category",
  imageKeyword: "published",
  status: "published",
};

const draft: Product = {
  ...published,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Hidden draft product",
  category: "Hidden draft category",
  status: "draft",
};

const archived: Product = {
  ...published,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Hidden archived product",
  category: "Hidden archived category",
  status: "archived",
};

function props(config: StoreConfig, externalPage: string) {
  return {
    config,
    cart: [],
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    calculateTotal: vi.fn(),
    isCartDrawerOpen: false,
    setIsCartDrawerOpen: vi.fn(),
    hasOrdered: false,
    handleCheckout: vi.fn(),
    selectedCategory: "الكل",
    setSelectedCategory: vi.fn(),
    externalPage,
    mode: "preview" as const,
  };
}

describe("StorePreview truthful customer surfaces", () => {
  it.each([
    { theme: "elegant", preset: ELEGANT_PRESET },
    { theme: "tech", preset: TECH_PRESET },
  ])("shows only published catalog data across products, detail and About in $theme", async ({ preset }) => {
    const config: StoreConfig = {
      ...preset,
      products: [published, draft, archived],
      phone: "+967700000001",
      aboutTitle: "Server About",
      aboutText: "Server-authored merchant story.",
      aboutVision: "Server-authored vision.",
      address: "Server address",
      workingHours: "09:00-17:00",
    };
    const productsView = render(<StorePreview {...props(config, "products")} />);

    expect(await screen.findByText(preset.themeStyle === "elegant" ? "اكتشف ما يناسب أسلوبك" : "معرض جميع المنتجات المعروضة")).toBeTruthy();
    expect(screen.getByText("Published truth product")).toBeTruthy();
    expect(screen.queryByText("Hidden draft product")).toBeNull();
    expect(screen.queryByText("Hidden archived product")).toBeNull();
    expect(screen.queryByText("Hidden draft category")).toBeNull();
    expect(screen.queryByText("Hidden archived category")).toBeNull();
    expect(screen.queryByText(/دعم العملاء المباشر|أحدث الخيارات|ضمان رسمي|تقييم مشتري/)).toBeNull();

    productsView.unmount();
    const detailView = render(<StorePreview {...props(config, "product")} />);
    expect(await screen.findByText("Published description from the merchant catalog.")).toBeTruthy();
    expect(screen.queryByText(/ضمان رسمي|تقييم مشتري|الأكثر طلباً|شحن فوري/)).toBeNull();
    detailView.unmount();

    render(<StorePreview {...props(config, "about")} />);
    expect(await screen.findByText("Server About")).toBeTruthy();
    expect(screen.getByText("Server-authored merchant story.")).toBeTruthy();
    expect(screen.getByText("Server-authored vision.")).toBeTruthy();
    expect(screen.getAllByText(/Server address/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ضمان رسمي|تقييم مشتري|شحن فوري/)).toBeNull();
  });
});
