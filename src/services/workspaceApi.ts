import type { Coupon, EWallet, Product, StoreConfig } from "../types";
import { apiClient, ApiError } from "./apiClient";
import { arrayField, enumField, numberField, record, stringField } from "./apiContract";
import { sanitizeCheckoutConfig } from "../contracts/checkoutPolicy";
import { defaultStorefrontSections, validStorefrontSections } from "../contracts/storefrontSections";
import { cloneStorefrontMarketingBlocks, validStorefrontMarketingBlocks } from "../contracts/storefrontMarketingBlocks";

export interface StoreWorkspace {
  tenantId: string;
  revision: number;
  catalogRevision: number;
  capabilities: {
    inventoryView: boolean;
    inventoryManage: boolean;
  };
  config: StoreConfig;
  updatedAt: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(contract: string): never {
  throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
}

function optionalString(source: Record<string, unknown>, key: string, contract: string): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return invalid(contract);
  return value;
}

function optionalNumber(source: Record<string, unknown>, key: string, contract: string): number | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return invalid(contract);
  return number;
}

function optionalBoolean(source: Record<string, unknown>, key: string, contract: string): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") return invalid(contract);
  return value;
}

export function mapProduct(value: unknown): Product {
  const dto = record(value, "منتج مساحة العمل");
  const rawPrice = dto.price;
  const price = typeof rawPrice === "string" ? Number(rawPrice) : rawPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return invalid("منتج مساحة العمل");
  const imageUrls = dto.imageUrls === null || dto.imageUrls === undefined
    ? undefined
    : arrayField(dto, "imageUrls", "منتج مساحة العمل").map((url) => {
      if (typeof url !== "string") return invalid("منتج مساحة العمل");
      return url;
    });

  return {
    id: stringField(dto, "id", "منتج مساحة العمل"),
    revision: optionalNumber(dto, "revision", "منتج مساحة العمل"),
    status: dto.status === undefined || dto.status === null
      ? "published"
      : enumField(dto, "status", ["draft", "published", "archived"] as const, "منتج مساحة العمل"),
    name: stringField(dto, "name", "منتج مساحة العمل"),
    price,
    basePrice: optionalNumber(dto, "basePrice", "منتج مساحة العمل") ?? price,
    salePrice: optionalNumber(dto, "salePrice", "منتج مساحة العمل") ?? null,
    description: optionalString(dto, "description", "منتج مساحة العمل") ?? "",
    category: optionalString(dto, "category", "منتج مساحة العمل") ?? "",
    imageKeyword: optionalString(dto, "imageKeyword", "منتج مساحة العمل") ?? "default",
    imageUrl: optionalString(dto, "imageUrl", "منتج مساحة العمل"),
    imageUrls,
    stockQuantity: optionalNumber(dto, "stockQuantity", "منتج مساحة العمل"),
    reservedQuantity: optionalNumber(dto, "reservedQuantity", "منتج مساحة العمل"),
    availableQuantity: dto.availableQuantity === null ? null : optionalNumber(dto, "availableQuantity", "منتج مساحة العمل"),
    inventoryRevision: optionalNumber(dto, "inventoryRevision", "منتج مساحة العمل"),
    manageStock: optionalBoolean(dto, "manageStock", "منتج مساحة العمل"),
    sku: optionalString(dto, "sku", "منتج مساحة العمل"),
    lowStockThreshold: optionalNumber(dto, "lowStockThreshold", "منتج مساحة العمل"),
  };
}

