// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import { contrastRatio } from "../utils/readableForeground";
import StorefrontFooter from "./StorefrontFooter";
import StorefrontHome from "./StorefrontHome";
import StorefrontProductCard from "./StorefrontProductCard";
import StorefrontProductDetail from "./StorefrontProductDetail";

afterEach(cleanup);

const pageBackground = "#020617";
const cardBackground = "#0F172A";
const lowContrastText = "#475569";
const product = {
  ...ELEGANT_PRESET.products[0],
  id: "contrast-product",
  name: "منتج التباين",
  description: "وصف المنتج على سطح ديناميكي داكن.",
  category: "تصنيف التباين",
  status: "published" as const,
  manageStock: true,
  stockQuantity: 3,
};

function computedColorAsHex(element: Element): string {
  const channels = getComputedStyle(element).color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function expectReadableOn(element: Element, surface: string) {
  expect(contrastRatio(computedColorAsHex(element), surface)).toBeGreaterThanOrEqual(4.5);
}

describe("storefront text contrast on merchant-defined dark surfaces", () => {
  it("keeps footer copy readable on cardBgColor", () => {
    render(
      <StorefrontFooter
        config={{
          ...ELEGANT_PRESET,
          textColor: lowContrastText,
          slogan: "وصف التذييل على خلفية داكنة",
          phone: "",
          whatsapp: "",
          email: "",
          address: "",
          workingHours: "",
          instagram: "",
          twitter: "",
          tiktok: "",
          snapchat: "",
        }}
        primaryColor={lowContrastText}
        secondaryColor={lowContrastText}
        cardBackground={cardBackground}
        borderColor="#334155"
        attribution="Built on Eoshop"
        onNavigate={vi.fn()}
      />,
    );

    expectReadableOn(screen.getByText("وصف التذييل على خلفية داكنة"), cardBackground);
    expectReadableOn(screen.getByRole("button", { name: "الرئيسية" }).parentElement!, cardBackground);
    expectReadableOn(screen.getByText("لا توجد حسابات اجتماعية منشورة."), cardBackground);
    expectReadableOn(screen.getByText("Built on Eoshop"), cardBackground);
  });

  it("keeps product-card helper copy readable on cardBgColor", () => {
    render(
      <StorefrontProductCard
        product={product}
        currency="YER"
        primaryColor={lowContrastText}
        secondaryColor={lowContrastText}
        cardBackground={cardBackground}
        borderColor="#334155"
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        showDescription
      />,
    );

    expectReadableOn(screen.getByText(product.description), cardBackground);
    expectReadableOn(screen.getByRole("button", { name: product.name }), cardBackground);
    expectReadableOn(screen.getByText(`${product.price} YER`), cardBackground);
  });

  it("uses the real page and card surfaces for home helper copy", () => {
    render(
      <StorefrontHome
        config={{
          ...ELEGANT_PRESET,
          products: [product],
          textColor: lowContrastText,
          bgColor: pageBackground,
          cardBgColor: cardBackground,
          primaryColor: lowContrastText,
          secondaryColor: lowContrastText,
          aboutText: "نبذة المتجر على سطح البطاقة الداكن.",
          homeSections: [
            { id: "trust" as const, visible: true },
            { id: "categories" as const, visible: true },
            { id: "featured_products" as const, visible: true },
            { id: "about" as const, visible: true },
          ],
        }}
        isElegant
        primaryColor={lowContrastText}
        secondaryColor={lowContrastText}
        onOpenProducts={vi.fn()}
        onOpenAbout={vi.fn()}
        onSelectCategory={vi.fn()}
        onOpenProduct={vi.fn()}
        onAddProduct={vi.fn()}
        onOpenMarketingTarget={vi.fn()}
      />,
    );

    expectReadableOn(screen.getByText("التصنيفات المستخرجة من المنتجات المنشورة."), pageBackground);
    expectReadableOn(screen.getByText("منتجات من كتالوج المتجر الحالي."), pageBackground);
    expectReadableOn(screen.getByText("بيانات منشورة من إعدادات المتجر الحالية."), cardBackground);
    expectReadableOn(screen.getByText("1 منتج منشور").parentElement!, pageBackground);
    expectReadableOn(screen.getByText("نبذة المتجر على سطح البطاقة الداكن."), cardBackground);
  });

  it("keeps product-detail page and card copy readable on their own surfaces", () => {
    render(
      <StorefrontProductDetail
        product={product}
        config={{
          ...ELEGANT_PRESET,
          textColor: lowContrastText,
          bgColor: pageBackground,
          cardBgColor: cardBackground,
          primaryColor: lowContrastText,
          secondaryColor: lowContrastText,
          enableCashOnDelivery: true,
          freeShippingThreshold: 100,
        }}
        primaryColor={lowContrastText}
        secondaryColor={lowContrastText}
        onBack={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expectReadableOn(screen.getByRole("button", { name: "العودة إلى المجموعة" }), pageBackground);
    expectReadableOn(screen.getByText(product.description), pageBackground);
    expectReadableOn(screen.getByText("يثبت الخادم السعر والمخزون النهائيين عند إرسال الطلب."), pageBackground);
    expectReadableOn(screen.getByRole("heading", { name: "الشحن والدفع المنشور" }), cardBackground);
    expectReadableOn(screen.getByText(/شحن مجاني ابتداءً من/), cardBackground);
    expectReadableOn(screen.getByText("الدفع عند الاستلام متاح"), cardBackground);
  });
});
