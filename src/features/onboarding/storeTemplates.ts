import { applyStoreOnboardingAppearance, type StoreOnboardingAppearance } from "../../contracts/storeOnboardingAppearance";
import type { StorefrontMarketingBlock, StorefrontMarketingPlacement } from "../../contracts/storefrontMarketingBlocks";
import type { Product, StoreConfig } from "../../types";
import previewImage from "../../assets/images/hero_banner_perfume_1785918166890.jpg";

export type OnboardingTemplateKey = "elegant" | "tech";

export interface OnboardingTemplate {
  key: OnboardingTemplateKey;
  name: string;
  category: string;
  description: string;
  bestFor: string;
  layoutLabel: string;
  layoutFeatures: string[];
  previewProducts: string[];
  previewMarketingBlocks: StorefrontMarketingBlock[];
  appearance: StoreOnboardingAppearance;
  sampleProducts: Product[];
}

interface PreviewBlockCopy {
  title: string;
  subtitle: string;
  backgroundColor: string;
}

function previewBlocks(
  placement: StorefrontMarketingPlacement,
  copies: PreviewBlockCopy[],
  idOffset: number,
  disclosure: StorefrontMarketingBlock["disclosure"] = "none",
): StorefrontMarketingBlock[] {
  return copies.map((copy, index) => ({
    id: `10000000-0000-4000-8000-${String(idOffset + index).padStart(12, "0")}`,
    placement,
    position: index + 1,
    enabled: true,
    contentType: disclosure === "none" ? "category" : "campaign",
    title: copy.title,
    subtitle: copy.subtitle,
    badge: placement === "discovery" ? "مختارات" : undefined,
    ctaLabel: placement === "editorial_story" ? "تسوق القصة" : "اكتشف",
    imageUrl: previewImage,
    altText: `صورة تجريبية لـ${copy.title}`,
    backgroundColor: copy.backgroundColor,
    textColor: "#FFFFFF",
    overlayOpacity: 56,
    focalPointX: 20 + ((index * 17) % 65),
    focalPointY: 50,
    targetType: "products",
    disclosure,
    sponsorName: disclosure === "none" ? undefined : "مساحة عرض تجريبية",
  }));
}

const elegantPreviewBlocks = [
  ...previewBlocks("editorial_story", [
    { title: "أناقة بلا حدود", subtitle: "مجموعة موسمية مختارة بعناية.", backgroundColor: "#4C151A" },
    { title: "تحرير المنزل", subtitle: "تفاصيل هادئة لحياة أجمل.", backgroundColor: "#8B7258" },
    { title: "إشراقة طبيعية", subtitle: "جمال هادئ من العناية إلى الأناقة.", backgroundColor: "#907A5D" },
    { title: "إطلاق التقنية", subtitle: "ابتكارات منتقاة ضمن قصة واحدة.", backgroundColor: "#111827" },
    { title: "أسلوبي حكايتي", subtitle: "مجموعة تعبّر عن حضورك.", backgroundColor: "#66705A" },
  ], 1),
  ...previewBlocks("discovery", [
    { title: "حقائب مختارة", subtitle: "", backgroundColor: "#E7D6C8" },
    { title: "عطور استثنائية", subtitle: "", backgroundColor: "#CAB9A4" },
    { title: "نظارات الموسم", subtitle: "", backgroundColor: "#B9B0A6" },
    { title: "تفاصيل المنزل", subtitle: "", backgroundColor: "#A59A83" },
    { title: "ساعات أنيقة", subtitle: "", backgroundColor: "#756B62" },
    { title: "أحذية يومية", subtitle: "", backgroundColor: "#DED6CB" },
  ], 101),
];

