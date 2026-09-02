import React, { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import StorePreview from "../../components/StorePreview";
import type { Product, StoreConfig } from "../../types";
import { addProductToCart, changeCartLineQuantity } from "../../workflows/orderState";

interface OnboardingStorePreviewProps {
  config: StoreConfig;
  compact?: boolean;
}

export default function OnboardingStorePreview({ config, compact = false }: OnboardingStorePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    expandButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      expandButtonRef.current?.focus();
    };
  }, [expanded]);

  const addToCart = (product: Product, quantity = 1) => {
    const mutation = addProductToCart(cart, product, quantity);
    setCart((current) => addProductToCart(current, product, quantity).items);
    if (mutation.acceptedQuantity > 0) setDrawerOpen(true);
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((current) => changeCartLineQuantity(current, productId, amount).items);
  };

  return (
    <div
      className={`overflow-hidden border border-slate-200 bg-slate-950 shadow-xl ${expanded ? "fixed inset-0 z-[100] rounded-none" : "rounded-3xl"}`}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? "true" : undefined}
      aria-label={expanded ? "معاينة كاملة للمتجر" : undefined}
      data-testid="onboarding-store-preview"
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-black">معاينة حقيقية للمتجر</p>
          <p className="mt-0.5 text-[10px] text-slate-400">المعاينة تجريبية ولا تنشئ طلبات فعلية</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-white/10 p-1" aria-label="حجم معاينة المتجر">
            <button type="button" aria-label="معاينة سطح المكتب" onClick={() => setDevice("desktop")} className={`rounded-lg p-2 ${device === "desktop" ? "bg-white text-slate-950" : "text-slate-300"}`}><Monitor className="h-4 w-4" /></button>
            <button type="button" aria-label="معاينة الجوال" onClick={() => setDevice("mobile")} className={`rounded-lg p-2 ${device === "mobile" ? "bg-white text-slate-950" : "text-slate-300"}`}><Smartphone className="h-4 w-4" /></button>
          </div>
          <button
            ref={expandButtonRef}
            type="button"
            aria-label={expanded ? "إغلاق المعاينة الكاملة" : "فتح المعاينة الكاملة"}
            onClick={() => setExpanded((current) => !current)}
            className="rounded-xl bg-white/10 p-2.5 text-slate-200 transition hover:bg-white hover:text-slate-950"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className={`flex items-start justify-center overflow-auto bg-slate-200 p-3 ${expanded ? "h-[calc(100dvh-4.5rem)]" : compact ? "h-[520px]" : "h-[680px]"}`}>
        <div className={`overflow-hidden bg-white shadow-2xl transition-all ${device === "mobile" ? "h-[640px] w-[360px] shrink-0 rounded-[2.5rem] border-[9px] border-slate-950" : "min-h-full w-full rounded-2xl"}`}>
          <StorePreview
            config={config}
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            calculateTotal={() => undefined}
            isCartDrawerOpen={drawerOpen}
            setIsCartDrawerOpen={setDrawerOpen}
            hasOrdered={false}
            handleCheckout={() => undefined}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            previewDevice={device}
            mode="preview"
          />
        </div>
      </div>
    </div>
  );
}
