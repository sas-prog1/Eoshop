import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import StorefrontProductDetail from "../../src/components/StorefrontProductDetail";
import {
  ElegantCatalog,
  ElegantEditorialHeader,
} from "../../src/features/storefront/elegant-stories";
import { ELEGANT_PRESET, type Product, type StoreConfig } from "../../src/types";

const products: Product[] = [
  { id: "e1", status: "published", name: "حقيبة جلدية بتفاصيل هادئة", price: 420, description: "حقيبة يومية مصنوعة من جلد طبيعي، بمقصورة داخلية عملية وحزام قابل للتعديل.", category: "حقائب", imageKeyword: "bag", imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 8, availableQuantity: 8 },
  { id: "e2", status: "published", name: "عطر بلانشه الاستثنائي", price: 310, description: "تركيبة عطرية متوازنة بنفحات نظيفة من المسك والزهور البيضاء للاستخدام اليومي.", category: "عطور", imageKeyword: "perfume", imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 12, availableQuantity: 12 },
  { id: "e3", status: "published", name: "نظارة بإطار أسود كلاسيكي", price: 165, description: "إطار خفيف وعدسات واقية بتصميم يجمع بين الخطوط الكلاسيكية والحضور العصري.", category: "نظارات", imageKeyword: "sunglasses", imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 5, availableQuantity: 5 },
  { id: "e4", status: "published", name: "مزهرية حجرية منحوتة", price: 225, description: "قطعة ديكور بملمس حجري ناعم وتكوين بسيط يضيف نقطة تركيز راقية للمساحة.", category: "المنزل", imageKeyword: "vase", imageUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 4, availableQuantity: 4 },
  { id: "e5", status: "published", name: "ساعة مينيمال بحزام جلدي", price: 540, description: "ساعة أنيقة بواجهة واضحة وحزام جلد طبيعي، مصممة لترافق الإطلالات الرسمية واليومية.", category: "ساعات", imageKeyword: "watch", imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 6, availableQuantity: 6 },
  { id: "e6", status: "published", name: "حذاء رياضي أبيض بتفاصيل ناعمة", price: 360, description: "حذاء خفيف بنعل مرن وبنية مريحة للمشي اليومي، مع خامات سهلة العناية.", category: "أحذية", imageKeyword: "shoes", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 10, availableQuantity: 10 },
  { id: "e7", status: "published", name: "مجموعة عناية يومية", price: 285, description: "ثلاث خطوات أساسية للعناية اليومية بتركيبات لطيفة وقوام سريع الامتصاص.", category: "الجمال", imageKeyword: "skincare", imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 9, availableQuantity: 9 },
  { id: "e8", status: "published", name: "كرسي استرخاء بقماش طبيعي", price: 790, description: "كرسي مريح بخطوط مستديرة وقماش محايد، مناسب لزوايا القراءة والمساحات الهادئة.", category: "المنزل", imageKeyword: "chair", imageUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1000&q=86", manageStock: true, stockQuantity: 2, availableQuantity: 2 },
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
  enableCashOnDelivery: true,
  freeShippingThreshold: 500,
};

function Preview() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartCount, setCartCount] = useState(2);
  const categories = useMemo(() => ["الكل", ...new Set(products.map((product) => product.category))], []);
  const displayedProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "الكل" || product.category === category;
    const needle = search.trim().toLocaleLowerCase("ar");
    return matchesCategory && (!needle || `${product.name} ${product.description}`.toLocaleLowerCase("ar").includes(needle));
  }), [category, search]);

  return (
    <div style={{ minHeight: "100vh", background: config.bgColor }}>
      <ElegantEditorialHeader
        storeName={config.storeName}
        categories={categories.filter((item) => item !== "الكل").slice(0, 5)}
        cartCount={cartCount}
        searchQuery={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => setSelectedProduct(null)}
        onOpenHome={() => window.location.assign("/prototypes/elegant-stories/")}
        onOpenProducts={() => setSelectedProduct(null)}
        onOpenAbout={() => undefined}
        onOpenCart={() => undefined}
        onSelectCategory={(value) => { setCategory(value); setSelectedProduct(null); }}
      />

      {selectedProduct ? (
        <StorefrontProductDetail
          product={selectedProduct}
          config={config}
          primaryColor={config.primaryColor}
          secondaryColor={config.secondaryColor}
          onBack={() => setSelectedProduct(null)}
          onAdd={(_, quantity) => setCartCount((count) => count + quantity)}
        />
      ) : (
        <ElegantCatalog
          products={displayedProducts}
          categories={categories}
          selectedCategory={category}
          searchQuery={search}
          currency={config.currency}
          primaryColor={config.primaryColor}
          secondaryColor={config.secondaryColor}
          textColor={config.textColor}
          backgroundColor={config.bgColor}
          cardBackground={config.cardBgColor}
          borderColor={config.borderColor}
          onSearchChange={setSearch}
          onSelectCategory={setCategory}
          onReset={() => { setCategory("الكل"); setSearch(""); }}
          onOpen={setSelectedProduct}
          onAdd={() => setCartCount((count) => count + 1)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
);