const techPreviewBlocks = [
  ...previewBlocks("hero_bento", [
    { title: "الإلكترونيات", subtitle: "تقنية أقرب إلى يومك.", backgroundColor: "#1473E6" },
    { title: "المنزل", subtitle: "حلول ذكية بمظهر أنيق.", backgroundColor: "#16856B" },
    { title: "الأزياء", subtitle: "اختيارات حديثة.", backgroundColor: "#EC665E" },
    { title: "الجمال", subtitle: "عناية بتفاصيل واضحة.", backgroundColor: "#6575DD" },
    { title: "الرياضة", subtitle: "أداء يواكب حركتك.", backgroundColor: "#92B526" },
  ], 201),
  ...previewBlocks("side_ad", [
    { title: "عالم الألعاب في انتظارك", subtitle: "مساحة إعلانية بارزة.", backgroundColor: "#071B35" },
    { title: "أناقة ترافقك كل يوم", subtitle: "حملة مختارة للعرض.", backgroundColor: "#80654F" },
  ], 301, "ad"),
  ...previewBlocks("discovery", [
    { title: "سماعات", subtitle: "", backgroundColor: "#DCE8F5" },
    { title: "عطور", subtitle: "", backgroundColor: "#E9D8C8" },
    { title: "أثاث", subtitle: "", backgroundColor: "#D9D3C9" },
    { title: "كاميرات", subtitle: "", backgroundColor: "#C9D4DF" },
    { title: "ساعات", subtitle: "", backgroundColor: "#D8DEE8" },
    { title: "حقائب", subtitle: "", backgroundColor: "#DACBBF" },
    { title: "عناية", subtitle: "", backgroundColor: "#EEE5DF" },
    { title: "نظارات", subtitle: "", backgroundColor: "#D6DDE5" },
    { title: "أحذية", subtitle: "", backgroundColor: "#E8E2D9" },
    { title: "أجهزة منزلية", subtitle: "", backgroundColor: "#DDE7DB" },
  ], 401),
];

