import React from "react";
import { Menu, Search, ShoppingBag } from "lucide-react";
import "./elegantStories.css";

interface Props {
  storeName: string;
  logoUrl?: string;
  categories: string[];
  cartCount: number;
  searchQuery: string;
  currentRoute?: "home" | "products" | "about";
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onOpenHome: () => void;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onOpenCart: () => void;
  onSelectCategory: (category: string) => void;
}

export default function ElegantEditorialHeader({
  storeName,
  logoUrl,
  categories,
  cartCount,
  searchQuery,
  currentRoute = "home",
  onSearchChange,
  onSearchSubmit,
  onOpenHome,
  onOpenProducts,
  onOpenAbout,
  onOpenCart,
  onSelectCategory,
}: Props) {
  const visibleCategories = categories.filter((category) => category.trim() !== "").slice(0, 5);

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
    <header className="elegant-editorial-header" data-elegant-editorial-header>
      <button type="button" className="elegant-editorial-header__brand" onClick={onOpenHome} aria-label={`العودة إلى رئيسية ${storeName}`}>
        {logoUrl?.trim() ? <img src={logoUrl} alt="" loading="eager" decoding="async" /> : null}
        <span>{storeName}</span>
      </button>

      <nav className="elegant-editorial-header__nav" aria-label="التنقل الرئيسي">
        <button type="button" aria-current={currentRoute === "home" ? "page" : undefined} onClick={onOpenHome}>الرئيسية</button>
        {visibleCategories.map((category) => (
          <button type="button" key={category} onClick={() => onSelectCategory(category)}>{category}</button>
        ))}
        <button type="button" aria-current={currentRoute === "products" ? "page" : undefined} onClick={onOpenProducts}>المنتجات</button>
        <button type="button" aria-current={currentRoute === "about" ? "page" : undefined} onClick={onOpenAbout}>عن المتجر</button>
      </nav>

      <div className="elegant-editorial-header__desktop-search">{renderSearchForm("elegant-editorial-search-desktop")}</div>

      <button type="button" className="elegant-editorial-header__cart" onClick={onOpenCart} aria-label={`فتح السلة، ${cartCount} منتج`}>
        <ShoppingBag aria-hidden="true" />
        {cartCount > 0 ? <span aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span> : null}
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
