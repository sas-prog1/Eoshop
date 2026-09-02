import type { StorefrontMarketingTargetType } from "../../../contracts/storefrontMarketingBlocks";

export type ElegantStoryDisclosure = "none" | "ad" | "sponsored";

export interface ElegantStoryViewModel {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  ctaLabel: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  backgroundColor?: string;
  foregroundColor?: string;
  overlayOpacity?: number;
  focalPointX?: number;
  focalPointY?: number;
  disclosure?: ElegantStoryDisclosure;
  sponsorName?: string;
  targetType: StorefrontMarketingTargetType;
  targetValue?: string;
  visible?: boolean;
}

export interface ElegantDiscoveryViewModel {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  badge?: string;
  disclosure?: ElegantStoryDisclosure;
  sponsorName?: string;
  focalPointX?: number;
  focalPointY?: number;
  targetType: StorefrontMarketingTargetType;
  targetValue?: string;
}

export interface ElegantEditorialIntroViewModel {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  targetType: Exclude<StorefrontMarketingTargetType, "external">;
  targetValue?: string;
}

export interface ElegantStoriesThemeTokens {
  background: string;
  surface: string;
  ink: string;
  mutedInk: string;
  border: string;
  accent: string;
}

export interface ElegantStoriesHomeViewModel {
  intro: ElegantEditorialIntroViewModel;
  stories: ElegantStoryViewModel[];
  discoveryItems: ElegantDiscoveryViewModel[];
}

export const DEFAULT_ELEGANT_STORIES_TOKENS: ElegantStoriesThemeTokens = {
  background: "#fbfaf7",
  surface: "#ffffff",
  ink: "#171717",
  mutedInk: "#625f5a",
  border: "#e8e4de",
  accent: "#7a2e2e",
};

export function clampPercentage(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}
