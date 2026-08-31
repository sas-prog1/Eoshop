import React from "react";
import { RotateCcw, Search, ShoppingBag, X } from "lucide-react";
import type { Product } from "../../../types";
import { readableAccent } from "../../../utils/readableForeground";
import ElegantCatalogProductCard from "./ElegantCatalogProductCard";
import "./elegantStories.css";

interface Props {
  products: Product[];
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  cardBackground: string;
  borderColor: string;
  reducedMotion?: boolean;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: string) => void;
  onReset: () => void;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
}

export default function ElegantCatalog({
  products,
  categories,
  selectedCategory,
  searchQuery,
  currency,
  primaryColor,
  secondaryColor,
  textColor,
  backgroundColor,
  cardBackground,
  borderColor,
  reducedMotion = false,
  onSearchChange,
  onSelectCategory,
  onReset,
  onOpen,
  onAdd,
}: Props) {
  const headingColor = readableAccent(secondaryColor, backgroundColor);
  const bodyColor = readableAccent(textColor, backgroundColor);

  return (
    <main className="elegant-catalog" style={{ backgroundColor }}>
      <header className="elegant-catalog__intro" style={{ borderColor }}>
        <div>
          <p style={{ color: bodyColor }}>المجموعة الكاملة</p>
          <h1 data-storefront-products-heading style={{ color: headingColor }}>اكتشف ما يناسب أسلوبك</h1>
          <span style={{ color: bodyColor }}>{products.length} {products.length === 1 ? "منتج متاح" : "منتجات متاحة"} وفق خياراتك الحالية</span>
        </div>
        <label className="elegant-catalog__search" style={{ backgroundColor: cardBackground, borderColor, color: headingColor }}>
          <Search aria-hidden="true" />
          <span className="sr-only">البحث في كتالوج المنتجات</span>
          <input
            type="search"
            aria-label="البحث في كتالوج المنتجات"
            placeholder="ابحث بالاسم أو الوصف"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {searchQuery ? <button type="button" aria-label="مسح البحث" onClick={() => onSearchChange("")}><X aria-hidden="true" /></button> : null}
        </label>
      </header>

      {categories.length > 1 ? (
        <nav className="elegant-catalog__categories" aria-label="تصنيفات المنتجات" style={{ borderColor }}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              data-storefront-category={category}
              aria-pressed={selectedCategory === category}
              onClick={() => onSelectCategory(category)}
              style={{ color: selectedCategory === category ? readableAccent(primaryColor, backgroundColor) : bodyColor }}
            >
              {category}
            </button>
          ))}
        </nav>
      ) : null}

      {products.length === 0 ? (
        <section className="elegant-catalog__empty" style={{ backgroundColor: cardBackground, borderColor, color: bodyColor }} role="status">
          <ShoppingBag aria-hidden="true" />
          <h2 style={{ color: headingColor }}>لم نجد ما يطابق بحثك</h2>
          <p>جرّب تصنيفًا آخر أو امسح عبارة البحث للعودة إلى المجموعة كاملة.</p>
          <button type="button" onClick={onReset} style={{ color: readableAccent(primaryColor, cardBackground) }}><RotateCcw aria-hidden="true" />إعادة ضبط الخيارات</button>
        </section>
      ) : (
        <section className="elegant-catalog__grid" aria-label="منتجات المتجر">
          {products.map((product) => (
            <React.Fragment key={product.id}>
              <ElegantCatalogProductCard
                product={product}
                currency={currency}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                cardBackground={cardBackground}
                borderColor={borderColor}
                reducedMotion={reducedMotion}
                onOpen={onOpen}
                onAdd={onAdd}
              />
            </React.Fragment>
          ))}
        </section>
      )}
    </main>
  );
}
