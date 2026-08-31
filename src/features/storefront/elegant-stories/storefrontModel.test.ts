import { describe, expect, it } from "vitest";
import type { StorefrontMarketingBlock } from "../../../contracts/storefrontMarketingBlocks";
import { ELEGANT_PRESET } from "../../../types";
import { elegantStoriesHomeModel } from "./storefrontModel";

const asset = (id: string) => `/api/store-assets/tenant/${id}`;

function block(
  id: string,
  placement: StorefrontMarketingBlock["placement"],
  position: number,
  overrides: Partial<StorefrontMarketingBlock> = {},
): StorefrontMarketingBlock {
  return {
    id,
    placement,
    position,
    enabled: true,
    contentType: "campaign",
    title: `مساحة ${position}`,
    ctaLabel: "اكتشف",
    imageUrl: asset(id),
    altText: `صورة ${position}`,
    targetType: "products",
    disclosure: "none",
    ...overrides,
  };
}

describe("elegantStoriesHomeModel", () => {
  it("maps active server-owned stories and discovery in position order", () => {
    const now = new Date("2026-08-31T12:00:00Z");
    const config = {
      ...ELEGANT_PRESET,
      marketingBlocks: [
        block("00000000-0000-4000-8000-000000000002", "editorial_story", 2, { title: "الثانية", targetType: "category", targetValue: "عطور" }),
        block("00000000-0000-4000-8000-000000000001", "editorial_story", 1, { title: "الأولى" }),
        block("00000000-0000-4000-8000-000000000003", "editorial_story", 3, { enabled: false }),
        block("00000000-0000-4000-8000-000000000004", "editorial_story", 4, { startsAt: "2026-09-01T00:00:00Z" }),
        block("00000000-0000-4000-8000-000000000005", "discovery", 1, { title: "مختارة", endsAt: "2026-09-01T00:00:00Z" }),
        block("00000000-0000-4000-8000-000000000006", "side_ad", 1),
      ],
    };

    const model = elegantStoriesHomeModel(config, now);

    expect(model.stories.map((story) => story.title)).toEqual(["الأولى", "الثانية"]);
    expect(model.stories[1]).toMatchObject({ targetType: "category", targetValue: "عطور" });
    expect(model.discoveryItems).toHaveLength(1);
    expect(model.discoveryItems[0]).not.toHaveProperty("price");
  });

  it("uses the configured hero copy and bounded fallbacks", () => {
    expect(elegantStoriesHomeModel({
      ...ELEGANT_PRESET,
      heroBannerBadge: " موسمي ",
      heroBannerTitle: " قصة المتجر ",
      heroBannerSubtitle: " وصف قصير ",
      heroBannerButtonText: " عرض المختارات ",
    }).intro).toEqual({ eyebrow: "موسمي", title: "قصة المتجر", subtitle: "وصف قصير", ctaLabel: "عرض المختارات" });

    expect(elegantStoriesHomeModel({
      ...ELEGANT_PRESET,
      heroBannerBadge: "",
      heroBannerTitle: "",
      heroBannerSubtitle: "",
      heroBannerButtonText: "",
      slogan: "هوية المتجر",
    }).intro).toEqual({ eyebrow: "قصص تستحق الاكتشاف", title: "إطلاق الموسم", subtitle: "هوية المتجر", ctaLabel: undefined });
  });
});
