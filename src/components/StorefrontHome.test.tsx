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
    expect(screen.getByText("لم ينشر المتجر معلومات خدمة بعد.")).toBeTruthy();
    expect(screen.getByText("لا توجد تصنيفات منشورة حاليًا.")).toBeTruthy();
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
      heroBannerMobileImage: "https://cdn.example.test/hero-mobile.jpg",
      heroBannerTitle: "Readable hero",
      heroBannerHeight: "large" as const,
      heroBannerFocalPointX: 72,
      heroBannerFocalPointY: 38,
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
    expect(image?.getAttribute("style")).toContain("object-position: 72% 38%");
    expect(view.container.querySelector('source[media="(max-width: 767px)"]')?.getAttribute("srcset")).toBe("https://cdn.example.test/hero-mobile.jpg");
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

  it("routes the Elegant intro CTA through its saved hero target", () => {
    const onOpenMarketingTarget = vi.fn();
    render(
      <StorefrontHome
        config={{
          ...ELEGANT_PRESET,
          heroBannerButtonText: "تسوق العطور",
          heroBannerTargetType: "category",
          heroBannerTargetValue: "عطور",
          marketingBlocks: [{
            id: "00000000-0000-4000-8000-000000000001",
            placement: "editorial_story",
            position: 1,
            enabled: true,
            contentType: "category",
            title: "قصة العطور",
            ctaLabel: "افتح القصة",
            imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000011",
            altText: "قصة عطور",
            targetType: "products",
            disclosure: "none",
          }],
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

    fireEvent.click(screen.getByRole("button", { name: "تسوق العطور" }));
    expect(onOpenMarketingTarget).toHaveBeenCalledWith("category", "عطور");
  });

  it("renders the server-owned Tech Bento projection without consuming Elegant stories", () => {
    const onOpenMarketingTarget = vi.fn();
    const onSelectCategory = vi.fn();
    const marketingBlocks = [
      {
        id: "00000000-0000-4000-8000-000000000101",
        placement: "hero_bento" as const,
        position: 1,
        enabled: true,
        contentType: "category" as const,
        title: "إلكترونيات ذكية",
        ctaLabel: "افتح القسم",
        imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000201",
        altText: "أجهزة إلكترونية",
        targetType: "category" as const,
        targetValue: "إلكترونيات",
        disclosure: "none" as const,
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        placement: "side_ad" as const,
        position: 1,
        enabled: true,
        contentType: "campaign" as const,
        title: "حملة الألعاب",
        ctaLabel: "اكتشف العرض",
        imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000202",
        altText: "وحدة ألعاب",
        targetType: "external" as const,
        targetValue: "https://example.test/gaming",
        disclosure: "ad" as const,
        sponsorName: "بيت الألعاب",
      },
      {
        id: "00000000-0000-4000-8000-000000000103",
        placement: "discovery" as const,
        position: 1,
        enabled: true,
        contentType: "product" as const,
        title: "سماعات",
        ctaLabel: "افتح المختار",
        imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000203",
        altText: "سماعات تقنية",
        targetType: "products" as const,
        disclosure: "none" as const,
      },
      {
        id: "00000000-0000-4000-8000-000000000104",
        placement: "editorial_story" as const,
        position: 1,
        enabled: true,
        contentType: "category" as const,
        title: "قصة Elegant فقط",
        ctaLabel: "اقرأ القصة",
        imageUrl: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000204",
        altText: "قصة تحريرية",
        targetType: "products" as const,
        disclosure: "none" as const,
      },
    ];

    const view = render(
      <StorefrontHome
        config={{
          ...ELEGANT_PRESET,
          themeStyle: "tech",
          marketingBlocks,
          products: [
            { ...ELEGANT_PRESET.products[0], status: "published", category: "إلكترونيات" },
            { ...ELEGANT_PRESET.products[1], status: "draft", category: "مسودة مخفية" },
          ],
        }}
        isElegant={false}
        primaryColor="#0969F0"
        secondaryColor="#0F172A"
        onOpenProducts={vi.fn()}
        onOpenAbout={vi.fn()}
        onSelectCategory={onSelectCategory}
        onOpenProduct={vi.fn()}
        onAddProduct={vi.fn()}
        onOpenMarketingTarget={onOpenMarketingTarget}
      />,
    );

    expect(view.container.querySelector("[data-tech-bento-home]")).not.toBeNull();
    expect(screen.getByText("إلكترونيات ذكية")).toBeTruthy();
    expect(screen.getByText("إعلان · بيت الألعاب")).toBeTruthy();
    expect(screen.getByRole("button", { name: "فتح سماعات" })).toBeTruthy();
    expect(screen.queryByText("قصة Elegant فقط")).toBeNull();
    expect(screen.queryByText("مسودة مخفية")).toBeNull();
    expect(view.container.querySelector('[data-storefront-section="categories"]')).toBeNull();
    expect(view.container.querySelector("[data-tech-trust-ticker]")).not.toBeNull();
    expect(screen.getByText("معلومات الطلب")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إلكترونيات" }));
    expect(onSelectCategory).toHaveBeenCalledWith("إلكترونيات");
    fireEvent.click(screen.getByRole("button", { name: "افتح القسم: إلكترونيات ذكية" }));
    expect(onOpenMarketingTarget).toHaveBeenCalledWith("category", "إلكترونيات");
  });
});
