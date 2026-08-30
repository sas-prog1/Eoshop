export const STOREFRONT_MARKETING_PLACEMENT_LIMITS = {
  hero_bento: 5,
  side_ad: 2,
  discovery: 10,
} as const;

export type StorefrontMarketingPlacement = keyof typeof STOREFRONT_MARKETING_PLACEMENT_LIMITS;
export type StorefrontMarketingContentType = "category" | "product" | "campaign";
export type StorefrontMarketingTargetType = "products" | "category" | "product" | "external";
export type StorefrontMarketingDisclosure = "none" | "ad" | "sponsored";

export interface StorefrontMarketingBlock {
  id: string;
  placement: StorefrontMarketingPlacement;
  position: number;
  enabled: boolean;
  contentType: StorefrontMarketingContentType;
  title: string;
  subtitle?: string;
  badge?: string;
  ctaLabel: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  focalPointX?: number;
  focalPointY?: number;
  targetType: StorefrontMarketingTargetType;
  targetValue?: string;
  disclosure: StorefrontMarketingDisclosure;
  sponsorName?: string;
  startsAt?: string;
  endsAt?: string;
}

const allowedKeys = new Set<keyof StorefrontMarketingBlock>([
  "id", "placement", "position", "enabled", "contentType", "title", "subtitle", "badge",
  "ctaLabel", "imageUrl", "mobileImageUrl", "altText", "backgroundColor", "textColor",
  "overlayOpacity", "focalPointX", "focalPointY", "targetType", "targetValue", "disclosure",
  "sponsorName", "startsAt", "endsAt",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const colorPattern = /^#[0-9a-f]{6}$/i;
const utcRfc3339Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown, maxLength: number): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

function boundedTrimmedString(value: unknown, minimum: number, maximum: number): value is string {
  if (typeof value !== "string") return false;
  const length = value.trim().length;
  return length >= minimum && length <= maximum;
}

function optionalPercentage(value: unknown): value is number | null | undefined {
  return value === undefined || value === null
    || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100);
}

function managedAssetPath(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 2048
    && /^\/api\/store-assets\/[^/]+\/[0-9a-f-]{36}$/i.test(value)
    && uuidPattern.test(value.slice(value.lastIndexOf("/") + 1));
}

function safeHttpsUrl(value: string): boolean {
  if (!value || value.length > 2048 || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function utcDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !utcRfc3339Pattern.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validBlock(value: unknown): value is StorefrontMarketingBlock {
  const block = record(value);
  if (!block || Object.keys(block).some((key) => !allowedKeys.has(key as keyof StorefrontMarketingBlock))) return false;
  if (!uuidPattern.test(String(block.id ?? ""))) return false;
  if (typeof block.placement !== "string" || !(block.placement in STOREFRONT_MARKETING_PLACEMENT_LIMITS)) return false;
  if (!Number.isInteger(block.position) || Number(block.position) < 1 || Number(block.position) > 10) return false;
  if (typeof block.enabled !== "boolean") return false;
  if (!["category", "product", "campaign"].includes(String(block.contentType))) return false;
  if (!boundedTrimmedString(block.title, 2, 80)
    || !boundedTrimmedString(block.ctaLabel, 2, 40)
    || !boundedTrimmedString(block.altText, 2, 160)) return false;
  if (!optionalString(block.subtitle, 180) || !optionalString(block.badge, 40)
    || !optionalString(block.sponsorName, 80)) return false;
  if (!managedAssetPath(block.imageUrl)
    || (block.mobileImageUrl !== undefined && block.mobileImageUrl !== null && !managedAssetPath(block.mobileImageUrl))) return false;
  if ((block.backgroundColor !== undefined && block.backgroundColor !== null
      && (typeof block.backgroundColor !== "string" || !colorPattern.test(block.backgroundColor)))
    || (block.textColor !== undefined && block.textColor !== null
      && (typeof block.textColor !== "string" || !colorPattern.test(block.textColor)))) return false;
  if (!optionalPercentage(block.overlayOpacity) || !optionalPercentage(block.focalPointX)
    || !optionalPercentage(block.focalPointY)) return false;
  if (!["products", "category", "product", "external"].includes(String(block.targetType))) return false;
  if (!optionalString(block.targetValue, 2048)) return false;
  if (!["none", "ad", "sponsored"].includes(String(block.disclosure))) return false;

  const targetValue = typeof block.targetValue === "string" ? block.targetValue.trim() : "";
  if (block.targetType === "products" && targetValue) return false;
  if (["category", "product", "external"].includes(String(block.targetType)) && !targetValue) return false;
  if (block.targetType === "product" && !uuidPattern.test(targetValue)) return false;
  if (block.targetType === "external"
    && (block.contentType !== "campaign" || !safeHttpsUrl(targetValue)
      || block.disclosure === "none" || !String(block.sponsorName ?? "").trim())) return false;
  if (["ad", "sponsored"].includes(String(block.disclosure)) && !String(block.sponsorName ?? "").trim()) return false;

  const startsAt = utcDate(block.startsAt);
  const endsAt = utcDate(block.endsAt);
  if (block.startsAt !== undefined && block.startsAt !== null && block.startsAt !== "" && startsAt === null) return false;
  if (block.endsAt !== undefined && block.endsAt !== null && block.endsAt !== "" && endsAt === null) return false;
  if (startsAt && endsAt && startsAt >= endsAt) return false;

  return true;
}

export function validStorefrontMarketingBlocks(value: unknown): value is StorefrontMarketingBlock[] {
  if (!Array.isArray(value) || value.length > 17 || value.some((block) => !validBlock(block))) return false;
  const ids = new Set<string>();
  const positions = new Map<StorefrontMarketingPlacement, number[]>();
  for (const block of value) {
    if (ids.has(block.id)) return false;
    ids.add(block.id);
    const placementPositions = positions.get(block.placement) ?? [];
    placementPositions.push(block.position);
    positions.set(block.placement, placementPositions);
  }
  for (const [placement, placementPositions] of positions) {
    if (placementPositions.length > STOREFRONT_MARKETING_PLACEMENT_LIMITS[placement]) return false;
    placementPositions.sort((left, right) => left - right);
    if (placementPositions.some((position, index) => position !== index + 1)) return false;
  }
  return true;
}

export function cloneStorefrontMarketingBlocks(value: StorefrontMarketingBlock[]): StorefrontMarketingBlock[] {
  return value.map((block) => ({ ...block }));
}
