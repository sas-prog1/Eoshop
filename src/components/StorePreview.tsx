import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, Phone, ChevronLeft, ChevronRight, Search, Plus, Minus, X, Check, ArrowRight,
  Mail, MapPin, Clock, MessageSquare, Send, Sparkles, Heart, Truck, CreditCard,
  Instagram, Twitter, Video, Camera, Share2, Cpu, Zap, Box,
  Home, Info, Wallet, Copy, FileText, Printer, CheckCircle2, Building, QrCode, Tag, ExternalLink, Lock,
} from "lucide-react";
import { StoreConfig, Product } from "../types";
import type { CreateOrderInput, OrderReceipt } from "../adapters/uiAdapters";
import ProductArt from "./ProductArt";
import StorefrontHome from "./StorefrontHome";
import StorefrontProductDetail from "./StorefrontProductDetail";
import StorefrontProductCard from "./StorefrontProductCard";
import StorefrontFooter from "./StorefrontFooter";
import { buildPrintableInvoiceHtml, calculatePreviewCheckout, canonicalContactTarget, preferredContactTarget, previewPercentageDiscount } from "../contracts/checkoutPolicy";
import { usePlatformSettings } from "../adapters/PlatformSettingsContext";
import { readableAccent, readableForeground } from "../utils/readableForeground";
import { storefrontAvailableQuantity, storefrontCartLineLimit } from "../workflows/orderState";
import type { StorefrontMarketingTargetType } from "../contracts/storefrontMarketingBlocks";
import { ElegantEditorialHeader } from "../features/storefront/elegant-stories";

interface StorePreviewProps {
  config: StoreConfig;
  cart: { product: Product; quantity: number }[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, amount: number) => void;
  calculateTotal: () => void; // not used as we can calculate locally
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  hasOrdered: boolean;
  handleCheckout: () => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  previewDevice?: "desktop" | "mobile";
  onBackToLanding?: () => void;
  externalPage?: string;
  onResetExternalPage?: () => void;
  mode?: "preview" | "live";
  submitOrder?: (input: Omit<CreateOrderInput, "workspaceRevision" | "catalogRevision">) => Promise<OrderReceipt>;
}

const getFontFamilyStyle = (fontName?: string) => {
  switch (fontName) {
    case "Tajawal": return "'Tajawal', sans-serif";
    case "Almarai": return "'Almarai', sans-serif";
    case "Alexandria": return "'Alexandria', sans-serif";
    case "IBM Plex Sans Arabic":
    case "IBMPlexSansArabic": return "'IBM Plex Sans Arabic', sans-serif";
    case "Amiri": return "'Amiri', serif";
    case "Changa": return "'Changa', sans-serif";
    case "Readex Pro":
    case "ReadexPro": return "'Readex Pro', sans-serif";
    case "Cairo":
    default:
      return "'Cairo', sans-serif";
  }
};

const handleRadioArrowNavigation = (event: React.KeyboardEvent<HTMLButtonElement>) => {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;

  const group = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
  const radios: HTMLButtonElement[] = group
    ? Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])'))
    : [];
  if (radios.length === 0) return;

  event.preventDefault();
  const currentIndex = Math.max(0, radios.indexOf(event.currentTarget));
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? radios.length - 1
      : event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (currentIndex + 1) % radios.length
        : (currentIndex - 1 + radios.length) % radios.length;
  radios[nextIndex]?.focus();
  radios[nextIndex]?.click();
};

const useStorefrontReducedMotion = () => {
  const readPreference = () => typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reducedMotion, setReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
};

