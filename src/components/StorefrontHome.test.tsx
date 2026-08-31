// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import StorefrontHome from "./StorefrontHome";

afterEach(cleanup);

describe("StorefrontHome", () => {
  it("renders the server-owned order exactly and hides disabled sections", () => {
    const onSelectCategory = vi.fn();
    const config = {
      ...ELEGANT_PRESET,
      products: [{ ...ELEGANT_PRESET.products[0], status: "published" as const }],
      homeSections: [
        { id: "featured_products" as const, visible: true },
        { id: "hero" as const, visible: false },
        { id: "categories" as const, visible: true },
        { id: "trust" as const, visible: true },
        { id: "about" as const, visible: true },
      ],
      phone: "",
      whatsapp: "",
      email: "",
      workingHours: "",
      enableCashOnDelivery: false,
      enableBankTransfer: false,
      enableEWallets: false,
      shippingFee: undefined,
      freeShippingThreshold: undefined,
    };
    const view = render(<StorefrontHome config={config} isElegant primaryColor="#112233" secondaryColor="#334455" onOpenProducts={vi.fn()} onOpenAbout={vi.fn()} onSelectCategory={onSelectCategory} onOpenProduct={vi.fn()} onAddProduct={vi.fn()} onOpenMarketingTarget={vi.fn()} />);

    expect(Array.from(view.container.querySelectorAll("[data-storefront-section]")).map((node) => node.getAttribute("data-storefront-section"))).toEqual([
      "featured_products", "categories", "trust", "about",
    ]);
    expect(view.container.querySelector('[data-storefront-section="hero"]')).toBeNull();
    expect(screen.queryByText(/ضمان رسمي|تقييم مشتري|شحن فوري/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: config.products[0].category }));
    expect(onSelectCategory).toHaveBeenCalledWith(config.products[0].category);
  });

  it("shows truthful empty states without inventing catalog or service claims", () => {
    render(<StorefrontHome config={{ ...ELEGANT_PRESET, products: [], phone: "", whatsapp: "", email: "", workingHours: "", enableCashOnDelivery: false, enableBankTransfer: false, enableEWallets: false, shippingFee: undefined, freeShippingThreshold: undefined }} isElegant={false} primaryColor="#112233" secondaryColor="#334455" onOpenProducts={vi.fn()} onOpenAbout={vi.fn()} onSelectCategory={vi.fn()} onOpenProduct={vi.fn()} onAddProduct={vi.fn()} onOpenMarketingTarget={vi.fn()} />);
    expect(screen.getByText("لم يضف المتجر معلومات الخدمة بعد")).toBeTruthy();
    expect(screen.getByText("لا توجد تصنيفات منشورة بعد.")).toBeTruthy();
    expect(screen.getByText("لم ينشر المتجر منتجات بعد.")).toBeTruthy();
  });

  it.each([
    { isElegant: true, label: "elegant" },
    { isElegant: false, label: "tech" },
  ])("keeps the hero readable and applies its saved height in $label", ({ isElegant }) => {
    const heroConfig = {
      ...ELEGANT_PRESET,
      showHeroBanner: false,
      heroBannerImage: "https://cdn.example.test/hero.jpg",
      heroBannerTitle: "Readable hero",
      heroBannerHeight: "large" as const,
    };
    const props = {
      config: heroConfig,
      isElegant,
      primaryColor: "#112233",
      secondaryColor: "#334455",
      onOpenProducts: vi.fn(),
      onOpenAbout: vi.fn(),
      onSelectCategory: vi.fn(),
      onOpenProduct: vi.fn(),
      onAddProduct: vi.fn(),
      onOpenMarketingTarget: vi.fn(),
    };
    const view = render(<StorefrontHome {...props} />);

    expect(view.container.querySelector('img[src="https://cdn.example.test/hero.jpg"]')).toBeNull();
    expect(view.container.querySelector("[data-storefront-hero]")?.getAttribute("data-storefront-hero-height")).toBe("large");
    expect(screen.getByRole("heading", { name: "Readable hero" }).style.color).not.toBe("");

    view.rerender(<StorefrontHome {...props} config={{ ...heroConfig, showHeroBanner: true, heroBannerOverlayOpacity: 0 }} />);
    const image = view.container.querySelector('img[src="https://cdn.example.test/hero.jpg"]');
    expect(image).not.toBeNull();
    expect(image?.getAttribute("loading")).toBe("eager");
    expect(image?.getAttribute("decoding")).toBe("async");
    expect(image?.getAttribute("fetchpriority")).toBe("high");
    expect(screen.getByRole("heading", { name: "Readable hero" }).style.color).toBe("rgb(255, 255, 255)");
    expect(screen.getByRole("heading", { name: "Readable hero" }).style.textShadow).not.toBe("");
  });

  it("renders server-owned editorial stories and image-only editor picks for Elegant", () => {
    const onOpenMarketingTarget = vi.fn();
    render(
      <StorefrontHome
        config={{
          ...ELEGANT_PRESET,
          marketingBlocks: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              placement: "editorial_story",
              position: 1,
              enabled: true,
              contentType: "category",
              title: "إشراقة طبيعية",
              ctaLabel: "تسوق القصة",
              imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000011",
              altText: "صورة قصة موسمية",
              targetType: "category",
              targetValue: "العطور",
              disclosure: "none",
            },
            {
              id: "00000000-0000-4000-8000-000000000002",
              placement: "discovery",
              position: 1,
              enabled: true,
              contentType: "product",
              title: "مختارات العطور",
              ctaLabel: "افتح المختار",
              imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000012",
              altText: "صورة مختارات العطور",
              targetType: "products",
              disclosure: "none",
            },
          ],
        }}
        isElegant
        primaryColor="#7a2e2e"
        secondaryColor="#171717"
        onOpenProducts={vi.fn()}
        onOpenAbout={vi.fn()}
        onSelectCategory={vi.fn()}
        onOpenProduct={vi.fn()}
        onAddProduct={vi.fn()}
        onOpenMarketingTarget={onOpenMarketingTarget}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "تسوق القصة" }));
    expect(onOpenMarketingTarget).toHaveBeenCalledWith("category", "العطور");
    expect(screen.getByRole("heading", { name: "مختارات المحرر" })).toBeTruthy();
    const discovery = document.querySelector("[data-elegant-discovery]");
    expect(discovery?.textContent).not.toMatch(/YER|ر\.س/);
    expect(discovery?.querySelector('button[aria-label*="إضافة"]')).toBeNull();
  });
});
