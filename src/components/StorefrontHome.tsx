import React from "react";
import { Building2, Clock, CreditCard, Grid3X3, Mail, MessageSquare, Phone, ShoppingBag, Truck } from "lucide-react";
import type { Product, StoreConfig, StorefrontSectionId } from "../types";
import type { StorefrontMarketingTargetType } from "../contracts/storefrontMarketingBlocks";
import { storefrontSectionsOrDefault } from "../contracts/storefrontSections";
import { canonicalContactTarget } from "../contracts/checkoutPolicy";
import { readableAccent } from "../utils/readableForeground";
import StorefrontHero from "./StorefrontHero";
import StorefrontProductCard from "./StorefrontProductCard";
import { ElegantStoriesHome, elegantStoriesHomeModel } from "../features/storefront/elegant-stories";

interface Props {
  config: StoreConfig;
  isElegant: boolean;
  primaryColor: string;
  secondaryColor: string;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onSelectCategory: (category: string) => void;
  onOpenProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onOpenMarketingTarget: (targetType: StorefrontMarketingTargetType, targetValue?: string) => void;
}

interface TrustFact {
  key: string;
  label: string;
  icon: typeof Phone;
}

export default function StorefrontHome({
  config,
  isElegant,
  primaryColor,
  secondaryColor,
  onOpenProducts,
  onOpenAbout,
  onSelectCategory,
  onOpenProduct,
  onAddProduct,
  onOpenMarketingTarget,
}: Props) {
  const pageBackground = config.bgColor || (isElegant ? "#FDFBF7" : "#F8FAFC");
  const cardBackground = config.cardBgColor || "#FFFFFF";
  const borderColor = config.borderColor || (isElegant ? "#F2EAE1" : "#E2E8F0");
  const pageBodyColor = readableAccent(config.textColor || "#475569", pageBackground);
  const cardBodyColor = readableAccent(config.textColor || "#475569", cardBackground);
  const primaryPageAccent = readableAccent(primaryColor, pageBackground);
  const primaryCardAccent = readableAccent(primaryColor, cardBackground);
  const secondaryPageAccent = readableAccent(secondaryColor, pageBackground);
  const secondaryCardAccent = readableAccent(secondaryColor, cardBackground);
  const products = config.products.filter((product) => product.status !== "archived" && product.status !== "draft");
  const categories = Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean)));
  const phone = canonicalContactTarget(config.phone);
  const whatsapp = canonicalContactTarget(config.whatsapp);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email?.trim() : null;
  const bankUsable = config.enableBankTransfer === true
    && Boolean(config.bankName?.trim())
    && Boolean(config.bankAccountName?.trim())
    && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim());
  const walletCount = config.enableEWallets === true
    ? (config.customWallets ?? []).filter((wallet) => wallet.active !== false && wallet.name.trim() && wallet.accountNumber.trim()).length
    : 0;
  const facts: TrustFact[] = [
    ...(products.length > 0 ? [{ key: "products", label: `${products.length} منتج منشور`, icon: ShoppingBag }] : []),
    ...(categories.length > 0 ? [{ key: "categories", label: `${categories.length} تصنيف فعلي`, icon: Grid3X3 }] : []),
    ...(phone ? [{ key: "phone", label: `اتصال: ${phone}`, icon: Phone }] : []),
    ...(whatsapp ? [{ key: "whatsapp", label: "التواصل عبر WhatsApp متاح", icon: MessageSquare }] : []),
    ...(validEmail ? [{ key: "email", label: `البريد: ${validEmail}`, icon: Mail }] : []),
    ...(config.workingHours?.trim() ? [{ key: "hours", label: config.workingHours.trim(), icon: Clock }] : []),
    ...(config.enableCashOnDelivery === true ? [{ key: "cod", label: "الدفع عند الاستلام مفعّل", icon: CreditCard }] : []),
    ...(bankUsable ? [{ key: "bank", label: "التحويل البنكي متاح", icon: Building2 }] : []),
    ...(walletCount > 0 ? [{ key: "wallets", label: `${walletCount} وسيلة محفظة مفعلة`, icon: CreditCard }] : []),
    ...(typeof config.freeShippingThreshold === "number" && config.freeShippingThreshold > 0
      ? [{ key: "free-shipping", label: `الشحن المجاني يبدأ من ${config.freeShippingThreshold} ${config.currency}`, icon: Truck }]
      : typeof config.shippingFee === "number"
        ? [{ key: "shipping", label: `رسوم الشحن ${config.shippingFee} ${config.currency}`, icon: Truck }]
        : []),
  ];
  const elegantModel = elegantStoriesHomeModel(config);
  const hasElegantEditorial = isElegant && (elegantModel.stories.length > 0 || elegantModel.discoveryItems.length > 0);
  const legacyCategories = (
    <section className="space-y-4">
      <div><h2 className="text-xl font-black" style={{ color: secondaryPageAccent }}>التصنيفات</h2><p className="mt-1 text-xs" style={{ color: pageBodyColor }}>التصنيفات المستخرجة من المنتجات المنشورة.</p></div>
      {categories.length > 0 ? <div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => onSelectCategory(category)} className="min-h-11 rounded-full border px-4 py-2 text-xs font-black transition hover:-translate-y-0.5 motion-reduce:transform-none" style={{ backgroundColor: cardBackground, borderColor, color: secondaryCardAccent }}>{category}</button>)}</div> : <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold" style={{ backgroundColor: cardBackground, borderColor, color: cardBodyColor }}>لا توجد تصنيفات منشورة بعد.</div>}
    </section>
  );

  const sections: Record<StorefrontSectionId, React.ReactNode> = {
    hero: hasElegantEditorial ? (
      <ElegantStoriesHome
        model={elegantModel}
        tokens={{
          background: pageBackground,
          surface: cardBackground,
          ink: secondaryPageAccent,
          mutedInk: pageBodyColor,
          border: borderColor,
          accent: primaryPageAccent,
        }}
        onOpenStory={(story) => onOpenMarketingTarget(story.targetType, story.targetValue)}
        onOpenDiscovery={(item) => onOpenMarketingTarget(item.targetType, item.targetValue)}
        onOpenDiscoveryAll={onOpenProducts}
      />
    ) : <StorefrontHero config={config} isElegant={isElegant} primaryColor={primaryColor} secondaryColor={secondaryColor} onOpenProducts={onOpenProducts} />,
    trust: (
      <section className="rounded-3xl border p-5 shadow-sm" style={{ backgroundColor: cardBackground, borderColor }}>
        <div className="mb-4"><h2 className="text-lg font-black" style={{ color: secondaryCardAccent }}>معلومات المتجر والخدمة</h2><p className="mt-1 text-xs" style={{ color: cardBodyColor }}>بيانات منشورة من إعدادات المتجر الحالية.</p></div>
        {facts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(({ key, label, icon: Icon }) => <div key={key} className="flex items-center gap-3 rounded-2xl border p-4 text-xs font-bold" style={{ backgroundColor: pageBackground, borderColor, color: pageBodyColor }}><Icon className="h-4 w-4 shrink-0" style={{ color: primaryPageAccent }} /><span>{label}</span></div>)}
          </div>
        ) : <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold" style={{ borderColor, color: cardBodyColor }}>لم يضف المتجر معلومات الخدمة بعد</div>}
      </section>
    ),
    categories: hasElegantEditorial ? null : legacyCategories,
    featured_products: (
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black" style={{ color: secondaryPageAccent }}>المنتجات المنشورة</h2><p className="mt-1 text-xs" style={{ color: pageBodyColor }}>منتجات من كتالوج المتجر الحالي.</p></div>{products.length > 0 && <button type="button" onClick={onOpenProducts} className="text-xs font-black" style={{ color: primaryPageAccent }}>عرض الكل</button>}</div>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 8).map((product) => <StorefrontProductCard key={product.id} product={product} currency={config.currency} primaryColor={primaryColor} secondaryColor={secondaryColor} cardBackground={cardBackground} borderColor={borderColor} onOpen={onOpenProduct} onAdd={onAddProduct} />)}
          </div>
        ) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold" style={{ backgroundColor: cardBackground, borderColor, color: cardBodyColor }}>لم ينشر المتجر منتجات بعد.</div>}
      </section>
    ),
    about: (
      <section className="grid gap-5 rounded-3xl border p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_240px] md:items-center" style={{ backgroundColor: cardBackground, borderColor }}>
        <div className="space-y-3"><h2 data-storefront-about-heading className="text-xl font-black" style={{ color: secondaryCardAccent }}>{config.aboutTitle?.trim() || `عن ${config.storeName}`}</h2><p className="line-clamp-4 text-sm leading-7" style={{ color: cardBodyColor }}>{config.aboutText?.trim() || config.slogan}</p><button type="button" onClick={onOpenAbout} className="min-h-11 text-xs font-black hover:underline" style={{ color: primaryCardAccent }}>قراءة صفحة من نحن</button></div>
        {config.aboutImage && <img src={config.aboutImage} alt="" loading="lazy" decoding="async" sizes="(min-width: 768px) 240px, 100vw" className="aspect-video h-full w-full rounded-2xl object-cover md:aspect-square" referrerPolicy="no-referrer" />}
      </section>
    ),
  };

  return (
    <div className={`mx-auto flex w-full flex-col animate-fadeIn ${hasElegantEditorial ? "max-w-none gap-8 py-0" : "max-w-7xl gap-10 px-3 py-6 md:px-6 md:py-10"}`}>
      {storefrontSectionsOrDefault(config.homeSections).filter((section) => section.visible).map((section) => (
        sections[section.id] ? (
          <div key={section.id} data-storefront-section={section.id} className={hasElegantEditorial && section.id !== "hero" ? "mx-auto w-full max-w-7xl px-3 md:px-6" : undefined}>{sections[section.id]}</div>
        ) : null
      ))}
    </div>
  );
}
