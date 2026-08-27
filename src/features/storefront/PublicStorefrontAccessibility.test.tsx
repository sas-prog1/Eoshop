// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StorePreview from "../../components/StorePreview";
import { ELEGANT_PRESET } from "../../types";
import { contrastRatio } from "../../utils/readableForeground";
import PublicStorefrontScreen from "./PublicStorefrontScreen";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const product = {
  ...ELEGANT_PRESET.products[0],
  id: "11111111-1111-4111-8111-111111111111",
  name: "منتج اختبار الوصول",
  status: "published" as const,
};

const config = {
  ...ELEGANT_PRESET,
  storeName: "متجر اختبار الوصول",
  products: [product],
  enableCashOnDelivery: true,
};

const publicProps = {
  storefront: null,
  error: null,
  loading: false,
  cart: [],
  addToCart: vi.fn(),
  updateQuantity: vi.fn(),
  isCartDrawerOpen: false,
  setIsCartDrawerOpen: vi.fn(),
  hasOrdered: false,
  handleCheckout: vi.fn(),
  selectedCategory: "الكل",
  setSelectedCategory: vi.fn(),
  submitOrder: vi.fn(),
  retry: vi.fn(),
};

function computedColorAsHex(element: Element): string {
  const channels = getComputedStyle(element).color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function computedBackgroundAsHex(element: Element): string {
  const channels = getComputedStyle(element).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function CartHarness() {
  const [open, setOpen] = useState(false);
  return (
    <StorePreview
      config={config}
      cart={[{ product, quantity: 1 }]}
      addToCart={vi.fn()}
      updateQuantity={vi.fn()}
      calculateTotal={vi.fn()}
      isCartDrawerOpen={open}
      setIsCartDrawerOpen={setOpen}
      hasOrdered={false}
      handleCheckout={vi.fn()}
      selectedCategory="الكل"
      setSelectedCategory={vi.fn()}
      mode="live"
    />
  );
}

describe("public storefront acceptance boundary", () => {
  it("never renders a blank terminal state and exposes retry as an alert", () => {
    render(<PublicStorefrontScreen {...publicProps} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("لم تكتمل استجابة المتجر");
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });

  it("provides a skip link and a focusable main region for the loaded store", () => {
    render(<PublicStorefrontScreen {...publicProps} storefront={{ workspaceRevision: 1, catalogRevision: 1, config }} />);

    expect(screen.getByRole("link", { name: "تخطي إلى محتوى المتجر" }).getAttribute("href")).toBe("#public-storefront-content");
    const main = screen.getByRole("main");
    expect(main.id).toBe("public-storefront-content");
    expect(main.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(main);
  });

  it("traps cart focus, restores it on dismissal, and moves it into checkout on continuation", async () => {
    const user = userEvent.setup();
    render(<CartHarness />);

    const trigger = screen.getAllByRole("button", { name: /فتح سلة التسوق/ })[0];
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /سلة التسوق/ });
    const background = document.querySelector<HTMLElement>("[data-storefront-background]");
    expect(background?.hasAttribute("inert")).toBe(true);
    expect(background?.getAttribute("aria-hidden")).toBe("true");
    expect(dialog.className).toContain("h-[100dvh]");
    const closeButton = within(dialog).getByRole("button", { name: "إغلاق سلة التسوق" });
    expect(document.activeElement).toBe(closeButton);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: /إتمام الطلب وتعبئة البيانات/ }));

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: /سلة التسوق/ })).toBeTruthy();
    expect(background?.hasAttribute("inert")).toBe(true);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    await user.click(trigger);
    const reopenedDialog = screen.getByRole("dialog", { name: /سلة التسوق/ });
    await user.click(within(reopenedDialog).getByRole("button", { name: /إتمام الطلب وتعبئة البيانات/ }));
    expect(screen.getByRole("dialog", { name: /سلة التسوق/ })).toBeTruthy();
    expect(background?.hasAttribute("inert")).toBe(true);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: /إتمام الطلب/ }));
    });
  });

  it.each([
    { textColor: "#FFFFFF", bgColor: "#FFFFFF", secondaryColor: "#F5F5F5" },
    { textColor: "#777777", bgColor: "#808080", secondaryColor: "#888888" },
    { textColor: "#FFFFFF", bgColor: "#000000", secondaryColor: "#FFFFFF" },
  ])("corrects conflicting merchant colors in the rendered storefront", ({ textColor, bgColor, secondaryColor }) => {
    render(
      <StorePreview
        config={{
          ...config,
          textColor,
          bgColor,
          secondaryColor,
          showHeroBanner: false,
        }}
        cart={[]}
        addToCart={vi.fn()}
        updateQuantity={vi.fn()}
        calculateTotal={vi.fn()}
        isCartDrawerOpen={false}
        setIsCartDrawerOpen={vi.fn()}
        hasOrdered={false}
        handleCheckout={vi.fn()}
        selectedCategory="الكل"
        setSelectedCategory={vi.fn()}
        mode="live"
      />,
    );

    const storefront = document.getElementById("store-preview-scroll-container");
    const heroHeading = screen.getByRole("heading", { name: config.heroBannerTitle?.trim() || config.storeName });
    const aboutHeading = document.querySelector<HTMLElement>("[data-storefront-about-heading]");
    expect(contrastRatio(computedColorAsHex(storefront!), bgColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(computedColorAsHex(heroHeading), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(computedColorAsHex(aboutHeading!), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("uses surface-specific contrast for cart, navigation, products and categories", () => {
    render(
      <StorePreview
        config={{
          ...config,
          primaryColor: "#FFFFFF",
          secondaryColor: "#FFFFFF",
          textColor: "#FFFFFF",
          bgColor: "#000000",
          cardBgColor: "#FFFFFF",
        }}
        cart={[{ product, quantity: 1 }]}
        addToCart={vi.fn()}
        updateQuantity={vi.fn()}
        calculateTotal={vi.fn()}
        isCartDrawerOpen={false}
        setIsCartDrawerOpen={vi.fn()}
        hasOrdered={false}
        handleCheckout={vi.fn()}
        selectedCategory="الكل"
        setSelectedCategory={vi.fn()}
        externalPage="products"
        mode="live"
      />,
    );

    const cartCount = document.querySelector<HTMLElement>("[data-storefront-cart-count]");
    const inactiveNavigation = document.querySelector<HTMLElement>('[data-storefront-nav="about"]');
    const productsHeading = document.querySelector<HTMLElement>("[data-storefront-products-heading]");
    const unselectedCategory = Array.from(document.querySelectorAll<HTMLElement>("[data-storefront-category]"))
      .find((element) => element.dataset.storefrontCategory === product.category);
    expect(contrastRatio(computedColorAsHex(cartCount!), computedBackgroundAsHex(cartCount!))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(computedColorAsHex(inactiveNavigation!), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(computedColorAsHex(productsHeading!), "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(computedColorAsHex(unselectedCategory!), "#f5efe6")).toBeGreaterThanOrEqual(4.5);
  });

  it("exposes semantic store navigation and a keyboard-operable brand action", () => {
    render(<CartHarness />);

    expect(screen.getAllByRole("button", { name: /العودة إلى الصفحة الرئيسية لمتجر/ }).length).toBeGreaterThan(0);
    const currentItems = screen.getAllByRole("button", { name: "الرئيسية" });
    expect(currentItems.some((item) => item.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("uses radio semantics for payment and focuses the first missing checkout field", async () => {
    const user = userEvent.setup();
    render(
      <StorePreview
        config={{
          ...config,
          enableEWallets: true,
          customWallets: [{ id: "wallet-a", name: "محفظة اختبار", accountNumber: "777000111", accountName: "متجر الاختبار", active: true }],
        }}
        cart={[{ product, quantity: 1 }]}
        addToCart={vi.fn()}
        updateQuantity={vi.fn()}
        calculateTotal={vi.fn()}
        isCartDrawerOpen={false}
        setIsCartDrawerOpen={vi.fn()}
        hasOrdered={false}
        handleCheckout={vi.fn()}
        selectedCategory="الكل"
        setSelectedCategory={vi.fn()}
        externalPage="checkout"
        mode="live"
        submitOrder={vi.fn()}
      />,
    );

    const cashRadio = await screen.findByRole("radio", { name: /الدفع عند التوصيل/ });
    cashRadio.focus();
    await user.keyboard("{ArrowRight}");
    const walletRadio = screen.getByRole("radio", { name: /الدفع عبر المحافظ/ });
    expect(document.activeElement).toBe(walletRadio);
    expect(walletRadio.getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(cashRadio);

    const submit = screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" });
    await user.click(submit);

    expect(screen.getByRole("alert").textContent).toContain("يرجى تعبئة كافة الحقول المطلوبة");
    const name = screen.getByLabelText(/الاسم الكامل الثلاثي/);
    const phone = screen.getByLabelText(/رقم الجوال/);
    const address = screen.getByLabelText(/عنوان التسليم التفصيلي/);
    expect(document.activeElement).toBe(name);

    await user.type(name, "عميل اختبار");
    await user.click(submit);
    expect(document.activeElement).toBe(phone);

    await user.type(phone, "770000001");
    await user.click(submit);
    expect(document.activeElement).toBe(address);
  });

  it("preserves customer input after a server failure and announces the retryable error", async () => {
    const user = userEvent.setup();
    const submitOrder = vi.fn().mockRejectedValue(new Error("تعذر تثبيت الطلب مؤقتًا"));
    render(
      <StorePreview
        config={config}
        cart={[{ product, quantity: 1 }]}
        addToCart={vi.fn()}
        updateQuantity={vi.fn()}
        calculateTotal={vi.fn()}
        isCartDrawerOpen={false}
        setIsCartDrawerOpen={vi.fn()}
        hasOrdered={false}
        handleCheckout={vi.fn()}
        selectedCategory="الكل"
        setSelectedCategory={vi.fn()}
        externalPage="checkout"
        mode="live"
        submitOrder={submitOrder}
      />,
    );

    const name = await screen.findByLabelText(/الاسم الكامل الثلاثي/);
    const phone = screen.getByLabelText(/رقم الجوال/);
    const address = screen.getByLabelText(/عنوان التسليم التفصيلي/);
    await user.type(name, "عميل اختبار");
    await user.type(phone, "770000001");
    await user.type(address, "صنعاء - شارع الاختبار");
    await user.click(screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر تثبيت الطلب مؤقتًا");
    expect(document.activeElement).toBe(alert);
    expect((name as HTMLInputElement).value).toBe("عميل اختبار");
    expect((phone as HTMLInputElement).value).toBe("770000001");
    expect((address as HTMLInputElement).value).toBe("صنعاء - شارع الاختبار");
  }, 10_000);
});
