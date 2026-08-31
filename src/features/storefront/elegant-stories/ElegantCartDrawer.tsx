import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import ProductArt from "../../../components/ProductArt";
import type { CartLine } from "../../../workflows/orderState";
import { storefrontCartLineLimit } from "../../../workflows/orderState";

interface ElegantCartDrawerProps {
  cart: CartLine[];
  totalItems: number;
  subtotal: number;
  currency: string;
  primaryColor: string;
  primaryForeground: string;
  pageBackground: string;
  cardBackground: string;
  borderColor: string;
  inkColor: string;
  mutedInkColor: string;
  prefersReducedMotion: boolean;
  hasOrdered: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onQuantityChange: (productId: string, amount: number) => void;
  onCheckout: () => void;
}

export default function ElegantCartDrawer({
  cart,
  totalItems,
  subtotal,
  currency,
  primaryColor,
  primaryForeground,
  pageBackground,
  cardBackground,
  borderColor,
  inkColor,
  mutedInkColor,
  prefersReducedMotion,
  hasOrdered,
  dialogRef,
  closeButtonRef,
  onClose,
  onQuantityChange,
  onCheckout,
}: ElegantCartDrawerProps) {
  return (
    <div
      className="elegant-cart-overlay"
      data-storefront-cart-overlay
      style={{ "--elegant-cart-accent": primaryColor } as React.CSSProperties}
    >
      <button
        type="button"
        className="elegant-cart-overlay__dismiss"
        onClick={onClose}
        aria-label="إغلاق سلة التسوق"
        tabIndex={-1}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="storefront-cart-title"
        tabIndex={-1}
        initial={prefersReducedMotion ? false : { x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: prefersReducedMotion ? 0 : "100%" }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 27, stiffness: 210 }}
        className="elegant-cart h-[100dvh] max-h-[100dvh]"
        style={{ backgroundColor: pageBackground, color: inkColor, borderColor }}
      >
        <header className="elegant-cart__header" style={{ borderColor }}>
          <div className="elegant-cart__heading">
            <span>مراجعة اختياراتك</span>
            <div>
              <h2 id="storefront-cart-title">سلة التسوق</h2>
              <strong style={{ backgroundColor: primaryColor, color: primaryForeground }}>
                {totalItems} {totalItems === 1 ? "قطعة" : "قطع"}
              </strong>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق سلة التسوق"
            className="elegant-cart__close"
            style={{ borderColor, color: inkColor }}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="elegant-cart__body">
          {hasOrdered ? (
            <section className="elegant-cart-state" aria-live="polite">
              <span className="elegant-cart-state__icon elegant-cart-state__icon--success">
                <Check aria-hidden="true" />
              </span>
              <p>تم إرسال الطلب</p>
              <h3>وصل طلبك إلى المتجر بنجاح.</h3>
              <span style={{ color: mutedInkColor }}>يمكنك إغلاق السلة والعودة لتصفح المنتجات.</span>
            </section>
          ) : cart.length === 0 ? (
            <section className="elegant-cart-state">
              <span className="elegant-cart-state__icon" style={{ borderColor, color: primaryColor }}>
                <ShoppingBag aria-hidden="true" />
              </span>
              <p>سلتك جاهزة لاختياراتك</p>
              <h3>لم تضف أي منتج بعد.</h3>
              <span style={{ color: mutedInkColor }}>تصفح المجموعة وأضف القطع التي ترغب في طلبها.</span>
              <button type="button" onClick={onClose} style={{ color: inkColor, borderColor }}>
                متابعة التسوق
                <ArrowLeft aria-hidden="true" />
              </button>
            </section>
          ) : (
            <ol className="elegant-cart__items" aria-label="منتجات سلة التسوق">
              {cart.map((item) => {
                const atStockLimit = item.quantity >= storefrontCartLineLimit(item.product);
                return (
                  <li key={item.product.id} className="elegant-cart-line" style={{ backgroundColor: cardBackground, borderColor }}>
                    <div className="elegant-cart-line__image" style={{ borderColor }}>
                      <ProductArt
                        keyword={item.product.imageKeyword}
                        primaryColor={primaryColor}
                        imageUrl={item.product.imageUrl}
                        alt={item.product.name}
                        sizes="96px"
                      />
                    </div>

                    <div className="elegant-cart-line__content">
                      <span style={{ color: mutedInkColor }}>{item.product.category || "من المجموعة"}</span>
                      <h3>{item.product.name}</h3>
                      <strong style={{ color: inkColor }}>{item.product.price} {currency}</strong>
                    </div>

                    <div className="elegant-cart-line__quantity" style={{ borderColor }} aria-label={`كمية ${item.product.name}`}>
                      <button
                        type="button"
                        disabled={atStockLimit}
                        onClick={() => onQuantityChange(item.product.id, 1)}
                        aria-label={`زيادة كمية ${item.product.name}`}
                        title={atStockLimit ? "وصلت إلى الكمية المتاحة" : undefined}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(item.product.id, -1)}
                        aria-label={`تقليل كمية ${item.product.name}`}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {!hasOrdered && cart.length > 0 ? (
          <footer className="elegant-cart__footer" style={{ backgroundColor: cardBackground, borderColor }}>
            <div className="elegant-cart__summary">
              <div>
                <span style={{ color: mutedInkColor }}>المجموع الفرعي</span>
                <small style={{ color: mutedInkColor }}>قبل الشحن والرسوم إن وجدت</small>
              </div>
              <strong>{subtotal} <small>{currency}</small></strong>
            </div>

            <p style={{ color: mutedInkColor }}>
              تظهر رسوم الشحن ووسائل الدفع المتاحة في الخطوة التالية وفق إعدادات المتجر.
            </p>

            <button
              type="button"
              onClick={onCheckout}
              className="elegant-cart__checkout"
              style={{ backgroundColor: primaryColor, color: primaryForeground }}
            >
              <span>إتمام الطلب وتعبئة البيانات</span>
              <ArrowLeft aria-hidden="true" />
            </button>
          </footer>
        ) : null}
      </motion.div>
    </div>
  );
}
