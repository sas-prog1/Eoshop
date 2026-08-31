import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import StorePreview from "../../src/components/StorePreview";
import { ELEGANT_PRESET, type Product, type StoreConfig } from "../../src/types";
import { addProductToCart, changeCartLineQuantity, type CartLine } from "../../src/workflows/orderState";

const products: Product[] = [
  {
    id: "checkout-bag",
    status: "published",
    name: "حقيبة جلدية بتفاصيل هادئة",
    price: 420,
    description: "حقيبة يومية مصنوعة من جلد طبيعي.",
    category: "حقائب",
    imageKeyword: "bag",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=86",
    manageStock: true,
    stockQuantity: 8,
    availableQuantity: 8,
  },
  {
    id: "checkout-perfume",
    status: "published",
    name: "عطر بلانشه الاستثنائي",
    price: 310,
    description: "تركيبة عطرية متوازنة بنفحات نظيفة.",
    category: "عطور",
    imageKeyword: "perfume",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=86",
    manageStock: true,
    stockQuantity: 12,
    availableQuantity: 12,
  },
];

const config: StoreConfig = {
  ...ELEGANT_PRESET,
  storeName: "فيلور",
  currency: "ر.س",
  primaryColor: "#7C3F2D",
  secondaryColor: "#1C1917",
  textColor: "#57534E",
  bgColor: "#FBFAF7",
  cardBgColor: "#FFFFFF",
  borderColor: "#E8E4DE",
  products,
  checkoutTitle: "أكمل طلبك بهدوء",
  checkoutSubtitle: "راجع بيانات التوصيل واختر وسيلة الدفع التي فعّلها المتجر.",
  enableCashOnDelivery: true,
  cashOnDeliveryFee: 0,
  enableBankTransfer: true,
  bankName: "بنك المتجر",
  bankAccountName: "متجر فيلور",
  bankIban: "YE00 0000 0000 0000 0000",
  enableEWallets: false,
  requireEmail: false,
  enableCustomerNotes: true,
  shippingFee: 25,
  freeShippingThreshold: 500,
  taxRate: 0,
};

function CheckoutPreview() {
  const [cart, setCart] = useState<CartLine[]>([
    { product: products[0], quantity: 1 },
    { product: products[1], quantity: 1 },
  ]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [category, setCategory] = useState("الكل");

  return (
    <StorePreview
      config={config}
      cart={cart}
      addToCart={(product, quantity = 1) => setCart((current) => addProductToCart(current, product, quantity).items)}
      updateQuantity={(productId, amount) => setCart((current) => changeCartLineQuantity(current, productId, amount).items)}
      calculateTotal={() => undefined}
      isCartDrawerOpen={drawerOpen}
      setIsCartDrawerOpen={setDrawerOpen}
      hasOrdered={false}
      handleCheckout={() => undefined}
      selectedCategory={category}
      setSelectedCategory={setCategory}
      externalPage="checkout"
      mode="preview"
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CheckoutPreview />
  </React.StrictMode>,
);