const optionalStringKeys = [
  "logoUrl", "textColor", "bgColor", "cardBgColor", "borderColor", "aboutTitle", "aboutText",
  "aboutVision", "aboutImage", "email", "address", "workingHours", "whatsapp", "instagram", "twitter",
  "tiktok", "snapchat", "heroBannerImage", "heroBannerTitle", "heroBannerSubtitle", "heroBannerBadge",
  "heroBannerButtonText", "heroBannerMobileImage", "heroBannerTargetValue", "checkoutTitle", "checkoutSubtitle",
  "checkoutNotice", "bankName", "bankAccountName",
  "bankIban", "bankAccountNumber", "thankYouTitle", "thankYouMessage",
] as const;
const optionalNumberKeys = [
  "logoSize", "heroBannerOverlayOpacity", "heroBannerFocalPointX", "heroBannerFocalPointY",
  "lowStockWarningThreshold", "minOrderAmount", "freeShippingThreshold", "shippingFee", "taxRate", "cashOnDeliveryFee",
] as const;
const optionalBooleanKeys = [
  "showHeroBanner", "enableStockManagement", "allowOrdersWhenOutOfStock", "showStockBadge", "requireEmail",
  "requireAddressDetails", "enableCustomerNotes", "enableCashOnDelivery", "enableBankTransfer", "enableOnlineCard",
  "enableApplePay", "enableStcPay", "enableEWallets", "enableCoupons", "enableWhatsAppNotification",
] as const;

function mapWallet(value: unknown): EWallet {
  const dto = record(value, "محفظة الدفع");
  return {
    id: stringField(dto, "id", "محفظة الدفع"),
    name: stringField(dto, "name", "محفظة الدفع"),
    accountNumber: stringField(dto, "accountNumber", "محفظة الدفع"),
    accountName: optionalString(dto, "accountName", "محفظة الدفع"),
    icon: optionalString(dto, "icon", "محفظة الدفع"),
    badge: optionalString(dto, "badge", "محفظة الدفع"),
    active: optionalBoolean(dto, "active", "محفظة الدفع"),
    bgColor: optionalString(dto, "bgColor", "محفظة الدفع"),
  };
}

function mapCoupon(value: unknown): Coupon {
  const dto = record(value, "قسيمة الخصم");
  return {
    code: stringField(dto, "code", "قسيمة الخصم"),
    discountPercent: numberField(dto, "discountPercent", "قسيمة الخصم"),
    active: optionalBoolean(dto, "active", "قسيمة الخصم") ?? false,
  };
}

export function mapStoreConfig(value: unknown): StoreConfig {
  const dto = record(value, "إعدادات مساحة العمل");
  const config: StoreConfig = {
    storeName: stringField(dto, "storeName", "إعدادات مساحة العمل"),
    slogan: stringField(dto, "slogan", "إعدادات مساحة العمل"),
    logoIcon: stringField(dto, "logoIcon", "إعدادات مساحة العمل"),
    primaryColor: stringField(dto, "primaryColor", "إعدادات مساحة العمل"),
    secondaryColor: stringField(dto, "secondaryColor", "إعدادات مساحة العمل"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "إعدادات مساحة العمل"),
    bannerText: stringField(dto, "bannerText", "إعدادات مساحة العمل"),
    products: arrayField(dto, "products", "إعدادات مساحة العمل").map(mapProduct),
    fontFamily: stringField(dto, "fontFamily", "إعدادات مساحة العمل"),
    phone: optionalString(dto, "phone", "إعدادات مساحة العمل") ?? "",
    currency: stringField(dto, "currency", "إعدادات مساحة العمل"),
    homeSections: dto.homeSections === undefined
      ? defaultStorefrontSections()
      : validStorefrontSections(dto.homeSections)
        ? dto.homeSections.map((section) => ({ ...section }))
        : invalid("ترتيب أقسام واجهة المتجر"),
  };

  for (const key of optionalStringKeys) {
    const value = optionalString(dto, key, "إعدادات مساحة العمل");
    if (value !== undefined) (config as unknown as Record<string, unknown>)[key] = value;
  }
  for (const key of optionalNumberKeys) {
    const value = optionalNumber(dto, key, "إعدادات مساحة العمل");
    if (value !== undefined) (config as unknown as Record<string, unknown>)[key] = value;
  }
  for (const key of optionalBooleanKeys) {
    const value = optionalBoolean(dto, key, "إعدادات مساحة العمل");
    if (value !== undefined) (config as unknown as Record<string, unknown>)[key] = value;
  }
  if (dto.logoType !== undefined && dto.logoType !== null) config.logoType = enumField(dto, "logoType", ["icon", "image"] as const, "إعدادات مساحة العمل");
  if (dto.heroBannerHeight !== undefined && dto.heroBannerHeight !== null) config.heroBannerHeight = enumField(dto, "heroBannerHeight", ["compact", "medium", "large"] as const, "إعدادات مساحة العمل");
  if (dto.heroBannerTargetType !== undefined && dto.heroBannerTargetType !== null) config.heroBannerTargetType = enumField(dto, "heroBannerTargetType", ["products", "category", "product"] as const, "إعدادات مساحة العمل");
  if (dto.marketingBlocks !== undefined && dto.marketingBlocks !== null) {
    if (!validStorefrontMarketingBlocks(dto.marketingBlocks)) return invalid("مساحات التسويق في واجهة المتجر");
    config.marketingBlocks = cloneStorefrontMarketingBlocks(dto.marketingBlocks);
  }
  if (dto.customWallets !== undefined && dto.customWallets !== null) config.customWallets = arrayField(dto, "customWallets", "إعدادات مساحة العمل").map(mapWallet);
  if (dto.customCoupons !== undefined && dto.customCoupons !== null) config.customCoupons = arrayField(dto, "customCoupons", "إعدادات مساحة العمل").map(mapCoupon);
  for (const key of ["logoUrl", "heroBannerImage", "heroBannerMobileImage", "aboutImage"] as const) {
    if (/^(?:data|blob):/i.test(config[key] ?? "")) config[key] = "";
  }

  return sanitizeCheckoutConfig(config);
}

