import { apiClient } from "./apiClient";
import {
  arrayField,
  booleanField,
  enumField,
  nullableStringField,
  numberField,
  record,
  stringField,
} from "./apiContract";
import { isSafePlatformLogoUrl } from "../utils/platformLogoUrl";
import { isSafePlatformIdentityImageUrl } from "../utils/platformIdentityImageUrl";

export type PlatformNavigationKey = "templates" | "how_it_works" | "pricing";
export type PlatformBrandFont = "Cairo" | "Tajawal" | "IBM Plex Sans Arabic";

export interface PlatformNavigationItem {
  key: PlatformNavigationKey;
  label: string;
  isVisible: boolean;
  position: number;
}

export interface PlatformSettings {
  revision: number;
  platformName: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
  brandSurfaceColor: string;
  brandFontFamily: PlatformBrandFont;
  landingHeroImageUrl: string | null;
  authImageUrl: string | null;
  landingHeadline: string;
  landingDescription: string;
  announcementEnabled: boolean;
  announcementText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  showHowItWorks: boolean;
  showPricing: boolean;
  storefrontAttributionEnabled: boolean;
  storefrontAttributionText: string | null;
  navigationItems: PlatformNavigationItem[];
}

export interface AdminPlatformSettings extends PlatformSettings {
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export type UpdatePlatformSettingsInput = Omit<PlatformSettings, "revision"> & {
  expectedRevision: number;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  revision: 1,
  platformName: "مبتكر",
  tagline: "منصة المتاجر الرقمية",
  logoUrl: null,
  primaryColor: "#0284C7",
  brandPrimaryColor: "#081725",
  brandAccentColor: "#B18A46",
  brandSurfaceColor: "#F8F6F1",
  brandFontFamily: "Tajawal",
  landingHeroImageUrl: null,
  authImageUrl: null,
  landingHeadline: "أنشئ متجرك الإلكتروني بذكاء وسرعة",
  landingDescription: "صمم هوية متجرك واختر قالبًا قابلًا للتخصيص، ثم أرسل طلبك للمراجعة والتجهيز قبل النشر.",
  announcementEnabled: false,
  announcementText: null,
  supportEmail: null,
  supportPhone: null,
  supportWhatsapp: null,
  showHowItWorks: true,
  showPricing: true,
  storefrontAttributionEnabled: true,
  storefrontAttributionText: "متجر إلكتروني مدعوم من منصة مبتكر.",
  navigationItems: [
    { key: "templates", label: "القوالب", isVisible: true, position: 1 },
    { key: "how_it_works", label: "كيف تعمل المنصة؟", isVisible: true, position: 2 },
    { key: "pricing", label: "الباقات والأسعار", isVisible: true, position: 3 },
  ],
};

export function mapPlatformSettings(value: unknown): PlatformSettings {
  const dto = record(value, "إعدادات المنصة العامة");
  const logoUrl = nullableStringField(dto, "logoUrl", "إعدادات المنصة العامة");
  if (!isSafePlatformLogoUrl(logoUrl)) {
    throw new Error("استجابة الخادم تحتوي رابط شعار غير آمن.");
  }
  const landingHeroImageUrl = nullableStringField(dto, "landingHeroImageUrl", "إعدادات المنصة العامة");
  const authImageUrl = nullableStringField(dto, "authImageUrl", "إعدادات المنصة العامة");
  if (!isSafePlatformIdentityImageUrl(landingHeroImageUrl) || !isSafePlatformIdentityImageUrl(authImageUrl)) {
    throw new Error("استجابة الخادم تحتوي رابط صورة هوية غير آمن.");
  }
  const navigationItems = arrayField(dto, "navigationItems", "إعدادات المنصة العامة")
    .map((item) => {
      const navigation = record(item, "عنصر تنقل المنصة");
      return {
        key: enumField(navigation, "key", ["templates", "how_it_works", "pricing"] as const, "عنصر تنقل المنصة"),
        label: stringField(navigation, "label", "عنصر تنقل المنصة"),
        isVisible: booleanField(navigation, "isVisible", "عنصر تنقل المنصة"),
        position: numberField(navigation, "position", "عنصر تنقل المنصة"),
      };
    })
    .sort((left, right) => left.position - right.position);
  const keys = navigationItems.map((item) => item.key).sort();
  const positions = navigationItems.map((item) => item.position).sort();
  if (navigationItems.length !== 3
    || keys.join("|") !== "how_it_works|pricing|templates"
    || positions.join("|") !== "1|2|3") {
    throw new Error("استجابة الخادم لا تطابق عقد تنقل المنصة.");
  }

  return {
    revision: numberField(dto, "revision", "إعدادات المنصة العامة"),
    platformName: stringField(dto, "platformName", "إعدادات المنصة العامة"),
    tagline: nullableStringField(dto, "tagline", "إعدادات المنصة العامة"),
    logoUrl,
    primaryColor: stringField(dto, "primaryColor", "إعدادات المنصة العامة"),
    brandPrimaryColor: stringField(dto, "brandPrimaryColor", "إعدادات المنصة العامة"),
    brandAccentColor: stringField(dto, "brandAccentColor", "إعدادات المنصة العامة"),
    brandSurfaceColor: stringField(dto, "brandSurfaceColor", "إعدادات المنصة العامة"),
    brandFontFamily: enumField(dto, "brandFontFamily", ["Cairo", "Tajawal", "IBM Plex Sans Arabic"] as const, "إعدادات المنصة العامة"),
    landingHeroImageUrl,
    authImageUrl,
    landingHeadline: stringField(dto, "landingHeadline", "إعدادات المنصة العامة"),
    landingDescription: stringField(dto, "landingDescription", "إعدادات المنصة العامة"),
    announcementEnabled: booleanField(dto, "announcementEnabled", "إعدادات المنصة العامة"),
    announcementText: nullableStringField(dto, "announcementText", "إعدادات المنصة العامة"),
    supportEmail: nullableStringField(dto, "supportEmail", "إعدادات المنصة العامة"),
    supportPhone: nullableStringField(dto, "supportPhone", "إعدادات المنصة العامة"),
    supportWhatsapp: nullableStringField(dto, "supportWhatsapp", "إعدادات المنصة العامة"),
    showHowItWorks: booleanField(dto, "showHowItWorks", "إعدادات المنصة العامة"),
    showPricing: booleanField(dto, "showPricing", "إعدادات المنصة العامة"),
    storefrontAttributionEnabled: booleanField(dto, "storefrontAttributionEnabled", "إعدادات المنصة العامة"),
    storefrontAttributionText: nullableStringField(dto, "storefrontAttributionText", "إعدادات المنصة العامة"),
    navigationItems,
  };
}

export function mapAdminPlatformSettings(value: unknown): AdminPlatformSettings {
  const dto = record(value, "إعدادات إدارة المنصة");

  return {
    ...mapPlatformSettings(dto),
    updatedAt: nullableStringField(dto, "updatedAt", "إعدادات إدارة المنصة"),
    updatedByUserId: nullableStringField(dto, "updatedByUserId", "إعدادات إدارة المنصة"),
  };
}

export const platformSettingsApi = {
  async load(signal?: AbortSignal): Promise<PlatformSettings> {
    const payload = record(await apiClient.request<unknown>("/api/platform-settings", { signal }), "إعدادات المنصة العامة");
    return mapPlatformSettings(payload.data);
  },
};
