import type { StorefrontMarketingBlock, StorefrontMarketingTargetType } from "./contracts/storefrontMarketingBlocks";

export interface Product {
  id: string;
  revision?: number;
  status?: "draft" | "published" | "archived";
  name: string;
  price: number;
  basePrice?: number;
  salePrice?: number | null;
  description: string;
  category: string;
  imageKeyword: string;
  imageUrl?: string;
  imageUrls?: string[];
  // Inventory Management
  stockQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number | null;
  inventoryRevision?: number;
  manageStock?: boolean;
  sku?: string;
  lowStockThreshold?: number;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  active: boolean;
}

export interface EWallet {
  id: string;
  name: string;
  accountNumber: string;
  accountName?: string;
  icon?: string;
  badge?: string;
  active?: boolean;
  bgColor?: string;
}

export type StorefrontSectionId = "hero" | "trust" | "categories" | "featured_products" | "about";

export interface StorefrontSection {
  id: StorefrontSectionId;
  visible: boolean;
}

export interface StoreConfig {
  storeName: string;
  slogan: string;
  logoIcon: string;
  logoUrl?: string;
  logoType?: "icon" | "image";
  logoSize?: number;
  primaryColor: string;
  secondaryColor: string;
  textColor?: string;
  bgColor?: string;
  cardBgColor?: string;
  borderColor?: string;
  themeStyle: "elegant" | "tech";
  bannerText: string;
  products: Product[];
  homeSections?: StorefrontSection[];
  fontFamily: string;
  phone: string;
  currency: string;
  // Custom Pages Content
  aboutTitle?: string;
  aboutText?: string;
  aboutVision?: string;
  aboutImage?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  whatsapp?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  snapchat?: string;
  // Header Hero Banner Below Header
  showHeroBanner?: boolean;
  heroBannerImage?: string;
  heroBannerTitle?: string;
  heroBannerSubtitle?: string;
  heroBannerBadge?: string;
  heroBannerButtonText?: string;
  heroBannerHeight?: "compact" | "medium" | "large";
  heroBannerOverlayOpacity?: number;
  heroBannerMobileImage?: string;
  heroBannerTargetType?: Exclude<StorefrontMarketingTargetType, "external">;
  heroBannerTargetValue?: string;
  heroBannerFocalPointX?: number;
  heroBannerFocalPointY?: number;
  marketingBlocks?: StorefrontMarketingBlock[];

  // --- INVENTORY MANAGEMENT SETTINGS (إدارة المخزون) ---
  enableStockManagement?: boolean;
  allowOrdersWhenOutOfStock?: boolean;
  showStockBadge?: boolean;
  lowStockWarningThreshold?: number;

  // --- CHECKOUT & PAYMENT CUSTOMIZATION SETTINGS (تعديل إتمام الطلب والدفع) ---
  checkoutTitle?: string;
  checkoutSubtitle?: string;
  checkoutNotice?: string;
  requireEmail?: boolean;
  requireAddressDetails?: boolean;
  enableCustomerNotes?: boolean;
  minOrderAmount?: number;
  freeShippingThreshold?: number;
  shippingFee?: number;
  taxRate?: number;

  // Payment Methods
  enableCashOnDelivery?: boolean;
  cashOnDeliveryFee?: number;
  enableBankTransfer?: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankIban?: string;
  bankAccountNumber?: string;
  enableOnlineCard?: boolean;
  enableApplePay?: boolean;
  enableStcPay?: boolean;
  enableEWallets?: boolean;
  customWallets?: EWallet[];

  // Coupons
  enableCoupons?: boolean;
  customCoupons?: Coupon[];

  // Post-purchase / Thank you Page
  thankYouTitle?: string;
  thankYouMessage?: string;
  enableWhatsAppNotification?: boolean;
}