function mapWorkspace(value: unknown): StoreWorkspace {
  const envelope = record(value, "استجابة مساحة العمل");
  const dto = record(envelope.data, "مساحة العمل");
  const updatedAt = dto.updatedAt;
  const capabilities = record(dto.capabilities, "صلاحيات مساحة العمل");
  if (updatedAt !== null && typeof updatedAt !== "string") return invalid("مساحة العمل");

  return {
    tenantId: stringField(dto, "tenantId", "مساحة العمل"),
    revision: numberField(dto, "revision", "مساحة العمل"),
    catalogRevision: numberField(dto, "catalogRevision", "مساحة العمل"),
    capabilities: {
      inventoryView: optionalBoolean(capabilities, "inventoryView", "صلاحيات مساحة العمل") ?? false,
      inventoryManage: optionalBoolean(capabilities, "inventoryManage", "صلاحيات مساحة العمل") ?? false,
    },
    config: mapStoreConfig(dto.config),
    updatedAt: updatedAt as string | null,
  };
}

function configForServer(config: StoreConfig): Record<string, unknown> {
  return {
    ...config,
    products: config.products.map((product) => ({
      ...product,
      id: uuidPattern.test(product.id) ? product.id : undefined,
      revision: uuidPattern.test(product.id) ? product.revision : undefined,
      status: product.status ?? "draft",
      basePrice: canonicalMoney(product.basePrice ?? product.price),
      salePrice: product.salePrice === null || product.salePrice === undefined
        ? null
        : canonicalMoney(product.salePrice),
      price: undefined,
    })),
  };
}

function canonicalMoney(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return value.toFixed(2);
}

export const workspaceApi = {
  async load(tenantId: string, signal?: AbortSignal): Promise<StoreWorkspace> {
    return mapWorkspace(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/workspace`, { signal }));
  },

  async save(
    tenantId: string,
    revision: number,
    catalogRevision: number,
    config: StoreConfig,
    archiveProductIds: string[] = [],
  ): Promise<StoreWorkspace> {
    return mapWorkspace(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/workspace`, {
      method: "PATCH",
      body: { revision, catalogRevision, config: configForServer(config), archiveProductIds },
    }));
  },
};