export default function StorePreview({
  config,
  cart,
  addToCart,
  updateQuantity,
  isCartDrawerOpen,
  setIsCartDrawerOpen,
  hasOrdered,
  handleCheckout,
  selectedCategory,
  setSelectedCategory,
  previewDevice = "desktop",
  externalPage,
  onResetExternalPage,
  mode = "preview",
  submitOrder,
}: StorePreviewProps) {
  const { settings: platformSettings } = usePlatformSettings();
  const prefersReducedMotion = useStorefrontReducedMotion();
  const cartDialogRef = useRef<HTMLDivElement>(null);
  const cartCloseButtonRef = useRef<HTMLButtonElement>(null);
  const cartTriggerRef = useRef<HTMLElement | null>(null);
  const cartExitFocusRef = useRef<"trigger" | "checkout" | null>(null);
  const checkoutErrorRef = useRef<HTMLDivElement>(null);
  const checkoutFocusTargetRef = useRef<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Navigation Page State inside store
  const [storePage, setStorePage] = useState<"home" | "products" | "about" | "contact" | "product" | "checkout">("home");

  useEffect(() => {
    if (externalPage && ["home", "products", "about", "contact", "product", "checkout"].includes(externalPage)) {
      setStorePage(externalPage as any);
      if (onResetExternalPage) onResetExternalPage();
    }
  }, [externalPage]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [productQty, setProductQty] = useState(1);
  const [activeTab, setActiveTab] = useState<"specs" | "shipping" | "reviews">("specs");
  const [copiedLink, setCopiedLink] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Checkout & Payment States
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    city: "صنعاء",
    address: "",
    notes: ""
  });
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet">("cod");
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [transferRefNumber, setTransferRefNumber] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState<any>(null);
  const [copiedWalletNum, setCopiedWalletNum] = useState<string | null>(null);
  const [formValidationErr, setFormValidationErr] = useState("");
  const [checkoutErrorRevision, setCheckoutErrorRevision] = useState(0);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [isCartModalPresent, setIsCartModalPresent] = useState(isCartDrawerOpen);

  const openCart = (trigger: HTMLElement) => {
    cartTriggerRef.current = trigger;
    cartExitFocusRef.current = null;
    setIsCartModalPresent(true);
    setIsCartDrawerOpen(true);
  };

  const closeCart = (focusDestination: "trigger" | "checkout" = "trigger") => {
    cartExitFocusRef.current = focusDestination;
    setIsCartDrawerOpen(false);
  };

  const handleCartExitComplete = () => {
    setIsCartModalPresent(false);
  };

  useEffect(() => {
    if (isCartModalPresent) return;

    if (cartExitFocusRef.current === "checkout") {
      document.getElementById("storefront-checkout-title")?.focus();
    } else if (cartExitFocusRef.current === "trigger") {
      cartTriggerRef.current?.focus();
    }
    cartExitFocusRef.current = null;
  }, [isCartModalPresent]);

  useEffect(() => {
    if (isCartDrawerOpen) setIsCartModalPresent(true);
  }, [isCartDrawerOpen]);

  const reportCheckoutError = (message: string, focusTargetId?: string) => {
    checkoutFocusTargetRef.current = focusTargetId ?? null;
    setFormValidationErr(message);
    setCheckoutErrorRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (!isCartModalPresent) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable: HTMLElement[] = [];
      cartDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ).forEach((element) => {
        if (element.getAttribute("aria-hidden") !== "true") focusable.push(element);
      });
      if (focusable.length === 0) {
        event.preventDefault();
        cartDialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
    };
  }, [isCartModalPresent]);

  useEffect(() => {
    if (isCartDrawerOpen) cartCloseButtonRef.current?.focus();
  }, [isCartDrawerOpen]);

  useEffect(() => {
    if (!formValidationErr) return;
    const target = checkoutFocusTargetRef.current
      ? document.getElementById(checkoutFocusTargetRef.current)
      : null;
    (target ?? checkoutErrorRef.current)?.focus();
    checkoutFocusTargetRef.current = null;
  }, [formValidationErr, checkoutErrorRevision]);

  useEffect(() => {
    if (orderCompleted) receiptRef.current?.focus();
  }, [orderCompleted]);

  useEffect(() => {
    if (config.enableCashOnDelivery !== true) setPaymentMethod("wallet");
  }, [config.enableCashOnDelivery]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedProduct]);

  const handleOpenProductProfile = (product: Product) => {
    setSelectedProduct(product);
    setProductQty(1);
    setActiveImageIndex(0);
    setStorePage("product");
    const container = document.getElementById("store-preview-scroll-container");
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  };

  const handleAddToCartWithQty = (product: Product, qty: number) => {
    const available = storefrontCartLineLimit(product);
    const currentQuantity = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
    if (currentQuantity >= available) return;
    addToCart(product, qty);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  const primaryColor = config.primaryColor || "#D4AF37";
  const primaryForeground = readableForeground(primaryColor);
  const secondaryColor = config.secondaryColor || "#1C1917";
  const secondaryForeground = readableForeground(secondaryColor);
  const textColor = config.textColor || (config.themeStyle === "elegant" ? "#44403C" : "#334155");
  const bgColor = config.bgColor || (config.themeStyle === "elegant" ? "#fdfbf7" : "#f8fafc");
  const cardBgColor = config.cardBgColor || "#ffffff";
  const borderColor = config.borderColor || (config.themeStyle === "elegant" ? "#f2eae1" : "#e2e8f0");
  const primaryOnWhite = readableAccent(primaryColor, "#ffffff");
  const primaryOnWarmSurface = readableAccent(primaryColor, "#f5efe6");
  const secondaryOnCard = readableAccent(secondaryColor, cardBgColor);
  const secondaryOnPage = readableAccent(secondaryColor, bgColor);
  const secondaryOnWarmSurface = readableAccent(secondaryColor, "#f5efe6");
  const effectiveTextColor = readableAccent(textColor, bgColor);
  const isElegant = config.themeStyle === "elegant";
  const canonicalPhone = canonicalContactTarget(config.phone);

  // Calculate cart total locally
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const publishedProducts = config.products.filter((product) => product.status !== "archived" && product.status !== "draft");
  const detailProduct = selectedProduct
    ? publishedProducts.find((product) => product.id === selectedProduct.id) ?? null
    : publishedProducts[0] ?? null;

  // Categories list
  const categories = ["الكل"];
  publishedProducts.forEach((p) => {
    if (p.category && !categories.includes(p.category)) {
      categories.push(p.category);
    }
  });

  const openMarketingTarget = (targetType: StorefrontMarketingTargetType, targetValue?: string) => {
    if (targetType === "products") {
      setSelectedCategory("الكل");
      setStorePage("products");
      return;
    }
    if (targetType === "category") {
      setSelectedCategory(targetValue?.trim() || "الكل");
      setStorePage("products");
      return;
    }
    if (targetType === "product") {
      const product = publishedProducts.find((candidate) => candidate.id === targetValue);
      if (product) handleOpenProductProfile(product);
      else setStorePage("products");
      return;
    }
    if (!targetValue) return;
    try {
      const target = new URL(targetValue);
      if (target.protocol === "https:" && !target.username && !target.password) {
        window.open(target.toString(), "_blank", "noopener,noreferrer");
      }
    } catch {
      // The server validates external campaign targets; keep the client defensive.
    }
  };

  // Filter products by category AND search query
  const displayedProducts = publishedProducts.filter((p) => {
    const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
    const matchesSearch = searchQuery.trim() === "" || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div 
      id="store-preview-scroll-container"
      dir="rtl"
      className="w-full h-full flex flex-col relative overflow-y-auto pb-24 lg:pb-6"
      style={{ 
        fontFamily: getFontFamilyStyle(config.fontFamily),
        backgroundColor: bgColor,
        color: effectiveTextColor
      }}
    >
      <div
        className="contents"
        data-storefront-background
        aria-hidden={isCartModalPresent ? "true" : undefined}
        inert={isCartModalPresent ? true : undefined}
      >
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {addedSuccess ? "تمت إضافة المنتج إلى سلة التسوق." : ""}
      </div>
      {/* Promotion / Announcement Bar */}
      {config.bannerText && (
        <div 
          className={`text-center py-2.5 px-4 text-xs font-extrabold transition-all duration-300 shadow-2xs flex items-center justify-center min-h-[40px] ${
            !isElegant ? "bg-slate-900 border-b border-sky-900/40 text-sky-100 flex items-center justify-between gap-2 max-w-full" : ""
          }`}
          style={{ 
            backgroundColor: isElegant ? primaryColor : undefined, 
            color: isElegant ? primaryForeground : undefined
          }}
        >
          {!isElegant ? (
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-[11px] leading-normal">
              <div className="hidden sm:flex items-center gap-2 text-slate-300">
                <ShoppingBag className="h-3.5 w-3.5 text-sky-400" />
                <span>{publishedProducts.length} منتج منشور</span>
              </div>
              <motion.p
                animate={prefersReducedMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
                transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 3 }}
                className="truncate max-w-xl text-center mx-auto sm:mx-0 font-bold text-sky-200 leading-relaxed"
              >
                🔥 {config.bannerText}
              </motion.p>
              {canonicalPhone && <div className="hidden lg:flex items-center gap-3 text-slate-300">
                <a href={`tel:${canonicalPhone}`} className="hover:text-sky-300 transition flex items-center gap-1">
                  <Phone className="w-3 h-3 text-sky-400" />
                  <span>اتصال هاتفي متاح</span>
                </a>
              </div>}
            </div>
          ) : (
            <motion.p
              animate={prefersReducedMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
              transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 3 }}
              className="truncate max-w-2xl text-xs sm:text-sm mx-auto font-bold leading-normal text-center"
            >
              {config.bannerText}
            </motion.p>
          )}
        </div>
      )}

      {/* Main Header */}
      {!isElegant ? (
        /* TECH TEMPLATE UNIQUE HEADER DESIGN */
        <header 
          className="sticky top-0 z-20 backdrop-blur-xl border-b shadow-sm transition-all duration-300"
          style={{ backgroundColor: cardBgColor, borderColor: borderColor }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Top Row: Brand & Mobile Cart */}
            <div className="flex items-center justify-between w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setStorePage("home")}
                className="flex items-center gap-3 cursor-pointer group text-right rounded-xl"
                aria-label={`العودة إلى الصفحة الرئيسية لمتجر ${config.storeName || "المتجر"}`}
              >
                <div className="relative flex items-center">
                  {config.logoUrl ? (
                    <img 
                      src={config.logoUrl} 
                      alt={config.storeName} 
                      style={{ height: `${config.logoSize || 44}px` }} 
                      className="w-auto max-w-[150px] sm:max-w-[220px] object-contain group-hover:scale-105 transition duration-300 shrink-0 filter drop-shadow-xs"
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span 
                      style={{ 
                        width: `${config.logoSize || 44}px`, 
                        height: `${config.logoSize || 44}px`,
                        fontSize: `${Math.max(16, (config.logoSize || 44) * 0.5)}px`
                      }} 
                      className="rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition duration-300 shrink-0"
                    >
                      {config.logoIcon || "⚡"}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black group-hover:text-sky-700 transition tracking-tight" style={{ color: secondaryOnCard }}>
                      {config.storeName || "متجر الأجهزة الذكية"}
                    </h1>
                    <span className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                      TECH
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-extrabold truncate max-w-[180px] md:max-w-xs">
                    {config.slogan || `مرحباً بكم في ${config.storeName}`}
                  </p>
                </div>
              </button>

              {/* Mobile Shopping Cart Trigger */}
              <div className="flex lg:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => openCart(event.currentTarget)}
                  aria-label={`فتح سلة التسوق، ${totalItems} منتج`}
                  className="p-2.5 rounded-xl bg-slate-900 text-white shadow-md relative flex items-center justify-center"
                >
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 bg-sky-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Middle Section: Integrated Header Live Search & Desktop Nav */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Header Live Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
                <input
                  type="text"
                  aria-label="البحث في منتجات المتجر"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (storePage !== "products" && storePage !== "home" && e.target.value.trim() !== "") {
                      setStorePage("products");
                    }
                  }}
                  placeholder="ابحث عن جهاز، سماعة، شاحن..."
                  className="w-full bg-slate-100/90 border border-slate-200/90 hover:border-sky-300 focus:border-sky-500 focus:bg-white rounded-xl py-2 pr-9 pl-7 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden transition shadow-2xs"
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="مسح البحث"
                    className="absolute top-1/2 -translate-y-1/2 left-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Floating Pill Nav (Desktop Only) */}
              <nav aria-label="التنقل الرئيسي في المتجر" className="hidden lg:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/90 text-xs font-bold">
                {[
                  { id: "home", label: "الرئيسية", icon: Zap },
                  { id: "products", label: "الأجهزة", icon: Box },
                  { id: "about", label: "عن المتجر", icon: Info },
                  { id: "contact", label: "الدعم", icon: MessageSquare }
                ].map((item) => {
                  const isActive = storePage === item.id;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStorePage(item.id as any)}
                      aria-current={isActive ? "page" : undefined}
                      className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 font-extrabold ${
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Desktop Actions Section: Contact hotline & Cart Trigger Pill */}
            <div className="hidden lg:flex items-center gap-2.5">
              {canonicalPhone && (
                <a 
                  href={`tel:${canonicalPhone}`}
                  className="p-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200/80 transition flex items-center gap-1.5 text-xs font-extrabold"
                  title="تواصل هاتفياً"
                >
                  <Phone className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden lg:inline">{canonicalPhone}</span>
                </a>
              )}

              <button
                type="button"
                onClick={(event) => openCart(event.currentTarget)}
                aria-label={`فتح سلة التسوق، ${totalItems} منتج`}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs transition shadow-md hover:shadow-lg flex items-center gap-2.5 border border-slate-800 group"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -left-2 bg-sky-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-900 shadow-2xs">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span>سلة التسوق</span>
                {cartTotal > 0 && (
                  <span className="bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md text-[11px] font-mono border border-sky-500/30">
                    {cartTotal} {config.currency || "ر.س"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>
      ) : (
        <ElegantEditorialHeader
          storeName={config.storeName || "متجر جديد"}
          logoUrl={config.logoUrl}
          categories={categories.filter((category) => category !== "الكل")}
          cartCount={totalItems}
          searchQuery={searchQuery}
          currentRoute={storePage === "home" || storePage === "products" || storePage === "about" ? storePage : undefined}
          tokens={{ surface: cardBgColor, ink: secondaryOnCard, mutedInk: effectiveTextColor, border: borderColor, accent: primaryOnWhite }}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => setStorePage("products")}
          onOpenHome={() => setStorePage("home")}
          onOpenProducts={() => setStorePage("products")}
          onOpenAbout={() => setStorePage("about")}
          onOpenCart={openCart}
          onSelectCategory={(category) => {
            setSelectedCategory(category);
            setStorePage("products");
          }}
        />
      )}


      {/* ------------------- PAGE CONTENTS RENDER ------------------- */}
      <div className="flex-1">

        {/* 1. HOME PAGE (الرئيسية) */}
        {/* 1. HOME PAGE (الرئيسية) */}
        {storePage === "home" && (
          <StorefrontHome
            config={config}
            isElegant={isElegant}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onOpenProducts={() => setStorePage("products")}
            onOpenAbout={() => setStorePage("about")}
            onSelectCategory={(category) => {
              setSelectedCategory(category);
              setStorePage("products");
            }}
            onOpenProduct={handleOpenProductProfile}
            onAddProduct={addToCart}
            onOpenMarketingTarget={openMarketingTarget}
          />
        )}
        {/* 2. PRODUCTS PAGE (المنتجات) */}
        {storePage === "products" && (
          <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4"
                 style={{ borderColor }}>
              <div className="text-right">
                <h2 data-storefront-products-heading className={`font-black text-xl ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryOnPage : undefined }}>
                  معرض جميع المنتجات المعروضة
                </h2>
                <p className="text-xs text-slate-500">استعرض المنتجات المنشورة في المتجر</p>
              </div>

              {/* Embedded Search Input */}
              <div className="relative w-full md:w-72">
                <input 
                  type="text" 
                  aria-label="البحث في كتالوج المنتجات"
                  placeholder="ابحث عن منتج بالاسم أو الوصف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pr-9 pl-4 py-2 rounded-xl text-xs border focus:outline-none transition ${
                    !isElegant ? "bg-white border-slate-300 focus:border-sky-500 text-slate-900 shadow-xs" : ""
                  }`}
                  style={{ 
                    backgroundColor: isElegant ? cardBgColor : undefined,
                    borderColor: isElegant ? borderColor : undefined,
                    color: isElegant ? secondaryOnCard : undefined
                  }}
                />
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} aria-label="مسح البحث" className="absolute left-3 top-2.5 text-xs text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filters Pills */}
            {categories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    data-storefront-category={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    aria-pressed={selectedCategory === cat}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition duration-200 shrink-0 ${
                      selectedCategory === cat ? "shadow-sm" : "hover:bg-slate-200/60"
                    }`}
                    style={{ 
                      backgroundColor: selectedCategory === cat ? (isElegant ? primaryColor : "#0284c7") : (isElegant ? "#f5efe6" : "#f1f5f9"),
                      color: selectedCategory === cat 
                        ? (isElegant ? primaryForeground : "#ffffff")
                        : (isElegant ? secondaryOnWarmSurface : "#334155")
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {displayedProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-16 text-center" style={{ backgroundColor: cardBgColor, borderColor }}>
                <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-semibold text-slate-500">لا توجد منتجات تطابق خياراتك حالياً</p>
                <button 
                  onClick={() => { setSelectedCategory("الكل"); setSearchQuery(""); }}
                  className="mt-3 text-xs text-sky-600 underline font-bold"
                >
                  إعادة ضبط عوامل التصفية
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                {displayedProducts.map((product) => <StorefrontProductCard key={product.id} product={product} currency={config.currency || "ر.س"} primaryColor={primaryColor} secondaryColor={secondaryColor} cardBackground={cardBgColor} borderColor={borderColor} onOpen={handleOpenProductProfile} onAdd={addToCart} showDescription reducedMotion={prefersReducedMotion} />)}
              </div>
            )}
          </div>
        )}

        {/* 3. ABOUT US PAGE (من نحن) */}
        {storePage === "about" && (
          <div className="mx-auto max-w-6xl space-y-7 px-4 py-10 text-right animate-fadeIn">
            <header className="space-y-2 border-b pb-6 text-center" style={{ borderColor }}>
              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-black" style={{ backgroundColor: cardBgColor, borderColor, color: readableAccent(primaryColor, cardBgColor) }}>من نحن</span>
              <h2 className="text-2xl font-black md:text-3xl" style={{ color: secondaryOnPage }}>{config.aboutTitle?.trim() || `عن ${config.storeName}`}</h2>
              <p className="mx-auto max-w-2xl text-sm leading-7" style={{ color: effectiveTextColor }}>{config.aboutText?.trim() || config.slogan}</p>
            </header>
            <div className={`grid gap-6 ${config.aboutImage ? "md:grid-cols-2 md:items-center" : ""}`}>
              {config.aboutImage && <img src={config.aboutImage} alt="" loading="lazy" decoding="async" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-video w-full rounded-3xl border object-cover" style={{ borderColor }} referrerPolicy="no-referrer" />}
              <div className="space-y-4">
                {config.aboutVision?.trim() && <section className="rounded-3xl border p-6" style={{ backgroundColor: cardBgColor, borderColor }}><h3 className="text-base font-black" style={{ color: readableAccent(primaryColor, cardBgColor) }}>رؤية المتجر</h3><p className="mt-3 text-sm leading-7" style={{ color: readableAccent(textColor, cardBgColor) }}>{config.aboutVision}</p></section>}
                <section className="rounded-3xl border p-6" style={{ backgroundColor: cardBgColor, borderColor }}><h3 className="text-base font-black" style={{ color: secondaryOnCard }}>بيانات منشورة</h3><div className="mt-3 space-y-2 text-xs" style={{ color: readableAccent(textColor, cardBgColor) }}>{config.address?.trim() && <p><strong>العنوان:</strong> {config.address}</p>}{config.workingHours?.trim() && <p><strong>ساعات العمل:</strong> {config.workingHours}</p>}{!config.address?.trim() && !config.workingHours?.trim() && <p>لم يضف المتجر معلومات إضافية بعد.</p>}</div></section>
              </div>
            </div>
          </div>
        )}
        {/* 4. CONTACT US PAGE (تواصل معنا) */}
        {storePage === "contact" && (() => {
          const phone = canonicalContactTarget(config.phone);
          const whatsapp = canonicalContactTarget(config.whatsapp);
          const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email?.trim() : null;
          const address = config.address?.trim() || null;
          const hours = config.workingHours?.trim() || null;
          const hasDirectContact = Boolean(phone || whatsapp || email || address || hours);
          return (
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-right animate-fadeIn">
              <header className="space-y-2 text-center">
                <span className="inline-flex rounded-full border px-3 py-1 text-xs font-black" style={{ backgroundColor: cardBgColor, borderColor, color: readableAccent(primaryColor, cardBgColor) }}>التواصل مع المتجر</span>
                <h2 className="text-2xl font-black" style={{ color: secondaryOnPage }}>اختر وسيلة التواصل المتاحة</h2>
                <p className="text-xs" style={{ color: effectiveTextColor }}>تعرض هذه الصفحة البيانات التي حفظها المتجر فقط، ولا تستقبل رسائل داخل المنصة.</p>
              </header>
              {hasDirectContact ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {phone && <a href={`tel:${phone}`} className="rounded-2xl border p-5" style={{ backgroundColor: cardBgColor, borderColor, color: secondaryOnCard }}><Phone className="mb-3 h-5 w-5" style={{ color: readableAccent(primaryColor, cardBgColor) }} /><h3 className="text-xs font-black">اتصال هاتفي</h3><p dir="ltr" className="mt-1 text-sm font-bold">{phone}</p></a>}
                  {whatsapp && <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><MessageSquare className="mb-3 h-5 w-5 text-emerald-600" /><h3 className="text-xs font-black">بدء محادثة WhatsApp</h3><p dir="ltr" className="mt-1 text-sm font-bold text-emerald-800">{whatsapp}</p></a>}
                  {email && <a href={`mailto:${email}`} className="rounded-2xl border p-5" style={{ backgroundColor: cardBgColor, borderColor, color: secondaryOnCard }}><Mail className="mb-3 h-5 w-5" style={{ color: readableAccent(primaryColor, cardBgColor) }} /><h3 className="text-xs font-black">البريد الإلكتروني</h3><p dir="ltr" className="mt-1 break-all text-sm">{email}</p></a>}
                  {address && <div className="rounded-2xl border p-5" style={{ backgroundColor: cardBgColor, borderColor, color: secondaryOnCard }}><MapPin className="mb-3 h-5 w-5" style={{ color: readableAccent(primaryColor, cardBgColor) }} /><h3 className="text-xs font-black">العنوان</h3><p className="mt-1 text-sm">{address}</p></div>}
                  {hours && <div className="rounded-2xl border p-5" style={{ backgroundColor: cardBgColor, borderColor, color: secondaryOnCard }}><Clock className="mb-3 h-5 w-5" style={{ color: readableAccent(primaryColor, cardBgColor) }} /><h3 className="text-xs font-black">ساعات العمل</h3><p className="mt-1 text-sm">{hours}</p></div>}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold" style={{ backgroundColor: cardBgColor, borderColor, color: readableAccent(textColor, cardBgColor) }}>لم يضف المتجر وسيلة تواصل مباشرة بعد.</div>
              )}
              {(config.instagram || config.twitter || config.tiktok || config.snapchat) && <div className="flex flex-wrap justify-center gap-2">{([["Instagram", config.instagram], ["X", config.twitter], ["TikTok", config.tiktok], ["Snapchat", config.snapchat]] as const).filter(([, value]) => Boolean(value?.trim())).map(([label, value]) => <span key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">{label}: @{value}</span>)}</div>}
            </div>
          );
        })()}

        {/* 5. PRODUCT PROFILE PAGE (بروفايل المنتج) */}
        {storePage === "product" && detailProduct && (
          <StorefrontProductDetail
            product={detailProduct}
            config={config}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            cartQuantity={cart.find((item) => item.product.id === detailProduct.id)?.quantity ?? 0}
            onBack={() => setStorePage("products")}
            onAdd={handleAddToCartWithQty}
          />
        )}
        {storePage === "product" && !detailProduct && (
          <section className="mx-auto my-10 max-w-lg rounded-3xl border border-dashed p-8 text-center" style={{ backgroundColor: cardBgColor, borderColor }} role="status">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
            <h1 className="mt-4 text-lg font-black text-slate-900">المنتج غير متاح</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">قد يكون المنتج أُلغي نشره أو لم يعد موجودًا في هذا المتجر.</p>
            <button type="button" onClick={() => setStorePage("products")} className="mt-5 min-h-11 rounded-xl px-5 py-3 text-xs font-black" style={{ backgroundColor: primaryColor, color: primaryForeground }}>العودة إلى المنتجات</button>
          </section>
        )}
        {/* 6. CHECKOUT PAGE (صفحة إتمام الطلب وتعبئة البيانات والدفع) */}
        {storePage === "checkout" && (() => {
          const customWalletsList = config.customWallets ?? [];

          const activeWallets = (config.enableEWallets === true ? customWalletsList : [])
            .filter((wallet) => wallet.active === true && Boolean(wallet.id.trim() && wallet.name.trim() && wallet.accountNumber.trim() && wallet.accountName?.trim()));

          const bankWallet = config.enableBankTransfer === true
            && Boolean(config.bankName?.trim())
            && Boolean(config.bankAccountName?.trim())
            && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim()) ? {
              id: "bank-transfer",
              name: config.bankName!.trim(),
              accountNumber: config.bankIban?.trim() ? `IBAN: ${config.bankIban.trim()}` : config.bankAccountNumber!.trim(),
              accountName: config.bankAccountName!.trim(),
              icon: "",
              badge: "تحويل بنكي",
              bgColor: "bg-slate-100 border-slate-300 text-slate-900",
            } : null;

          const WALLETS = [
            ...activeWallets.map((wallet) => ({ ...wallet, selectionKey: `wallet:${wallet.id}`, kind: "wallet" as const })),
            ...(bankWallet ? [{ ...bankWallet, selectionKey: "bank", kind: "bank" as const }] : [])
          ];
          const codAvailable = config.enableCashOnDelivery === true;
          const transferAvailable = WALLETS.length > 0;
          const effectivePaymentMethod = codAvailable && paymentMethod === "cod"
            ? "cod"
            : transferAvailable && paymentMethod === "wallet"
              ? "wallet"
              : codAvailable ? "cod" : "wallet";
          const effectiveWalletId = WALLETS.some((wallet) => wallet.selectionKey === selectedWallet) ? selectedWallet : WALLETS[0]?.selectionKey;

          const handleApplyCoupon = () => {
            const code = couponCode.trim().toUpperCase();
            if (!code) return;

            if (mode === "live") {
              setCouponDiscount(0);
              setCouponApplied(false);
              setCouponMessage("سيتم التحقق من القسيمة وحساب الخصم بدقة على الخادم عند إرسال الطلب.");
              return;
            }

            const allCoupons = config.customCoupons || [];

            const matched = allCoupons.find(c => (c.active !== false) && c.code.trim().toUpperCase() === code);

            if (matched) {
              const disc = previewPercentageDiscount(cartTotal, matched.discountPercent);
              setCouponDiscount(disc);
              setCouponApplied(true);
              setCouponMessage(`✓ تم تطبيق كود الخصم (${matched.code} - خصم ${matched.discountPercent}%) بنجاح! 🎉`);
            } else {
              setCouponDiscount(0);
              setCouponApplied(false);
              setCouponMessage("❌ كود الخصم غير صحيح أو منتهي الصلاحية");
            }
          };

          const previewTotals = calculatePreviewCheckout({
            subtotal: cartTotal,
            discount: couponDiscount,
            shippingFee: Number(config.shippingFee ?? 0),
            freeShippingThreshold: Number(config.freeShippingThreshold ?? 0),
            taxRate: Number(config.taxRate ?? 0),
            paymentFee: paymentMethod === "cod" ? Number(config.cashOnDeliveryFee ?? 0) : 0,
            minimum: Number(config.minOrderAmount ?? 0),
          });
          const shippingCost = previewTotals.shipping;
          const codFee = previewTotals.paymentFee;
          const tax = previewTotals.tax;
          const finalCheckoutTotal = previewTotals.total;

          const handlePlaceOrderSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!checkoutForm.fullName.trim() || !checkoutForm.phone.trim() || !checkoutForm.address.trim() || (config.requireEmail && !checkoutForm.email.trim())) {
              const firstMissingId = !checkoutForm.fullName.trim()
                ? "checkout-full-name"
                : !checkoutForm.phone.trim()
                  ? "checkout-phone"
                  : config.requireEmail && !checkoutForm.email.trim()
                    ? "checkout-email"
                    : "checkout-address";
              reportCheckoutError("يرجى تعبئة كافة الحقول المطلوبة (الاسم الكامل، رقم الجوال، والعنوان) للمتابعة.", firstMissingId);
              return;
            }
            setFormValidationErr("");

            const currentWallet = WALLETS.find(w => w.selectionKey === effectiveWalletId);
            if (!codAvailable && !transferAvailable) {
              reportCheckoutError("لا توجد وسيلة دفع مفعلة لهذا المتجر حالياً.");
              return;
            }
            if (paymentMethod === "wallet" && (!currentWallet || !transferRefNumber.trim())) {
              reportCheckoutError("أدخل رقم مرجع التحويل بعد تنفيذ العملية؛ سيبقى بانتظار تحقق المتجر.", "checkout-transfer-reference");
              return;
            }
            if (paymentMethod === "cod" && !codAvailable) {
              reportCheckoutError("الدفع عند الاستلام غير مفعّل لهذا المتجر. اختر وسيلة تحويل متاحة.", "checkout-payment-wallet");
              return;
            }
            if (mode === "preview" && !previewTotals.minimumMet) {
              reportCheckoutError(`الطلب أقل من الحد الأدنى المحفوظ (${Number(config.minOrderAmount ?? 0)} ${config.currency}).`);
              return;
            }
            if (mode === "live") {
              if (!submitOrder || orderSubmitting) return;
              if ((paymentMethod === "cod" && !codAvailable) || (paymentMethod === "wallet" && !currentWallet)) {
                reportCheckoutError("وسيلة الدفع المحددة غير مفعلة لهذا المتجر. اختر وسيلة متاحة قبل إرسال الطلب.", paymentMethod === "cod" ? "checkout-payment-wallet" : "checkout-payment-cod");
                return;
              }
              setOrderSubmitting(true);
              try {
                const payment = paymentMethod === "cod"
                  ? { method: "cod" as const }
                  : currentWallet?.kind === "bank"
                    ? { method: "bank_transfer" as const, reference: transferRefNumber || undefined }
                    : { method: "wallet" as const, channelId: currentWallet?.id, reference: transferRefNumber || undefined };
                const receipt = await submitOrder({
                  lines: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
                  couponCode: couponCode.trim() || undefined,
                  payment,
                  customer: {
                    name: checkoutForm.fullName.trim(),
                    phone: checkoutForm.phone.trim(),
                    email: checkoutForm.email.trim() || undefined,
                    notes: checkoutForm.notes.trim() || undefined,
                  },
                  address: {
                    city: checkoutForm.city.trim(),
                    area: checkoutForm.address.trim(),
                    details: checkoutForm.address.trim(),
                  },
                });
                const minor = (value: number) => value / 100;
                const orderObj = {
                  orderNum: receipt.number,
                  date: new Date(receipt.createdAt).toLocaleString("ar-SA"),
                  customer: { ...checkoutForm },
                  paymentMethod: receipt.paymentState === "due_on_delivery" ? "الدفع عند الاستلام" : "تحويل بانتظار التحقق",
                  walletName: paymentMethod === "wallet" ? currentWallet?.name : null,
                  walletAccount: paymentMethod === "wallet" ? currentWallet?.accountNumber : null,
                  transferRefNumber: paymentMethod === "wallet" ? transferRefNumber : null,
                  items: (receipt.items || []).map((item) => ({
                    product: { name: item.name, price: minor(item.unitPriceMinor) },
                    quantity: item.quantity,
                  })),
                  subtotal: minor(receipt.totals.itemsSubtotalMinor),
                  discount: minor(receipt.totals.discountMinor),
                  shipping: minor(receipt.totals.shippingMinor),
                  tax: minor(receipt.totals.taxMinor),
                  codFee: minor(receipt.totals.paymentFeeMinor),
                  total: minor(receipt.totals.grandTotalMinor),
                  currency: receipt.currencyCode,
                  presentation: receipt.checkoutPresentation,
                };
                setPlacedOrderDetails(orderObj);
                setOrderCompleted(true);
                handleCheckout();
              } catch (error) {
                reportCheckoutError(error instanceof Error ? error.message : "تعذر إرسال الطلب. حاول مرة أخرى.");
              } finally {
                setOrderSubmitting(false);
              }
              return;
            }

            const orderNum = `PREVIEW-${Math.floor(10000 + Math.random() * 90000)}`;

            const orderObj = {
              orderNum,
              date: new Date().toLocaleString("ar-SA"),
              customer: { ...checkoutForm },
              paymentMethod: paymentMethod === "cod" 
                ? `الدفع عند الاستلام / التوصيل 💵 ${codFee > 0 ? `(+${codFee} ${config.currency} رسوم COD)` : ''}`
                : `${currentWallet?.kind === "bank" ? "تحويل بنكي" : "محفظة إلكترونية"} (${currentWallet?.name})`,
              walletName: paymentMethod === "wallet" ? currentWallet?.name : null,
              walletAccount: paymentMethod === "wallet" ? currentWallet?.accountNumber : null,
              transferRefNumber: paymentMethod === "wallet" ? transferRefNumber.trim() : null,
              items: [...cart],
              subtotal: cartTotal,
              discount: couponDiscount,
              shipping: shippingCost,
              tax,
              codFee,
              total: finalCheckoutTotal,
              currency: config.currency || "ر.س",
              presentation: {
                title: config.thankYouTitle?.trim() || "تم استلام طلبك",
                message: config.thankYouMessage?.trim() || "احتفظ برقم الطلب للمتابعة مع المتجر.",
                whatsappTarget: config.enableWhatsAppNotification === true ? preferredContactTarget(config) : null,
              },
            };

            setPlacedOrderDetails(orderObj);
            setOrderCompleted(true);
            handleCheckout();
          };

          const handleCopyWalletNumber = (num: string) => {
            navigator.clipboard.writeText(num);
            setCopiedWalletNum(num);
            setTimeout(() => setCopiedWalletNum(null), 2500);
          };

          const handlePrintInvoice = (order: any) => {
            if (!order) return;
            const invoiceWindow = window.open("", "_blank", "width=800,height=900");
            if (!invoiceWindow) return;
            invoiceWindow.document.open();
            invoiceWindow.document.write(buildPrintableInvoiceHtml(order, config.storeName || "المتجر"));
            invoiceWindow.document.close();
          };

          const getWhatsAppInvoiceUrl = (order: any) => {
            const target = order?.presentation?.whatsappTarget;
            if (!target) return null;
            const items = order.items.map((item: any) => `${item.product.name} × ${item.quantity}`).join("\n");
            const message = `طلب ${order.orderNum}\n${items}\nالإجمالي: ${order.total} ${order.currency}`;
            return `https://wa.me/${target.slice(1)}?text=${encodeURIComponent(message)}`;
          };

          return (
            <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-fadeIn pb-16 text-right">
              <header className="space-y-2 text-center">
                <h2 id="storefront-checkout-title" tabIndex={-1} className="text-2xl font-black text-slate-900">{config.checkoutTitle?.trim() || "إتمام الطلب"}</h2>
                {config.checkoutSubtitle?.trim() && <p className="text-sm text-slate-600">{config.checkoutSubtitle}</p>}
                {config.checkoutNotice?.trim() && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">{config.checkoutNotice}</p>}
              </header>
              {/* Checkout Progress Stepper Bar */}
              <div className="flex items-center justify-between border-b pb-4 overflow-x-auto gap-2"
                   style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                <button
                  onClick={() => setStorePage("products")}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs hover:shadow-xs w-fit shrink-0 ${
                    !isElegant ? "bg-white border-slate-300 text-slate-800 hover:border-sky-400 font-mono" : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ borderColor: isElegant ? "#e5d5c5" : undefined }}
                >
                  <ArrowRight className="w-4 h-4 text-sky-600" />
                  <span>متابعة التسوق</span>
                </button>

                {/* Progress Badges */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold text-slate-600 shrink-0">
                  <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>1. السلة ({totalItems})</span>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${
                    !orderCompleted ? "bg-sky-500 text-white border-sky-600 font-black shadow-xs" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                  }`}>
                    <FileText className="w-3.5 h-3.5" />
                    <span>2. بيانات الدفع والشحن</span>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${
                    orderCompleted ? "bg-emerald-600 text-white border-emerald-700 font-black" : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                    <span>3. الفاتورة والتأكيد</span>
                  </div>
                </div>
              </div>

              {/* SUCCESS VIEW / ORDER COMPLETED RECEIPT */}
              {orderCompleted && placedOrderDetails ? (
                <div ref={receiptRef} tabIndex={-1} role="status" aria-live="polite" className="max-w-3xl mx-auto space-y-6 animate-fadeIn outline-none">
                  {/* Top Success Banner */}
                  <div className="p-6 md:p-8 rounded-3xl bg-emerald-900/90 text-white text-center space-y-3 shadow-xl border border-emerald-500/30">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
                      <Check className="w-10 h-10 stroke-[3]" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-black">{placedOrderDetails.presentation.title}</h2>
                    <p className="text-xs md:text-sm text-emerald-100 max-w-lg mx-auto leading-relaxed">{placedOrderDetails.presentation.message}</p>
                    <div className="inline-flex items-center gap-2 bg-emerald-950/80 px-4 py-2 rounded-xl text-xs font-mono text-emerald-300 border border-emerald-600/40">
                      <span>رقم المرجعية المعتمد:</span>
                      <strong className="text-white font-bold text-sm">{placedOrderDetails.orderNum}</strong>
                    </div>
                  </div>

                  {/* Printable Invoice Receipt Card */}
                  <div className={`p-6 md:p-8 rounded-3xl border shadow-lg space-y-6 text-slate-800 ${
                    !isElegant ? "bg-white border-slate-200" : "bg-stone-50"
                  }`}>
                    {/* Invoice Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md font-mono">
                          فاتورة طلب إلكترونية 🧾
                        </span>
                        <h3 className="text-lg font-black text-slate-900">{config.storeName}</h3>
                        <p className="text-xs text-slate-500">{placedOrderDetails.date}</p>
                      </div>

                      <div className="text-right sm:text-left space-y-1">
                        <span className="text-xs text-slate-500 block">حالة الطلب:</span>
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          قيد التجهيز والتوصيل ⏳
                        </span>
                      </div>
                    </div>

                    {/* Customer & Shipping Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs leading-relaxed">
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-sky-600" />
                          <span>بيانات العميل والتوصيل:</span>
                        </h4>
                        <p><strong>الاسم:</strong> {placedOrderDetails.customer.fullName}</p>
                        <p><strong>الجوال:</strong> <span className="font-mono">{placedOrderDetails.customer.phone}</span></p>
                        <p><strong>المدينة/المحافظة:</strong> {placedOrderDetails.customer.city}</p>
                        <p><strong>العنوان التفصيلي:</strong> {placedOrderDetails.customer.address}</p>
                        {placedOrderDetails.customer.notes && (
                          <p className="text-slate-500"><strong>ملاحظات:</strong> {placedOrderDetails.customer.notes}</p>
                        )}
                      </div>

                      <div className="space-y-1.5 border-t md:border-t-0 md:border-r md:pr-4 pt-3 md:pt-0 border-slate-200">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                          <span>طريقة الدفع المحددة:</span>
                        </h4>
                        <p className="font-bold text-slate-800">{placedOrderDetails.paymentMethod}</p>
                        {placedOrderDetails.walletName && (
                          <p><strong>المحفظة المختارة:</strong> {placedOrderDetails.walletName}</p>
                        )}
                        {placedOrderDetails.transferRefNumber && placedOrderDetails.transferRefNumber !== "غير محدد" && (
                          <p className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 w-fit font-mono font-bold">
                            رقم السند/الإشعار: {placedOrderDetails.transferRefNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ordered Items Table */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-slate-900">المنتجات المطلوبة:</h4>
                      <div className="divide-y divide-slate-200 border rounded-2xl overflow-hidden text-xs">
                        {placedOrderDetails.items.map((it: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 overflow-hidden border">
                                <ProductArt keyword={it.product.imageKeyword} primaryColor={primaryColor} imageUrl={it.product.imageUrl} alt={it.product.name} sizes="40px" />
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900">{it.product.name}</h5>
                                <span className="text-[11px] text-slate-500">الكمية: {it.quantity} × {it.product.price} {placedOrderDetails.currency}</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900">
                              {(parseFloat(it.product.price) * it.quantity).toLocaleString()} {placedOrderDetails.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total Summary */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>المجموع الفرعي:</span>
                        <span>{placedOrderDetails.subtotal} {placedOrderDetails.currency}</span>
                      </div>
                      {placedOrderDetails.discount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>الخصم المطبق:</span>
                          <span>- {placedOrderDetails.discount} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>رسوم الشحن:</span>
                        <span className="text-emerald-400 font-bold">
                          {placedOrderDetails.shipping === 0 ? "مجاني" : `${placedOrderDetails.shipping} ${placedOrderDetails.currency}`}
                        </span>
                      </div>
                      {placedOrderDetails.tax > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>الضريبة:</span>
                          <span>+ {placedOrderDetails.tax} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      {placedOrderDetails.codFee > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>رسوم الدفع عند الاستلام:</span>
                          <span>+ {placedOrderDetails.codFee} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-700">
                        <span>الإجمالي النهائي المستحق:</span>
                        <span className="text-sky-400 text-base">{placedOrderDetails.total} {placedOrderDetails.currency}</span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      {getWhatsAppInvoiceUrl(placedOrderDetails) && <a
                        href={getWhatsAppInvoiceUrl(placedOrderDetails)!}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                      >
                        <MessageSquare className="w-4 h-4 fill-white" />
                        <span>مشاركة تفاصيل الفاتورة عبر WhatsApp</span>
                      </a>}

                      <button
                        onClick={() => handlePrintInvoice(placedOrderDetails)}
                        className="w-full sm:w-auto py-3 px-4 min-h-[44px] rounded-xl border border-slate-300 hover:bg-slate-100 active:scale-95 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation shadow-2xs"
                      >
                        <Printer className="w-4 h-4 text-sky-600" />
                        <span>طباعة الفاتورة</span>
                      </button>

                      <button
                        onClick={() => {
                          setOrderCompleted(false);
                          setPlacedOrderDetails(null);
                          setStorePage("products");
                        }}
                        className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>طلب جديد</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : cart.length === 0 ? (
                /* EMPTY CART CHECKOUT WARNING */
                <div className="p-8 md:p-12 text-center rounded-3xl border bg-white space-y-4 max-w-lg mx-auto shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto text-sky-600">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">السلة فارغة حالياً!</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يرجى إضافة بعض المنتجات إلى سلة المشتريات أولاً للتمكن من تعبئة البيانات واختيار طريقة الدفع.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStorePage("products")}
                      className="py-3 px-5 rounded-xl text-white font-bold text-xs bg-slate-900 hover:bg-slate-800 shadow-md transition inline-flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
                    >
                      <span>استعراض معرض المنتجات 🛍️</span>
                    </button>

                  </div>
                </div>
              ) : (
                /* ACTIVE CHECKOUT FORM & PAYMENT SELECTION */
                <form onSubmit={handlePlaceOrderSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" aria-describedby={formValidationErr ? "checkout-error" : undefined}>
                  
                  {/* RIGHT / MAIN COLUMN: Form & Payment (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* SECTION 1: Customer & Delivery Info */}
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-4 shadow-sm ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <div className="w-8 h-8 rounded-xl bg-sky-500 text-white font-bold flex items-center justify-center text-xs shadow-2xs">1</div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">بيانات المشتري وعنوان التوصيل</h3>
                          <p className="text-[11px] text-slate-500">أدخل معلومات التواصل الدقيقة لتسهيل وصول الشحنة لك بسرعة.</p>
                        </div>
                      </div>

                      {formValidationErr && (
                        <div ref={checkoutErrorRef} id="checkout-error" role="alert" tabIndex={-1} className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-fadeIn outline-none">
                          <span>⚠️</span>
                          <span>{formValidationErr}</span>
                        </div>
                      )}

                      <div className="space-y-3.5">
                        {/* Full Name */}
                        <div className="space-y-1">
                          <label htmlFor="checkout-full-name" className="block text-xs font-extrabold text-slate-700">
                            الاسم الكامل الثلاثي <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            id="checkout-full-name"
                            name="name"
                            autoComplete="name"
                            required
                            aria-invalid={Boolean(formValidationErr && !checkoutForm.fullName.trim())}
                            aria-describedby={formValidationErr ? "checkout-error" : undefined}
                            placeholder="مثال: عبدالله محمد الشمري"
                            value={checkoutForm.fullName}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, fullName: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>

                        {/* Phone Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label htmlFor="checkout-phone" className="block text-xs font-extrabold text-slate-700">
                              رقم الجوال / الواتساب <span className="text-rose-500">*</span>
                            </label>
                            <input 
                              type="tel"
                              id="checkout-phone"
                              name="tel"
                              autoComplete="tel"
                              inputMode="tel"
                              required
                              aria-invalid={Boolean(formValidationErr && !checkoutForm.phone.trim())}
                              aria-describedby={formValidationErr ? "checkout-error" : undefined}
                              placeholder="0500000000 أو 770000000"
                              value={checkoutForm.phone}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                            />
                          </div>

                          {/* City / Governorate */}
                          <div className="space-y-1">
                            <label htmlFor="checkout-city" className="block text-xs font-extrabold text-slate-700">
                              المحافظة / المدينة <span className="text-rose-500">*</span>
                            </label>
                            <select
                              id="checkout-city"
                              name="address-level2"
                              autoComplete="address-level2"
                              value={checkoutForm.city}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition cursor-pointer"
                            >
                              <option value="صنعاء">صنعاء</option>
                              <option value="عدن">عدن</option>
                              <option value="تعز">تعز</option>
                              <option value="حضرموت (المكلا/سيئون)">حضرموت (المكلا/سيئون)</option>
                              <option value="إب">إب</option>
                              <option value="الحديدية">الحديدة</option>
                              <option value="المهرة">المهرة</option>
                              <option value="ذمار">ذمار</option>
                              <option value="الرياض">الرياض</option>
                              <option value="جدة">جدة</option>
                              <option value="مكة المكرمة">مكة المكرمة</option>
                              <option value="الدمام / الخبر">الدمام / الخبر</option>
                              <option value="مدينة أخرى">مدينة أخرى...</option>
                            </select>
                          </div>
                        </div>

                        {config.requireEmail && (
                          <div className="space-y-1">
                            <label htmlFor="checkout-email" className="block text-xs font-extrabold text-slate-700">
                              البريد الإلكتروني <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="email"
                              id="checkout-email"
                              name="email"
                              autoComplete="email"
                              inputMode="email"
                              required
                              aria-invalid={Boolean(formValidationErr && !checkoutForm.email.trim())}
                              aria-describedby={formValidationErr ? "checkout-error" : undefined}
                              value={checkoutForm.email}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                            />
                          </div>
                        )}

                        {/* Detailed Address */}
                        <div className="space-y-1">
                          <label htmlFor="checkout-address" className="block text-xs font-extrabold text-slate-700">
                            عنوان التسليم التفصيلي <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            id="checkout-address"
                            name="street-address"
                            autoComplete="street-address"
                            required
                            aria-invalid={Boolean(formValidationErr && !checkoutForm.address.trim())}
                            aria-describedby={formValidationErr ? "checkout-error" : undefined}
                            placeholder="اسم الشارع، الحي، المعلم الشهير القريب..."
                            value={checkoutForm.address}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>

                        {/* Delivery Notes */}
                        {config.enableCustomerNotes !== false && (
                        <div className="space-y-1">
                          <label htmlFor="checkout-notes" className="block text-xs font-extrabold text-slate-700">
                            ملاحظات اختيارية لمندوب التوصيل
                          </label>
                          <input 
                            type="text"
                            id="checkout-notes"
                            name="delivery-notes"
                            placeholder="مثال: يرجى الاتصال قبل الوصول بـ 15 دقيقة..."
                            value={checkoutForm.notes}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: Payment Method Selection */}
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-4 shadow-sm ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">2</div>
                        <div>
                          <h3 id="checkout-payment-heading" className="font-black text-sm text-slate-900">طريقة الدفع المناسبة</h3>
                          <p className="text-[11px] text-slate-500">اختر إما الدفع نقداً عند التوصيل أو عبر إحدى المحافظ الإلكترونية المتاحة.</p>
                        </div>
                      </div>

                      {/* Payment Mode Options (COD vs WALLET) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="checkout-payment-heading">
                        
                        {/* Option A: Cash on Delivery */}
                        {codAvailable && (<button
                          id="checkout-payment-cod"
                          type="button"
                          role="radio"
                          aria-checked={effectivePaymentMethod === "cod"}
                          tabIndex={effectivePaymentMethod === "cod" ? 0 : -1}
                          onKeyDown={handleRadioArrowNavigation}
                          onClick={() => setPaymentMethod("cod")}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition relative space-y-2 text-right ${
                            paymentMethod === "cod"
                              ? "border-sky-500 bg-sky-50/50 ring-2 ring-sky-400/30"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <CreditCard className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              الدفع عند الاستلام
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-xs text-slate-900">الدفع عند التوصيل / الاستلام</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              تسليم مبلغ الشحنة نقداً لمندوب التوصيل عند استلام واستكشاف منتجاتك بنفسك.
                            </p>
                          </div>
                        </button>)}

                        {/* Option B: E-Wallets */}
                        {transferAvailable && (<button
                          id="checkout-payment-wallet"
                          type="button"
                          role="radio"
                          aria-checked={effectivePaymentMethod === "wallet"}
                          tabIndex={effectivePaymentMethod === "wallet" ? 0 : -1}
                          onKeyDown={handleRadioArrowNavigation}
                          onClick={() => setPaymentMethod("wallet")}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition relative space-y-2 text-right ${
                            paymentMethod === "wallet"
                              ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-400/30"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Wallet className="h-5 w-5 text-purple-700" aria-hidden="true" />
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                              محافظ رقمية
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-xs text-slate-900">الدفع عبر المحافظ الإلكترونية</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">استخدم فقط الحساب أو المحفظة التي فعّلها هذا المتجر.</p>
                          </div>
                        </button>)}
                      </div>

                      {!codAvailable && !transferAvailable && (
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
                          لا توجد وسيلة دفع مفعلة لهذا المتجر حالياً. تواصل مع المتجر قبل إرسال الطلب.
                        </div>
                      )}

                      {/* E-WALLET SELECTION SUB-PANEL */}
                      {paymentMethod === "wallet" && transferAvailable && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fadeIn">
                          <div className="space-y-1">
                            <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                              <Wallet className="w-4 h-4 text-emerald-600" />
                              <span>اختر المحفظة الإلكترونية لإرسال الحوالة:</span>
                            </h4>
                            <p className="text-[11px] text-slate-500">قم بتحويل المبلغ الموضح في ملخص الطلب إلى إحدى المحافظ التالية:</p>
                          </div>

                          {/* Wallets Selector Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="حساب التحويل">
                            {WALLETS.map((w) => {
                              const isSelected = effectiveWalletId === w.selectionKey;
                              return (
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  tabIndex={isSelected ? 0 : -1}
                                  onKeyDown={handleRadioArrowNavigation}
                                  key={w.selectionKey}
                                  onClick={() => setSelectedWallet(w.selectionKey)}
                                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 text-right ${
                                    isSelected 
                                      ? "border-emerald-600 bg-white shadow-xs ring-1 ring-emerald-500" 
                                      : "border-slate-200 bg-white/80 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{w.icon}</span>
                                    <div>
                                      <h5 className="font-bold text-xs text-slate-900">{w.name}</h5>
                                      <span className="text-[10px] text-slate-500 block font-mono">{w.accountNumber}</span>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>

                          {/* Selected Wallet Information Box */}
                          {(() => {
                            const activeW = WALLETS.find(w => w.selectionKey === effectiveWalletId) || WALLETS[0];
                            if (!activeW) return null;
                            return (
                              <div className={`p-4 rounded-xl border space-y-3 ${activeW.bgColor}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black">{activeW.name}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border border-current">
                                    {activeW.badge}
                                  </span>
                                </div>

                                <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-slate-500 block">رقم الحساب / المحفظة المعتمد:</span>
                                    <strong className="text-sm font-mono text-slate-900 select-all">{activeW.accountNumber}</strong>
                                    <span className="text-[10px] text-slate-500 block">باسم: {activeW.accountName}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyWalletNumber(activeW.accountNumber)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center gap-1 hover:bg-slate-800 transition shrink-0 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{copiedWalletNum === activeW.accountNumber ? "تم النسخ ✓" : "نسخ الرقم"}</span>
                                  </button>
                                </div>

                                {/* Transaction Ref / Receipt Number Input */}
                                <div className="space-y-1.5 pt-1">
                                  <label htmlFor="checkout-transfer-reference" className="block text-xs font-bold text-slate-800">
                                    رقم السند المالي / إشعار الحوالة (بعد التحويل)
                                  </label>
                                  <input 
                                    type="text"
                                    id="checkout-transfer-reference"
                                    name="transaction-reference"
                                    required
                                    aria-invalid={Boolean(formValidationErr && paymentMethod === "wallet" && !transferRefNumber.trim())}
                                    aria-describedby={formValidationErr ? "checkout-error" : undefined}
                                    maxLength={200}
                                    placeholder="رقم مرجع التحويل أو الإيداع"
                                    value={transferRefNumber}
                                    onChange={(e) => setTransferRefNumber(e.target.value)}
                                    className="w-full border rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 bg-white border-slate-300 focus:outline-none focus:border-emerald-600"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LEFT / SIDEBAR COLUMN: Order Summary & Confirmation (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-5 sticky top-20 shadow-md ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-sky-600" />
                          <span>ملخص طلب المشتريات</span>
                        </h3>
                        <span className="text-xs font-bold text-slate-500">{totalItems} قطع</span>
                      </div>

                      {/* Items List */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
                        {cart.map((item) => (
                          <div key={item.product.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 overflow-hidden border border-slate-200">
                                <ProductArt keyword={item.product.imageKeyword} primaryColor={primaryColor} imageUrl={item.product.imageUrl} alt={item.product.name} sizes="48px" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 truncate">{item.product.name}</h4>
                                <span className="text-[11px] text-slate-500">العدد: {item.quantity} × {item.product.price} {config.currency}</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {(parseFloat(String(item.product.price)) * item.quantity).toLocaleString()} {config.currency}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Coupon Discount Code Box */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="block text-[11px] font-bold text-slate-600">كود الخصم (كوبون):</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="أدخل كود الخصم"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="flex-1 border rounded-xl px-3 py-1.5 text-xs uppercase font-mono font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
                          >
                            تطبيق
                          </button>
                        </div>
                        {couponMessage && (
                          <p className={`text-[10px] font-bold ${couponApplied ? "text-emerald-600" : "text-rose-600"}`}>
                            {couponMessage}
                          </p>
                        )}
                      </div>

                      {/* Financial Breakdown */}
                      <div className="space-y-2 pt-3 border-t border-slate-200 text-xs font-bold">
                        {mode === "live" && (
                          <p className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-800">
                            الأرقام النهائية، الخصم، الضريبة والشحن يحسبها الخادم وتظهر في الإيصال بعد الإرسال.
                          </p>
                        )}
                        {mode !== "live" && <>
                        <div className="flex justify-between text-slate-600">
                          <span>المجموع الفرعي:</span>
                          <span className="font-mono">{cartTotal} {config.currency}</span>
                        </div>

                        {tax > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>الضريبة:</span>
                            <span className="font-mono">+ {tax.toFixed(2)} {config.currency}</span>
                          </div>
                        )}

                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>خصم الكوبون:</span>
                            <span className="font-mono">- {couponDiscount} {config.currency}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600">
                          <span>رسوم الشحن والتوصيل:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {shippingCost === 0 ? "مجاني" : `${shippingCost} ${config.currency}`}
                          </span>
                        </div>

                        {paymentMethod === "cod" && codFee > 0 && (
                          <div className="flex justify-between text-amber-700">
                            <span>رسوم الدفع عند الاستلام (COD):</span>
                            <span className="font-mono">+{codFee} {config.currency}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                          <span>المجموع الكلي النهائي:</span>
                          <span className="text-sky-700 text-base font-mono">
                            {finalCheckoutTotal.toFixed(2)} {config.currency}
                          </span>
                        </div>
                        </>}
                      </div>

                      {/* Submit Order Button */}
                      <button
                        type="submit"
                        disabled={orderSubmitting || (!codAvailable && !transferAvailable)}
                        aria-describedby={formValidationErr ? "checkout-error" : undefined}
                        className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] ${
                          !isElegant ? "bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-mono shadow-sky-600/20" : "hover:opacity-90"
                        }`}
                        style={{ backgroundColor: isElegant ? primaryColor : undefined, color: isElegant ? primaryForeground : undefined }}
                      >
                        <span>{orderSubmitting ? "جارٍ تثبيت السعر وحجز المخزون..." : mode === "live" ? "تأكيد الطلب بالسعر الخادمي" : "معاينة إرسال الطلب"}</span>
                        <Check className="w-5 h-5 stroke-[3]" />
                      </button>

                      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>تُعالج بيانات الطلب وفق ضوابط حماية النظام</span>
                      </p>
                    </div>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

      </div>

      <StorefrontFooter
        config={config}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        cardBackground={cardBgColor}
        borderColor={borderColor}
        attribution={platformSettings.storefrontAttributionEnabled ? platformSettings.storefrontAttributionText : null}
        onNavigate={(page) => setStorePage(page)}
      />
      </div>

      {/* ----------------- SHOPPING CART DRAWER ----------------- */}
      <AnimatePresence onExitComplete={handleCartExitComplete}>
        {isCartDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs" data-storefront-cart-overlay>
            {/* Click outside to close */}
            <button type="button" className="absolute inset-0 cursor-default" onClick={() => closeCart()} aria-label="إغلاق سلة التسوق" tabIndex={-1} />

            <motion.div
              ref={cartDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="storefront-cart-title"
              tabIndex={-1}
              initial={prefersReducedMotion ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: prefersReducedMotion ? 0 : "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
              className={`w-full max-w-md h-[100dvh] max-h-[100dvh] flex flex-col justify-between shadow-2xl relative z-10 text-right ${
                !isElegant ? "bg-white border-r border-slate-200 text-slate-900 font-mono" : ""
              }`}
              style={{ 
                backgroundColor: isElegant ? bgColor : undefined,
                color: isElegant ? effectiveTextColor : undefined
              }}
            >
              {/* Drawer Header */}
              <div 
                className="p-5 flex items-center justify-between border-b"
                style={{ borderColor }}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-sky-600" />
                  <span id="storefront-cart-title" className={`font-extrabold text-base ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryOnCard : undefined }}>
                    {!isElegant ? `سلة المشتريات [CART: ${totalItems}]` : `سلة التسوق (${totalItems} قطع)`}
                  </span>
                </div>
                <button 
                  ref={cartCloseButtonRef}
                  type="button"
                  onClick={() => closeCart()}
                  aria-label="إغلاق سلة التسوق"
                  className={`min-h-11 min-w-11 p-2.5 rounded-full hover:bg-slate-200/60 ${!isElegant ? "text-slate-600 hover:text-sky-600 hover:bg-sky-50" : ""}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body - Items list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {hasOrdered ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 border border-emerald-300 rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-8 h-8" />
                    </div>
                    <h3 className="font-extrabold text-xl text-emerald-700">ORDER_TRANSMITTED // تم إرسال الطلب بنجاح!</h3>
                    <p className="text-slate-600 text-xs max-w-xs leading-relaxed">
                      شكراً لتجربتك لمتجرنا! لقد تم إرسال الطلب الوهمي وتفريغ السلة لمحاكاة الشراء الحقيقي لمتجرك الجديد بنجاح.
                    </p>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                    <ShoppingBag className="w-16 h-16 text-slate-400" />
                    <h4 className="font-bold text-sm text-slate-700">{!isElegant ? "CART_EMPTY // السلة فارغة" : "سلتك فارغة حالياً"}</h4>
                    <p className="text-xs text-slate-500 max-w-xs">أضف المنتجات من المعرض لتجربة دورة الشراء الكاملة والتحقق من حساب التكلفة.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {cart.map((item) => {
                      const atStockLimit = item.quantity >= storefrontCartLineLimit(item.product);
                      return (
                      <div 
                        key={item.product.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          !isElegant ? "bg-slate-50 border-slate-200" : ""
                        }`}
                        style={{ 
                          backgroundColor: isElegant ? cardBgColor : undefined,
                          borderColor: isElegant ? borderColor : undefined
                        }}
                      >
                        {/* Artwork */}
                        <div className="w-12 h-12 bg-white p-1 rounded-lg border shrink-0">
                          <ProductArt keyword={item.product.imageKeyword} primaryColor={primaryColor} imageUrl={item.product.imageUrl} alt={item.product.name} sizes="48px" />
                        </div>

                        {/* Name and Price */}
                        <div className="flex-1 min-w-0 text-right">
                          <h4 className={`font-bold text-xs truncate ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryOnCard : undefined }}>
                            {item.product.name}
                          </h4>
                          <span className={`text-[11px] font-bold ${!isElegant ? "text-sky-700" : ""}`} style={{ color: isElegant ? primaryOnWhite : undefined }}>
                            {item.product.price} {config.currency}
                          </span>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 border rounded-lg bg-white shrink-0"
                             style={{ borderColor: isElegant ? borderColor : "#cbd5e1" }}>
                          <button 
                            type="button"
                            disabled={atStockLimit}
                            onClick={() => updateQuantity(item.product.id, 1)}
                            aria-label={`زيادة كمية ${item.product.name}`}
                            className="p-1 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title={atStockLimit ? "وصلت إلى الكمية المتاحة" : undefined}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center text-slate-800">{item.quantity}</span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            aria-label={`تقليل كمية ${item.product.name}`}
                            className="p-1 hover:text-rose-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              {!hasOrdered && cart.length > 0 && (
                <div 
                  className="p-5 border-t space-y-4 [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]"
                  style={{ borderColor }}
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="text-slate-600">المجموع الفرعي:</span>
                    <span className={`text-lg ${!isElegant ? "text-sky-700 font-mono font-black" : ""}`} style={{ color: isElegant ? primaryOnWhite : undefined }}>
                      {cartTotal} {config.currency}
                    </span>
                  </div>

                  <div className={`space-y-2 text-xs p-3 rounded-xl border ${
                    !isElegant ? "bg-sky-50 border-sky-200 text-sky-900 font-mono" : "bg-slate-400/5 text-slate-500"
                  }`}>
                    <p>* الشحن والضريبة: تظهر قيمهما النهائية في صفحة إتمام الطلب.</p>
                    <p>* الدفع: تظهر فقط الوسائل التي فعّلها المتجر ببيانات مكتملة.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStorePage("checkout");
                      closeCart("checkout");
                      const container = document.getElementById("store-preview-scroll-container");
                      if (container && typeof container.scrollTo === "function") {
                        container.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
                      }
                    }}
                    className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] ${
                      !isElegant ? "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 font-mono shadow-sm" : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: isElegant ? primaryColor : undefined, color: isElegant ? primaryForeground : undefined }}
                  >
                    <span>{!isElegant ? "المتابعة لإتمام الطلب والدفع" : "إتمام الطلب وتعبئة البيانات"}</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Mobile Sticky Bottom Dock Navigation Bar */}
      <nav 
        aria-label="التنقل السريع في المتجر"
        aria-hidden={isCartModalPresent ? "true" : undefined}
        inert={isCartModalPresent ? true : undefined}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl border-t pt-1.5 px-3 flex items-center justify-around shadow-2xl touch-manipulation [padding-bottom:max(0.375rem,env(safe-area-inset-bottom))]"
        style={{
          backgroundColor: cardBgColor,
          borderColor: borderColor
        }}
      >
        {[
          { id: "home", label: "الرئيسية", icon: Home },
          { id: "products", label: "المنتجات", icon: ShoppingBag },
          { id: "about", label: "عن المتجر", icon: Info },
          { id: "contact", label: "الدعم", icon: Phone }
        ].map((item) => {
          const isActive = storePage === item.id;
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStorePage(item.id as any);
                const container = document.getElementById("store-preview-scroll-container");
                if (container) {
                  container.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
                }
              }}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 sm:px-3 py-1.5 min-h-[48px] rounded-xl transition text-[10px] font-extrabold cursor-pointer active:scale-90 ${
                isActive
                  ? !isElegant ? "text-sky-600 font-black scale-105" : "text-amber-800 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <IconComp className={`w-5 h-5 ${isActive ? (!isElegant ? "text-sky-600" : "text-amber-700") : "text-slate-500"}`} />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={(event) => openCart(event.currentTarget)}
          aria-label={`فتح سلة التسوق، ${totalItems} منتج`}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 sm:px-3 py-1.5 min-h-[48px] rounded-xl text-slate-500 hover:text-slate-900 text-[10px] font-extrabold relative cursor-pointer active:scale-90"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-slate-700" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-sky-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                {totalItems}
              </span>
            )}
          </div>
          <span>السلة</span>
        </button>
      </nav>
    </div>
  );
}
