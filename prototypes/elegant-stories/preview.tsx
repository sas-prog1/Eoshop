import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import {
  ElegantEditorialHeader,
  ElegantStoriesHome,
  type ElegantDiscoveryViewModel,
  type ElegantStoriesHomeViewModel,
  type ElegantStoryViewModel,
} from "../../src/features/storefront/elegant-stories";

const stories: ElegantStoryViewModel[] = [
  {
    id: "horizons",
    title: "آفاق بلا حدود",
    subtitle: "مجموعة موسمية بتفاصيل هادئة وحضور لا يُنسى.",
    badge: "ربيع / صيف 2026",
    ctaLabel: "تسوق القصة",
    imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=82",
    altText: "إطلالة موسمية داكنة",
    backgroundColor: "#4a1218",
    overlayOpacity: 56,
    focalPointX: 50,
    focalPointY: 35,
    disclosure: "ad",
  },
  {
    id: "home",
    title: "تحرير المنزل",
    subtitle: "قطع مدروسة لمساحة أكثر دفئًا وهدوءًا.",
    ctaLabel: "اكتشف المجموعة",
    imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82",
    altText: "غرفة معيشة عصرية بألوان محايدة",
    backgroundColor: "#8c745e",
    overlayOpacity: 48,
    focalPointX: 50,
    focalPointY: 45,
  },
  {
    id: "natural-glow",
    title: "إشراقة طبيعية",
    subtitle: "جمال هادئ من العناية اليومية إلى اللمسة الأخيرة.",
    badge: "قصة الموسم",
    ctaLabel: "تسوق القصة",
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1100&q=84",
    mobileImageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=82",
    altText: "صورة تحريرية لامرأة بإضاءة طبيعية",
    backgroundColor: "#9c876c",
    overlayOpacity: 42,
    focalPointX: 50,
    focalPointY: 30,
  },
  {
    id: "technology",
    title: "إطلاق التقنية",
    subtitle: "ابتكارات جديدة بتصميم ينسجم مع يومك.",
    ctaLabel: "شاهد الإطلاق",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=82",
    altText: "هاتف ذكي بإضاءة داكنة",
    backgroundColor: "#071018",
    overlayOpacity: 54,
    focalPointX: 50,
    focalPointY: 45,
    disclosure: "ad",
  },
  {
    id: "my-style",
    title: "أسلوبي حكايتي",
    subtitle: "اختيارات تعبّر عنك، من التفاصيل اليومية إلى المناسبات.",
    ctaLabel: "استكشف الأسلوب",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=82",
    altText: "إطلالة أنيقة بألوان ترابية",
    backgroundColor: "#59604a",
    overlayOpacity: 50,
    focalPointX: 50,
    focalPointY: 35,
    disclosure: "sponsored",
    sponsorName: "دار نُور",
  },
];

const discoveryItems: ElegantDiscoveryViewModel[] = [
  { id: "bags", title: "حقائب مختارة", imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=700&q=84", altText: "حقيبة جلدية بتصميم كلاسيكي" },
  { id: "perfume", title: "عطور استثنائية", imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=700&q=84", altText: "زجاجة عطر فاخرة" },
  { id: "eyewear", title: "نظارات الموسم", imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=700&q=84", altText: "نظارة شمسية سوداء" },
  { id: "decor", title: "تفاصيل المنزل", imageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=700&q=84", altText: "قطعة ديكور منزلية هادئة" },
  { id: "watches", title: "ساعات خالدة", imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=84", altText: "ساعة يد أنيقة" },
  { id: "shoes", title: "خطوات جديدة", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=84", altText: "حذاء رياضي عصري" },
  { id: "beauty", title: "طقوس الجمال", imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=84", altText: "مجموعة مستحضرات تجميل" },
  { id: "living", title: "مساحات ملهمة", imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=84", altText: "غرفة معيشة عصرية", disclosure: "sponsored", sponsorName: "دار المساحة" },
];

const model: ElegantStoriesHomeViewModel = {
  intro: {
    eyebrow: "قصص تستحق الاكتشاف",
    title: "إطلاق الموسم",
    subtitle: "تشكيلة جديدة، رؤى مختلفة، وأسلوبك القادم يبدأ من هنا.",
  },
  stories,
  discoveryItems,
};

function Preview() {
  const [search, setSearch] = useState("");
  const cartCount = 2;

  return (
    <div style={{ "--elegant-background": "#fbfaf7", "--elegant-surface": "#ffffff", "--elegant-ink": "#171717", "--elegant-muted-ink": "#625f5a", "--elegant-border": "#e8e4de" } as React.CSSProperties}>
      <ElegantEditorialHeader
        storeName="فيلور"
        categories={["نساء", "رجال", "الجمال", "المنزل", "الإلكترونيات"]}
        cartCount={cartCount}
        searchQuery={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => undefined}
        onOpenHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onOpenProducts={() => document.querySelector("[data-elegant-discovery]")?.scrollIntoView({ behavior: "smooth" })}
        onOpenAbout={() => undefined}
        onOpenCart={() => undefined}
        onSelectCategory={() => document.querySelector("[data-elegant-discovery]")?.scrollIntoView({ behavior: "smooth" })}
      />
      <ElegantStoriesHome
        model={model}
        onOpenStory={() => document.querySelector("[data-elegant-discovery]")?.scrollIntoView({ behavior: "smooth" })}
        onOpenDiscovery={() => undefined}
        onOpenDiscoveryAll={() => document.querySelector("[data-elegant-discovery]")?.scrollIntoView({ behavior: "smooth" })}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
);