const ELEGANT_SHOWCASE_PRESET: StoreConfig = {
  storeName: "لورين للعطور",
  slogan: "سحر النفحات الشرقية والفرنسية الفاخرة",
  logoIcon: "🌸",
  primaryColor: "#D4AF37", // Gold
  secondaryColor: "#1C1917", // Deep charcoal
  textColor: "#44403C", // Warm slate body text
  bgColor: "#FDFBF7", // Soft warm off-white canvas
  cardBgColor: "#FFFFFF", // Pure white cards & sections
  borderColor: "#F2EAE1", // Soft warm borders
  themeStyle: "elegant",
  bannerText: "اكتشف تشكيلة العطور والهدايا المتاحة في المتجر",
  fontFamily: "Cairo",
  phone: "+966 50 123 4567",
  currency: "YER",
  homeSections: [
    { id: "hero", visible: true },
    { id: "trust", visible: true },
    { id: "categories", visible: true },
    { id: "featured_products", visible: true },
    { id: "about", visible: true },
  ],
  aboutTitle: "قصة لورين للعطور - فخامة العبق الشرقي والفرنسي",
  aboutText: "تأسست دار 'لورين للعطور' لتكون رائدة في عالم الخلطات النادرة والنفحات الساحرة. نبتكر عطرياتنا من خلاصة أجود زيوت العود المعتق، المسك الأبيض، والورد الطائفي الفاخر، لنمنح زوارنا تجربة حسية فريدة تجسد الأصالة والهيبة.",
  aboutVision: "رؤيتنا هي الابتكار المستمر وإتاحة أرقى معايير صناعة العطور الملكية والمباخر اليدوية لكافة عملائنا في الخليج العربي.",
  aboutImage: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80",
  email: "contact@lorenperfumes.com",
  address: "الرياض، طريق الملك فهد - المملكة العربية السعودية",
  workingHours: "السبت - الخميس: 9:00 صباحاً - 11:00 مساءً",
  whatsapp: "+966501234567",
  instagram: "loren_perfumes",
  twitter: "loren_perfumes",
  tiktok: "loren_perfumes",
  snapchat: "loren_perfumes",
  showHeroBanner: true,
  heroBannerImage: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1600&q=80",
  heroBannerTitle: "تشكيلة الصيف الملكية للعود والعطور 🌸",
  heroBannerSubtitle: "اكتشف أحدث ابتكارات دار لورين المستوحاة من سحر العبق الشرقي والنفحات الفرنسية الفاخرة",
  heroBannerBadge: "✨ العرض الحصري الجديد 2026",
  heroBannerButtonText: "تسوق التشكيلة الآن",
  heroBannerHeight: "medium",
  heroBannerOverlayOpacity: 35,
  // --- INVENTORY MANAGEMENT DEFAULTS ---
  enableStockManagement: true,
  allowOrdersWhenOutOfStock: false,
  showStockBadge: true,
  lowStockWarningThreshold: 5,

  // --- CHECKOUT & PAYMENT DEFAULTS ---
  checkoutTitle: "إتمام الطلب الشراء والدفع",
  checkoutSubtitle: "أدخل بيانات التوصيل واختر طريقة الدفع المناسبة لك",
  checkoutNotice: "راجع بيانات الطلب والتوصيل قبل التأكيد.",
  requireEmail: false,
  requireAddressDetails: true,
  enableCustomerNotes: true,
  minOrderAmount: 0,
  freeShippingThreshold: 250,
  shippingFee: 0,
  taxRate: 15,

  // Payment Methods
  enableCashOnDelivery: true,
  cashOnDeliveryFee: 10,
  enableBankTransfer: true,
  bankName: "بنك الراجحي",
  bankAccountName: "شركة لورين للعطور المحدودة",
  bankIban: "SA9480000000123456789012",
  bankAccountNumber: "123456789012",
  enableOnlineCard: true,
  enableApplePay: true,
  enableStcPay: true,
  enableEWallets: true,
  customWallets: [
    {
      id: "w-stc",
      name: "محفظة STC Pay / urpay",
      accountNumber: "0501234567",
      accountName: "شركة لورين للعطور المحدودة",
      icon: "📱",
      badge: "دفع فوري ⚡",
      active: true,
      bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
    },
    {
      id: "w-kuraimi",
      name: "محفظة الكريمي إكسبرس (Kuraimi)",
      accountNumber: "30678912",
      accountName: "شركة لورين للعطور المحدودة",
      icon: "🏦",
      badge: "الأكثر شيوعاً واستخداماً 🔥",
      active: true,
      bgColor: "bg-blue-50/80 border-blue-200/90 text-blue-900"
    },
    {
      id: "w-jawali",
      name: "محفظة جوالي (Jawali Wallet)",
      accountNumber: "770123456",
      accountName: "شركة لورين للعطور المحدودة",
      icon: "📱",
      badge: "إيداع فوري ⚡",
      active: true,
      bgColor: "bg-emerald-50/80 border-emerald-200/90 text-emerald-900"
    },
    {
      id: "w-onecash",
      name: "محفظة ون كاش (OneCash)",
      accountNumber: "779876543",
      accountName: "شركة لورين للعطور المحدودة",
      icon: "💸",
      badge: "تحويل مباشر وآمن 🔒",
      active: true,
      bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
    },
    {
      id: "w-floos",
      name: "محفظة فلوس / جيب (Floos / Pocket)",
      accountNumber: "771122334",
      accountName: "شركة لورين للعطور المحدودة",
      icon: "👛",
      badge: "سريع ومباشر 🚀",
      active: true,
      bgColor: "bg-amber-50/80 border-amber-200/90 text-amber-900"
    }
  ],

  // Coupons
  enableCoupons: true,
  customCoupons: [
    { code: "WELCOME10", discountPercent: 10, active: true },
    { code: "SUMMER20", discountPercent: 20, active: true }
  ],

  // Post-purchase
  thankYouTitle: "شكراً لطلبك! تم استلام طلبك بنجاح 🎉",
  thankYouMessage: "سنقوم بتجهيز طلبك وشحنه فوراً، ويمكنك متابعة الطلب أو إرسال الفاتورة عبر الواتساب.",
  enableWhatsAppNotification: true,

  products: [
    {
      id: "p1",
      name: "عطر مِسك الغزال الملكي",
      price: 180,
      description: "عبق شرقي عتيق يمزج بين فخامة المسك والورد الطائفي الفاخر، يدوم لأكثر من 24 ساعة.",
      category: "عطور شرقية",
      imageKeyword: "perfume",
      imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 25,
      manageStock: true,
      sku: "PERF-001",
      lowStockThreshold: 5
    },
    {
      id: "p2",
      name: "دهن عود سيوفي معتق",
      price: 320,
      description: "دهن عود طبيعي فاخر مستخلص من أجود أنواع خشب العود الكمبودي المعتق برائحة رسمية وهيبة.",
      category: "دهن العود",
      imageKeyword: "oud-wood",
      imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 8,
      manageStock: true,
      sku: "OUD-002",
      lowStockThreshold: 3
    },
    {
      id: "p3",
      name: "مبخرة سيراميك ملكية",
      price: 110,
      description: "مبخرة مصممة يدوياً من السيراميك الفاخر بلمسات مذهبة وشكل هندسي معاصر يتناسب مع ذوقك.",
      category: "إكسسوارات",
      imageKeyword: "home-decor",
      imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 3,
      manageStock: true,
      sku: "ACC-003",
      lowStockThreshold: 4
    },
    {
      id: "p4",
      name: "بخور لورين الملكي الخاص",
      price: 95,
      description: "خلطة متميزة من رقائق العود المسقى بالعطور الفرنسية والورد لتعطير منزلك ومجلسك بالكامل.",
      category: "بخور",
      imageKeyword: "incense",
      imageUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 15,
      manageStock: true,
      sku: "INC-004",
      lowStockThreshold: 5
    }
  ]
};