const safeOnboardingConfig: StoreConfig = {
  storeName: "متجري الجديد",
  slogan: "كل ما تحتاجه في مكان واحد",
  logoIcon: "🛍️",
  primaryColor: "#0284C7",
  secondaryColor: "#0F172A",
  textColor: "#334155",
  bgColor: "#F8FAFC",
  cardBgColor: "#FFFFFF",
  borderColor: "#E2E8F0",
  themeStyle: "elegant",
  bannerText: "أهلاً بك في متجري الجديد",
  products: [],
  fontFamily: "Cairo",
  phone: "",
  currency: "YER",
  enableStockManagement: true,
  allowOrdersWhenOutOfStock: false,
  showStockBadge: true,
  lowStockWarningThreshold: 5,
  enableCashOnDelivery: true,
  cashOnDeliveryFee: 0,
  enableBankTransfer: false,
  enableOnlineCard: false,
  enableApplePay: false,
  enableStcPay: false,
  enableEWallets: false,
  customWallets: [],
  enableCoupons: false,
  customCoupons: [],
  enableWhatsAppNotification: false,
};

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    key: "elegant",
    name: "الأناقة العصرية",
    category: "دافئ وفاخر",
    description: "واجهة واسعة بهوية هادئة وبطاقات أنيقة تبرز قصة النشاط.",
    bestFor: "العطور، الأزياء، الهدايا والمنتجات اليدوية",
    layoutLabel: "Elegant Stories",
    layoutFeatures: ["خمس قصص موسمية مستقلة", "بطاقة وسطية بارزة", "شريط مختارات المحرر"],
    previewProducts: ["#F4E7D3", "#E8D4B4", "#D9B77E"],
    previewMarketingBlocks: elegantPreviewBlocks,
    appearance: {
      slogan: "منتجات مختارة بعناية لتجربة لا تُنسى",
      logoIcon: "✨",
      primaryColor: "#B7791F",
      secondaryColor: "#292524",
      textColor: "#44403C",
      bgColor: "#FFFBEB",
      cardBgColor: "#FFFFFF",
      borderColor: "#F1E5D1",
      fontFamily: "Cairo",
      bannerText: "اكتشف تشكيلتنا المختارة بعناية",
      showHeroBanner: true,
      heroBannerTitle: "تفاصيل جميلة تصنع فرقًا",
      heroBannerSubtitle: "واجهة دافئة تساعد عملاءك على اكتشاف منتجاتك بسهولة",
      heroBannerBadge: "اختيارات مميزة",
      heroBannerButtonText: "استكشف المنتجات",
      heroBannerHeight: "medium",
      heroBannerOverlayOpacity: 35,
    },
    sampleProducts: [
      { id: "preview-elegant-1", status: "published", name: "عطر ليالي صنعاء", price: 18500, description: "توليفة دافئة بروح يمنية أصيلة.", category: "عطور", imageKeyword: "perfume", manageStock: false },
      { id: "preview-elegant-2", status: "published", name: "مبخرة حجرية", price: 12500, description: "قطعة أنيقة للمنزل والمكتب.", category: "هدايا", imageKeyword: "incense", manageStock: false },
      { id: "preview-elegant-3", status: "published", name: "صندوق هدية فاخر", price: 22000, description: "هدية جاهزة بتغليف مميز.", category: "هدايا", imageKeyword: "gift", manageStock: false },
    ],
  },
  {
    key: "tech",
    name: "التقنية والابتكار",
    category: "واضح وحديث",
    description: "تصميم سريع ومباشر يبرز المواصفات والعروض والمنتجات الحديثة.",
    bestFor: "الإلكترونيات، الملحقات، الخدمات والمنتجات الرقمية",
    layoutLabel: "Tech Bento",
    layoutFeatures: ["خمس مساحات Bento", "إعلانان جانبيان", "عشر دوائر اكتشاف"],
    previewProducts: ["#DBEAFE", "#BAE6FD", "#CBD5E1"],
    previewMarketingBlocks: techPreviewBlocks,
    appearance: {
      slogan: "حلول ذكية لحياة أسرع وأسهل",
      logoIcon: "⚡",
      primaryColor: "#0284C7",
      secondaryColor: "#0F172A",
      textColor: "#334155",
      bgColor: "#F8FAFC",
      cardBgColor: "#FFFFFF",
      borderColor: "#E2E8F0",
      fontFamily: "Tajawal",
      bannerText: "واجهة تقنية وتجربة شراء واضحة",
      showHeroBanner: true,
      heroBannerTitle: "التقنية التي تناسب يومك",
      heroBannerSubtitle: "اعرض المواصفات والمزايا بأسلوب مباشر وحديث",
      heroBannerBadge: "وصل حديثًا",
      heroBannerButtonText: "شاهد المنتجات",
      heroBannerHeight: "medium",
      heroBannerOverlayOpacity: 40,
    },
    sampleProducts: [
      { id: "preview-tech-1", status: "published", name: "سماعة لاسلكية", price: 14500, description: "صوت واضح وبطارية طويلة.", category: "صوتيات", imageKeyword: "headphones", manageStock: false },
      { id: "preview-tech-2", status: "published", name: "شاحن ذكي سريع", price: 8500, description: "شحن آمن لعدة أجهزة.", category: "ملحقات", imageKeyword: "charger", manageStock: false },
      { id: "preview-tech-3", status: "published", name: "ساعة رياضية", price: 19500, description: "متابعة النشاط والتنبيهات اليومية.", category: "ساعات", imageKeyword: "smartwatch", manageStock: false },
    ],
  },
];

export function createTemplateConfig(
  template: OnboardingTemplate,
  storeName: string,
  baseConfig: StoreConfig = safeOnboardingConfig,
): StoreConfig {
  return applyStoreOnboardingAppearance(baseConfig, template.appearance, storeName, template.key);
}

export function createTemplatePreviewConfig(template: OnboardingTemplate, persistedConfig: StoreConfig): StoreConfig {
  return {
    ...persistedConfig,
    heroBannerImage: previewImage,
    marketingBlocks: template.previewMarketingBlocks.map((block) => ({ ...block })),
    products: template.sampleProducts.map((product) => ({ ...product })),
  };
}
