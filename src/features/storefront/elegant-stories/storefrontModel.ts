import type { StorefrontMarketingBlock, StorefrontMarketingPlacement } from "../../../contracts/storefrontMarketingBlocks";
import type { StoreConfig } from "../../../types";
import type { ElegantDiscoveryViewModel, ElegantStoriesHomeViewModel, ElegantStoryViewModel } from "./model";

function activeMarketingBlocks(
  config: StoreConfig,
  placement: StorefrontMarketingPlacement,
  now: Date,
): StorefrontMarketingBlock[] {
  const timestamp = now.getTime();
  return (config.marketingBlocks ?? [])
    .filter((block) => {
      if (!block.enabled || block.placement !== placement) return false;
      const startsAt = block.startsAt ? Date.parse(block.startsAt) : null;
      const endsAt = block.endsAt ? Date.parse(block.endsAt) : null;
      return (startsAt === null || startsAt <= timestamp) && (endsAt === null || endsAt > timestamp);
    })
    .sort((left, right) => left.position - right.position);
}

function storyFromBlock(block: StorefrontMarketingBlock): ElegantStoryViewModel {
  return {
    id: block.id,
    title: block.title,
    subtitle: block.subtitle,
    badge: block.badge,
    ctaLabel: block.ctaLabel,
    imageUrl: block.imageUrl,
    mobileImageUrl: block.mobileImageUrl,
    altText: block.altText,
    backgroundColor: block.backgroundColor,
    foregroundColor: block.textColor,
    overlayOpacity: block.overlayOpacity,
    focalPointX: block.focalPointX,
    focalPointY: block.focalPointY,
    disclosure: block.disclosure,
    sponsorName: block.sponsorName,
    targetType: block.targetType,
    targetValue: block.targetValue,
  };
}

function discoveryFromBlock(block: StorefrontMarketingBlock): ElegantDiscoveryViewModel {
  return {
    id: block.id,
    title: block.title,
    imageUrl: block.imageUrl,
    mobileImageUrl: block.mobileImageUrl,
    altText: block.altText,
    badge: block.badge,
    disclosure: block.disclosure,
    sponsorName: block.sponsorName,
    focalPointX: block.focalPointX,
    focalPointY: block.focalPointY,
    targetType: block.targetType,
    targetValue: block.targetValue,
  };
}

export function elegantStoriesHomeModel(config: StoreConfig, now = new Date()): ElegantStoriesHomeViewModel {
  return {
    intro: {
      eyebrow: config.heroBannerBadge?.trim() || "قصص تستحق الاكتشاف",
      title: config.heroBannerTitle?.trim() || "إطلاق الموسم",
      subtitle: config.heroBannerSubtitle?.trim() || config.slogan?.trim(),
      ctaLabel: config.heroBannerButtonText?.trim() || undefined,
      targetType: config.heroBannerTargetType ?? "products",
      targetValue: config.heroBannerTargetType && config.heroBannerTargetType !== "products"
        ? config.heroBannerTargetValue?.trim() || undefined
        : undefined,
    },
    stories: activeMarketingBlocks(config, "editorial_story", now).slice(0, 5).map(storyFromBlock),
    discoveryItems: activeMarketingBlocks(config, "discovery", now).slice(0, 10).map(discoveryFromBlock),
  };
}
