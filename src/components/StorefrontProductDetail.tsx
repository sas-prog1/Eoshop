import React, { useEffect, useState } from "react";
import { ArrowRight, Building2, CreditCard, Minus, Plus, ShoppingBag, Truck, Wallet } from "lucide-react";
import type { Product, StoreConfig } from "../types";
import ProductArt from "./ProductArt";
import { readableAccent, readableForeground } from "../utils/readableForeground";
import { storefrontAvailableQuantity, storefrontCartLineLimit } from "../workflows/orderState";
import { ElegantProductDetail } from "../features/storefront/elegant-stories";

interface Props {
  product: Product;
  config: StoreConfig;
  primaryColor: string;
  secondaryColor: string;
  cartQuantity?: number;
  onBack: () => void;
  onAdd: (product: Product, quantity: number) => void;
}

export default function StorefrontProductDetail({ product, config, primaryColor, secondaryColor, cartQuantity = 0, onBack, onAdd }: Props) {
  const primaryForeground = readableForeground(primaryColor);
  const pageBackground = config.bgColor || "#FDFBF7";
  const cardBackground = config.cardBgColor || "#FFFFFF";
  const borderColor = config.borderColor || "#F2EAE1";
  const pageBodyColor = readableAccent(config.textColor || "#475569", pageBackground);
  const cardBodyColor = readableAccent(config.textColor || "#475569", cardBackground);
  const primaryCardAccent = readableAccent(primaryColor, cardBackground);
  const secondaryPageAccent = readableAccent(secondaryColor, pageBackground);
  const secondaryCardAccent = readableAccent(secondaryColor, cardBackground);
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const images = Array.from(new Set([product.imageUrl, ...(product.imageUrls ?? [])].filter((url): url is string => Boolean(url?.trim()))));
  const available = storefrontAvailableQuantity(product);
  const outOfStock = available === 0;
  const remaining = Math.max(0, storefrontCartLineLimit(product) - cartQuantity);
  const atCartLimit = remaining === 0;
  const bankUsable = config.enableBankTransfer === true
    && Boolean(config.bankName?.trim())
    && Boolean(config.bankAccountName?.trim())
    && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim());
  const walletCount = config.enableEWallets === true
    ? (config.customWallets ?? []).filter((wallet) => wallet.active !== false && wallet.name.trim() && wallet.accountNumber.trim()).length
    : 0;

  useEffect(() => {
    setImageIndex(0);
    setQuantity(1);
  }, [product.id]);

  useEffect(() => {
    if (remaining > 0) setQuantity((value) => Math.min(value, remaining));
  }, [remaining]);

  if (config.themeStyle === "elegant") {
    return (
      <ElegantProductDetail
        product={product}
        config={config}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        images={images}
        imageIndex={imageIndex}
        quantity={quantity}
        available={available}
        remaining={remaining}
        outOfStock={outOfStock}
        atCartLimit={atCartLimit}
        bankUsable={bankUsable}
        walletCount={walletCount}
        onBack={onBack}
        onSelectImage={setImageIndex}
        onQuantityChange={setQuantity}
        onAdd={() => onAdd(product, quantity)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-right animate-fadeIn">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black" style={{ backgroundColor: cardBackground, borderColor, color: secondaryCardAccent }}><ArrowRight className="h-4 w-4" />العودة إلى المنتجات</button>
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-3xl border p-5 shadow-sm" style={{ backgroundColor: cardBackground, borderColor }}>
            {images.length > 0 ? <img src={images[imageIndex] ?? images[0]} alt={product.name} loading="eager" decoding="async" sizes="(min-width: 768px) 50vw, 100vw" className="h-full w-full rounded-2xl object-cover" referrerPolicy="no-referrer" /> : <ProductArt keyword={product.imageKeyword} primaryColor={primaryColor} imageUrl={product.imageUrl} alt={product.name} loading="eager" sizes="(min-width: 768px) 50vw, 100vw" />}
          </div>
          {images.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label={`صور ${product.name}`}>{images.map((image, index) => <button type="button" key={image} onClick={() => setImageIndex(index)} aria-label={`عرض الصورة ${index + 1} من ${images.length} للمنتج ${product.name}`} aria-pressed={index === imageIndex} className="h-14 w-14 overflow-hidden rounded-xl border-2" style={{ borderColor: index === imageIndex ? primaryColor : borderColor }}><img src={image} alt="" loading="lazy" decoding="async" sizes="56px" className="h-full w-full object-cover" referrerPolicy="no-referrer" /></button>)}</div>}
        </div>
        <div className="space-y-5">
          <div><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category || "غير مصنف"}</span><h1 className="mt-3 text-2xl font-black leading-tight md:text-3xl" style={{ color: secondaryPageAccent }}>{product.name}</h1></div>
          <p className="text-sm leading-8" style={{ color: pageBodyColor }}>{product.description || "لم يضف المتجر وصفًا لهذا المنتج بعد."}</p>
          <div className="rounded-2xl border p-5 shadow-sm" style={{ backgroundColor: cardBackground, borderColor }}><span className="text-xs" style={{ color: cardBodyColor }}>السعر</span><p className="mt-1 text-3xl font-black" style={{ color: primaryCardAccent }}>{product.price} {config.currency}</p><p className="mt-2 text-[11px]" style={{ color: cardBodyColor }}>يُثبت السعر النهائي والمخزون عند إرسال الطلب إلى الخادم.</p></div>
          <div className={`rounded-2xl border p-4 text-xs font-black ${outOfStock || atCartLimit ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {outOfStock ? "غير متوفر حاليًا" : atCartLimit ? "الكمية المتاحة موجودة في السلة" : available !== null ? `المتاح للإضافة: ${remaining}` : "يؤكد المتجر التوفر عند معالجة الطلب"}
          </div>
          <div className="flex flex-col items-stretch gap-3 min-[360px]:flex-row min-[360px]:items-center"><div className="flex items-center justify-center rounded-xl border" style={{ backgroundColor: cardBackground, borderColor, color: cardBodyColor }}><button type="button" aria-label="تقليل الكمية" disabled={atCartLimit} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="min-h-11 min-w-11 p-3 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="h-4 w-4" /></button><span className="min-w-10 text-center text-sm font-black">{quantity}</span><button type="button" aria-label="زيادة الكمية" disabled={atCartLimit || quantity >= remaining} onClick={() => setQuantity((value) => Math.min(remaining, value + 1))} className="min-h-11 min-w-11 p-3 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button></div><button type="button" disabled={outOfStock || atCartLimit} onClick={() => onAdd(product, quantity)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primaryColor, color: primaryForeground }}><ShoppingBag className="h-4 w-4" />{atCartLimit && !outOfStock ? "الكمية المتاحة في السلة" : "إضافة إلى السلة"}</button></div>
          <section className="space-y-2 rounded-2xl border p-5" style={{ backgroundColor: cardBackground, borderColor }}><h2 className="text-sm font-black" style={{ color: secondaryCardAccent }}>الشحن والدفع المنشور</h2>
            {typeof config.freeShippingThreshold === "number" && config.freeShippingThreshold > 0 && <p className="flex items-center gap-2 text-xs" style={{ color: cardBodyColor }}><Truck className="h-4 w-4" />شحن مجاني ابتداءً من {config.freeShippingThreshold} {config.currency}</p>}
            {typeof config.shippingFee === "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) && <p className="flex items-center gap-2 text-xs" style={{ color: cardBodyColor }}><Truck className="h-4 w-4" />رسوم الشحن: {config.shippingFee} {config.currency}</p>}
            {config.enableCashOnDelivery === true && <p className="flex items-center gap-2 text-xs" style={{ color: cardBodyColor }}><CreditCard className="h-4 w-4" />الدفع عند الاستلام متاح</p>}
            {bankUsable && <p className="flex items-center gap-2 text-xs" style={{ color: cardBodyColor }}><Building2 className="h-4 w-4" />التحويل البنكي متاح</p>}
            {walletCount > 0 && <p className="flex items-center gap-2 text-xs" style={{ color: cardBodyColor }}><Wallet className="h-4 w-4" />{walletCount} وسيلة محفظة متاحة</p>}
            {typeof config.shippingFee !== "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) && config.enableCashOnDelivery !== true && !bankUsable && walletCount === 0 && <p className="text-xs" style={{ color: cardBodyColor }}>لم ينشر المتجر تفاصيل الشحن والدفع بعد.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
