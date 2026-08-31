import React from "react";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { readableForeground } from "../../../utils/readableForeground";
import { DEFAULT_ELEGANT_STORIES_TOKENS, type ElegantStoriesThemeTokens } from "./model";
import "./elegantStories.css";

interface Props {
  storeName: string;
  logoUrl?: string;
  categories: string[];
  cartCount: number;
  searchQuery: string;
  currentRoute?: "home" | "products" | "about";
  tokens?: Partial<ElegantStoriesThemeTokens>;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onOpenHome: () => void;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onOpenCart: (trigger: HTMLElement) => void;
  onSelectCategory: (category: string) => void;
}

export default function ElegantEditorialHeader({
  storeName,
  logoUrl,
  categories,
  cartCount,
  searchQuery,
  currentRoute = "home",
  tokens,
  onSearchChange,
  onSearchSubmit,
  onOpenHome,
  onOpenProducts,
  onOpenAbout,
  onOpenCart,
  onSelectCategory,
}: Props) {
  const visibleCategories = categories.filter((category) => category.trim() !== "").slice(0, 5);
  const resolvedTokens = { ...DEFAULT_ELEGANT_STORIES_TOKENS, ...tokens };
  const style = {
    "--elegant-surface": resolvedTokens.surface,
    "--elegant-ink": resolvedTokens.ink,
    "--elegant-muted-ink": resolvedTokens.mutedInk,
    "--elegant-border": resolvedTokens.border,
  } as React.CSSProperties;

  const renderSearchForm = (id: string) => (
    <form
      className="elegant-editorial-header__search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearchSubmit();
      }}
    >
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>ابحث في المتجر</label>
      <input
        id={id}
        type="search"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="ابحث عن منتج أو علامة تجارية"
      />
    </form>
  );

  return (
    <header className="elegant-editorial-header" data-elegant-editorial-header style={style}>
      <button type="button" className="elegant-editorial-header__brand" onClick={onOpenHome} aria-label={`العودة إلى الصفحة الرئيسية لمتجر ${storeName}`}>
        {logoUrl?.trim() ? <img src={logoUrl} alt="" loading="eager" decoding="async" /> : null}
        <span>{storeName}</span>
      </button>

      <nav className="elegant-editorial-header__nav" aria-label="التنقل الرئيسي">
        <button type="button" data-storefront-nav="home" style={{ color: resolvedTokens.ink }} aria-current={currentRoute === "home" ? "page" : undefined} onClick={onOpenHome}>الرئيسية</button>
        {visibleCategories.map((category) => (
          <button type="button" key={category} style={{ color: resolvedTokens.ink }} onClick={() => onSelectCategory(category)}>{category}</button>
        ))}
        <button type="button" data-storefront-nav="products" style={{ color: resolvedTokens.ink }} aria-current={currentRoute === "products" ? "page" : undefined} onClick={onOpenProducts}>المنتجات</button>
        <button type="button" data-storefront-nav="about" style={{ color: resolvedTokens.ink }} aria-current={currentRoute === "about" ? "page" : undefined} onClick={onOpenAbout}>عن المتجر</button>
      </nav>

      <div className="elegant-editorial-header__desktop-search">{renderSearchForm("elegant-editorial-search-desktop")}</div>

      <button type="button" className="elegant-editorial-header__cart" onClick={(event) => onOpenCart(event.currentTarget)} aria-label={`فتح السلة، ${cartCount} منتج`}>
        <ShoppingBag aria-hidden="true" />
        {cartCount > 0 ? <span data-storefront-cart-count aria-hidden="true" style={{ backgroundColor: resolvedTokens.accent, color: readableForeground(resolvedTokens.accent) }}>{cartCount > 99 ? "99+" : cartCount}</span> : null}
      </button>

      <details className="elegant-editorial-header__mobile-menu">
        <summary aria-label="فتح قائمة المتجر"><Menu aria-hidden="true" /></summary>
        <div>
          {renderSearchForm("elegant-editorial-search-mobile")}
          <nav aria-label="التنقل المختصر">
            <button type="button" onClick={onOpenHome}>الرئيسية</button>
            <button type="button" onClick={onOpenProducts}>المنتجات</button>
            {visibleCategories.map((category) => (
              <button type="button" key={category} onClick={() => onSelectCategory(category)}>{category}</button>
            ))}
            <button type="button" onClick={onOpenAbout}>عن المتجر</button>
          </nav>
        </div>
      </details>
    </header>
  );
}
