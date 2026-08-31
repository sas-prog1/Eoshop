import React from "react";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { Product } from "../../../types";
import { readableAccent, readableForeground } from "../../../utils/readableForeground";
import { storefrontAvailableQuantity } from "../../../workflows/orderState";
import ProductArt from "../../../components/ProductArt";

interface Props {
  product: Product;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  cardBackground: string;
  borderColor: string;
  reducedMotion?: boolean;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
}

export default function ElegantCatalogProductCard({
  product,
  currency,
  primaryColor,
  secondaryColor,
  cardBackground,
  borderColor,
  reducedMotion = false,
  onOpen,
  onAdd,
}: Props) {
  const outOfStock = storefrontAvailableQuantity(product) === 0;
  const headingColor = readableAccent(secondaryColor, cardBackground);
  const priceColor = readableAccent(primaryColor, cardBackground);

  return (
    <article
      data-storefront-product-card
      data-elegant-catalog-card
      data-reduced-motion={reducedMotion ? "true" : undefined}
      className="elegant-catalog-card"
      style={{ backgroundColor: cardBackground, borderColor }}
    >
      <button
        type="button"
        aria-label={`فتح تفاصيل ${product.name}`}
        onClick={() => onOpen(product)}
        className="elegant-catalog-card__image"
        style={{ outlineColor: primaryColor }}
      >
        <ProductArt
          keyword={product.imageKeyword}
          primaryColor={primaryColor}
          imageUrl={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 1280px) 24vw, (min-width: 768px) 33vw, 50vw"
        />
        {product.category?.trim() ? <span>{product.category}</span> : null}
        {outOfStock ? <strong>غير متوفر حاليًا</strong> : null}
      </button>

      <div className="elegant-catalog-card__body">
        <button type="button" onClick={() => onOpen(product)} className="elegant-catalog-card__title" style={{ color: headingColor }}>
          {product.name}
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="elegant-catalog-card__purchase">
          <span style={{ color: priceColor }}>{product.price} {currency}</span>
          <button
            type="button"
            disabled={outOfStock}
            aria-label={`إضافة ${product.name} إلى السلة`}
            title={outOfStock ? "غير متوفر حاليًا" : "أضف للسلة"}
            onClick={() => onAdd(product)}
            style={{ backgroundColor: primaryColor, color: readableForeground(primaryColor) }}
          >
            <ShoppingBag aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
