import React from "react";
import { ArrowRight, Building2, CreditCard, Minus, Plus, ShoppingBag, Truck, Wallet } from "lucide-react";
import type { Product, StoreConfig } from "../../../types";
import { readableAccent, readableForeground } from "../../../utils/readableForeground";
import ProductArt from "../../../components/ProductArt";
import "./elegantStories.css";

interface Props {
  product: Product;
  config: StoreConfig;
  primaryColor: string;
  secondaryColor: string;
  images: string[];
  imageIndex: number;
  quantity: number;
  available: number | null;
  remaining: number;
  outOfStock: boolean;
  atCartLimit: boolean;
  bankUsable: boolean;
  walletCount: number;
  onBack: () => void;
  onSelectImage: (index: number) => void;
  onQuantityChange: (quantity: number) => void;
  onAdd: () => void;
}

export default function ElegantProductDetail({
  product,
  config,
  primaryColor,
  secondaryColor,
  images,
  imageIndex,
  quantity,
  available,
  remaining,
  outOfStock,
  atCartLimit,
  bankUsable,
  walletCount,
  onBack,
  onSelectImage,
  onQuantityChange,
  onAdd,
}: Props) {
  const pageBackground = config.bgColor || "#FDFBF7";
  const cardBackground = config.cardBgColor || "#FFFFFF";
  const borderColor = config.borderColor || "#F2EAE1";
  const headingColor = readableAccent(secondaryColor, pageBackground);
  const cardHeadingColor = readableAccent(secondaryColor, cardBackground);
  const bodyColor = readableAccent(config.textColor || "#57534E", pageBackground);
  const cardBodyColor = readableAccent(config.textColor || "#57534E", cardBackground);
  const accentOnPage = readableAccent(primaryColor, pageBackground);
  const accentOnCard = readableAccent(primaryColor, cardBackground);

  return (
    <main className="elegant-product-detail" style={{ backgroundColor: pageBackground }}>
      <button type="button" onClick={onBack} className="elegant-product-detail__back" style={{ color: bodyColor }}>
        <ArrowRight aria-hidden="true" /> العودة إلى المجموعة
      </button>

      <div className="elegant-product-detail__layout">
        <section className="elegant-product-gallery" aria-label={`صور ${product.name}`}>
          <div className="elegant-product-gallery__main" style={{ backgroundColor: cardBackground, borderColor }}>
            {images.length > 0 ? (
              <img src={images[imageIndex] ?? images[0]} alt={product.name} loading="eager" decoding="async" sizes="(min-width: 1024px) 55vw, 100vw" referrerPolicy="no-referrer" />
            ) : (
              <ProductArt keyword={product.imageKeyword} primaryColor={primaryColor} imageUrl={product.imageUrl} alt={product.name} loading="eager" sizes="(min-width: 1024px) 55vw, 100vw" />
            )}
          </div>
          {images.length > 1 ? (
            <div className="elegant-product-gallery__thumbs" role="group" aria-label={`صور ${product.name}`}>
              {images.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  onClick={() => onSelectImage(index)}
                  aria-label={`عرض الصورة ${index + 1} من ${images.length} للمنتج ${product.name}`}
                  aria-pressed={index === imageIndex}
                  style={{ borderColor: index === imageIndex ? primaryColor : borderColor }}
                >
                  <img src={image} alt="" loading="lazy" decoding="async" sizes="72px" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="elegant-product-detail__copy">
          <p className="elegant-product-detail__eyebrow" style={{ color: accentOnPage }}>{product.category || "المجموعة"}</p>
          <h1 style={{ color: headingColor }}>{product.name}</h1>
          <p className="elegant-product-detail__description" style={{ color: bodyColor }}>{product.description || "لم يضف المتجر وصفًا لهذا المنتج بعد."}</p>

          <div className="elegant-product-detail__price" style={{ borderColor }}>
            <span style={{ color: bodyColor }}>السعر الحالي</span>
            <strong style={{ color: accentOnPage }}>{product.price} {config.currency}</strong>
            <small style={{ color: bodyColor }}>يثبت الخادم السعر والمخزون النهائيين عند إرسال الطلب.</small>
          </div>

          <div className="elegant-product-detail__availability" data-unavailable={outOfStock || atCartLimit ? "true" : undefined}>
            {outOfStock ? "غير متوفر حاليًا" : atCartLimit ? "الكمية المتاحة موجودة في السلة" : available !== null ? `المتاح للإضافة: ${remaining}` : "يؤكد المتجر التوفر عند معالجة الطلب"}
          </div>

          <div className="elegant-product-detail__buy" style={{ backgroundColor: cardBackground, borderColor }}>
            <div className="elegant-product-detail__quantity" style={{ borderColor, color: cardHeadingColor }}>
              <button type="button" aria-label="تقليل الكمية" disabled={atCartLimit} onClick={() => onQuantityChange(Math.max(1, quantity - 1))}><Minus aria-hidden="true" /></button>
              <span>{quantity}</span>
              <button type="button" aria-label="زيادة الكمية" disabled={atCartLimit || quantity >= remaining} onClick={() => onQuantityChange(Math.min(remaining, quantity + 1))}><Plus aria-hidden="true" /></button>
            </div>
            <button
              type="button"
              disabled={outOfStock || atCartLimit}
              onClick={onAdd}
              className="elegant-product-detail__add"
              style={{ backgroundColor: primaryColor, color: readableForeground(primaryColor) }}
            >
              <ShoppingBag aria-hidden="true" /> {atCartLimit && !outOfStock ? "الكمية المتاحة في السلة" : "إضافة إلى السلة"}
            </button>
          </div>

          <section className="elegant-product-detail__service" style={{ backgroundColor: cardBackground, borderColor }}>
            <h2 style={{ color: cardHeadingColor }}>الشحن والدفع المنشور</h2>
            <div>
              {typeof config.freeShippingThreshold === "number" && config.freeShippingThreshold > 0 ? <p style={{ color: cardBodyColor }}><Truck aria-hidden="true" />شحن مجاني ابتداءً من {config.freeShippingThreshold} {config.currency}</p> : null}
              {typeof config.shippingFee === "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) ? <p style={{ color: cardBodyColor }}><Truck aria-hidden="true" />رسوم الشحن: {config.shippingFee} {config.currency}</p> : null}
              {config.enableCashOnDelivery === true ? <p style={{ color: cardBodyColor }}><CreditCard aria-hidden="true" />الدفع عند الاستلام متاح</p> : null}
              {bankUsable ? <p style={{ color: cardBodyColor }}><Building2 aria-hidden="true" />التحويل البنكي متاح</p> : null}
              {walletCount > 0 ? <p style={{ color: cardBodyColor }}><Wallet aria-hidden="true" />{walletCount} وسيلة محفظة متاحة</p> : null}
              {typeof config.shippingFee !== "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) && config.enableCashOnDelivery !== true && !bankUsable && walletCount === 0 ? <p style={{ color: cardBodyColor }}>لم ينشر المتجر تفاصيل الشحن والدفع بعد.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