export const ELEGANT_PRESET: StoreConfig = {
  ...ELEGANT_SHOWCASE_PRESET,
  phone: "",
  email: "",
  address: "",
  workingHours: "",
  whatsapp: "",
  instagram: "",
  twitter: "",
  tiktok: "",
  snapchat: "",
  enableBankTransfer: false,
  bankName: "",
  bankAccountName: "",
  bankIban: "",
  bankAccountNumber: "",
  enableOnlineCard: false,
  enableApplePay: false,
  enableStcPay: false,
  enableEWallets: false,
  customWallets: [],
  enableCoupons: false,
  customCoupons: [],
  enableWhatsAppNotification: false,
};

export const TECH_PRESET: StoreConfig = {
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
  storeName: "تِك فيو - للأجهزة الذكية",
  slogan: "أجهزة وملحقات تقنية مرتبة في تجربة شراء واضحة",
  logoIcon: "⚡",
  primaryColor: "#0284C7", // Bright Sky Blue
  secondaryColor: "#0F172A", // Deep Slate
  textColor: "#334155", // Slate body text
  bgColor: "#F8FAFC", // Cool Gray Canvas
  cardBgColor: "#FFFFFF", // Pure White Cards
  borderColor: "#E2E8F0", // Cool Slate Borders
  themeStyle: "tech",
  bannerText: "تصفح المنتجات التقنية المنشورة في المتجر",
  fontFamily: "Tajawal",
  phone: "",
  currency: "YER",
  homeSections: [
    { id: "hero", visible: true },
    { id: "trust", visible: true },
    { id: "categories", visible: true },
    { id: "featured_products", visible: true },
    { id: "about", visible: true },
  ],
  aboutTitle: "عن متجر تِك فيو - الابتكار والحلول الذكية",
  aboutText: "تأسست منصة 'تِك فيو' لعرض المنتجات والابتكارات الإلكترونية في مكان منظم. يضم الكتالوج سماعات وساعات ذكية وملحقات تقنية بمواصفات يضيفها المتجر لكل منتج.",
  aboutVision: "رؤيتنا إيصال أحدث ما توصلت إليه التكنولوجيا الحديثة لعملائنا بأسعار تنافسية وأعلى معايير الخدمة بعد البيع.",
  aboutImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
  email: "",
  address: "",
  workingHours: "",
  whatsapp: "",
  instagram: "",
  twitter: "",
  tiktok: "",
  snapchat: "",
  showHeroBanner: false,
  heroBannerImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80",
  heroBannerTitle: "عالم التقنية والحلول الذكية بين يديك ⚡",
  heroBannerSubtitle: "شاهد الساعات والسماعات وملحقات الجوال المتاحة في الكتالوج",
  heroBannerBadge: "🚀 عروض موثقة حصرياً",
  heroBannerButtonText: "استكشف المنتجات التقنية",
  heroBannerHeight: "medium",
  heroBannerOverlayOpacity: 40,
  products: [
    {
      id: "t1",
      name: "سماعة الرأس اللاسلكية Pulse Pro ANC",
      price: 340,
      description: "عزل ضوضاء ذكي نشط، بطارية يدوم عملها حتى 45 ساعة، ميكروفون مزدوج مكالمات ناصية، وصوت ثلاثي الأبعاد.",
      category: "سماعات",
      imageKeyword: "headphones",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 18,
      manageStock: true,
      sku: "AUDIO-001",
      lowStockThreshold: 5
    },
    {
      id: "t2",
      name: "شاحن مغناطيسي سريـع 3 في 1 MagPower",
      price: 160,
      description: "شحن لاسلكي سريع بقوة 25 واط للهاتف والساعة والسماعة في وقت واحد مع نظام تبريد ذكي وحماية متكاملة.",
      category: "شواحن",
      imageKeyword: "charger",
      imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 42,
      manageStock: true,
      sku: "PWR-002",
      lowStockThreshold: 10
    },
    {
      id: "t3",
      name: "ساعة رياضية ذكية Pulse Ultra 2",
      price: 420,
      description: "شاشة AMOLED فائقة السطوع، تتبع نبضات القلب والأكسجين في الدم، مقاومة للماء حتى عمق 50 متراً.",
      category: "ساعات ذكية",
      imageKeyword: "smartwatch",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 2,
      manageStock: true,
      sku: "WCH-003",
      lowStockThreshold: 5
    },
    {
      id: "t4",
      name: "كاميرا مراقبة منزلية ذكية 4K 360°",
      price: 215,
      description: "رؤية ليلية ملونة بدقة عالية، تتبع الحركة بالذكاء الاصطناعي، إنذار صوتي وتواصل صوتي اتجاهين.",
      category: "كاميرات ذكية",
      imageKeyword: "lamp",
      imageUrl: "https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?auto=format&fit=crop&w=600&q=80",
      stockQuantity: 0,
      manageStock: true,
      sku: "CAM-004",
      lowStockThreshold: 3
    }
  ]
};
