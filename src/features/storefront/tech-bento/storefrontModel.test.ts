import { describe, expect, it } from "vitest";
import type { StorefrontMarketingBlock } from "../../../contracts/storefrontMarketingBlocks";
import { TECH_PRESET } from "../../../types";
import { techBentoHomeModel } from "./storefrontModel";

function block(index: number, overrides: Partial<StorefrontMarketingBlock> = {}): StorefrontMarketingBlock {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    placement: "hero_bento",
    position: index,
    enabled: true,
    contentType: "category",
    title: `مساحة ${index}`,
    ctaLabel: "استكشف",
    imageUrl: `/api/store-assets/tenant/${`10000000-0000-4000-8000-${String(index).padStart(12, "0")}`}`,
    altText: `صورة ${index}`,
    targetType: "products",
    disclosure: "none",
    ...overrides,
  };
}

describe("techBentoHomeModel", () => {
  it("projects the three Tech placements in server order and ignores Elegant stories", () => {
    const marketingBlocks: StorefrontMarketingBlock[] = [
      block(2, { position: 2 }),
      block(1, { position: 1 }),
      block(6, { placement: "side_ad", position: 1, disclosure: "ad", sponsorName: "الراعي" }),
      block(7, { placement: "discovery", position: 1 }),
      block(8, { placement: "editorial_story", position: 1 }),
    ];

    const model = techBentoHomeModel({ ...TECH_PRESET, marketingBlocks }, new Date("2026-08-31T12:00:00Z"));

    expect(model.bentoItems.map((item) => item.id)).toEqual([marketingBlocks[1].id, marketingBlocks[0].id]);
    expect(model.sideAds).toHaveLength(1);
    expect(model.discoveryItems).toHaveLength(1);
    expect([...model.bentoItems, ...model.sideAds, ...model.discoveryItems].some((item) => item.id === marketingBlocks[4].id)).toBe(false);
  });

  it("filters disabled and scheduled blocks without mutating the shared contract", () => {
    const marketingBlocks = [
      block(1, { enabled: false }),
      block(2, { position: 2, startsAt: "2026-09-01T00:00:00Z" }),
      block(3, { position: 3, endsAt: "2026-08-31T11:59:59Z" }),
      block(4, { position: 4, startsAt: "2026-08-31T11:00:00Z", endsAt: "2026-08-31T13:00:00Z" }),
    ];

    const model = techBentoHomeModel({ ...TECH_PRESET, marketingBlocks }, new Date("2026-08-31T12:00:00Z"));
    expect(model.bentoItems.map((item) => item.id)).toEqual([marketingBlocks[3].id]);
  });

  it("caps each projection defensively at 5, 2 and 10", () => {
    const marketingBlocks = [
      ...Array.from({ length: 7 }, (_, index) => block(index + 1)),
      ...Array.from({ length: 4 }, (_, index) => block(index + 20, { placement: "side_ad", position: index + 1 })),
      ...Array.from({ length: 12 }, (_, index) => block(index + 30, { placement: "discovery", position: index + 1 })),
    ];
    const model = techBentoHomeModel({ ...TECH_PRESET, marketingBlocks });
    expect(model.bentoItems).toHaveLength(5);
    expect(model.sideAds).toHaveLength(2);
    expect(model.discoveryItems).toHaveLength(10);
  });

  it("uses the saved responsive hero presentation and trusted target", () => {
    const model = techBentoHomeModel({
      ...TECH_PRESET,
      showHeroBanner: true,
      heroBannerTitle: "اكتشف التقنية",
      heroBannerImage: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000901",
      heroBannerMobileImage: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000902",
      heroBannerTargetType: "category",
      heroBannerTargetValue: "إلكترونيات",
      heroBannerHeight: "large",
      heroBannerOverlayOpacity: 12,
      heroBannerFocalPointX: 72,
      heroBannerFocalPointY: 38,
    });

    expect(model.hero).toMatchObject({
      title: "اكتشف التقنية",
      height: "large",
      overlayOpacity: 12,
      focalPointX: 72,
      focalPointY: 38,
      targetType: "category",
      targetValue: "إلكترونيات",
    });
    expect(model.hero.mobileImageUrl).toContain("000000000902");
  });

  it("keeps the Tech hero visible when only one responsive image is configured", () => {
    const mobileOnly = techBentoHomeModel({
      ...TECH_PRESET,
      showHeroBanner: true,
      heroBannerImage: "",
      heroBannerMobileImage: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000903",
    });
    expect(mobileOnly.hero.imageUrl).toContain("000000000903");
    expect(mobileOnly.hero.mobileImageUrl).toBe(mobileOnly.hero.imageUrl);

    const desktopOnly = techBentoHomeModel({
      ...TECH_PRESET,
      showHeroBanner: true,
      heroBannerImage: "/api/store-assets/tenant/00000000-0000-4000-8000-000000000904",
      heroBannerMobileImage: "",
    });
    expect(desktopOnly.hero.mobileImageUrl).toBe(desktopOnly.hero.imageUrl);
  });

  it("derives unique categories from published products only", () => {
    const baseProduct = TECH_PRESET.products[0];
    const model = techBentoHomeModel({
      ...TECH_PRESET,
      products: [
        { ...baseProduct, id: "published-1", status: "published", category: " إلكترونيات " },
        { ...baseProduct, id: "published-2", status: "published", category: "إلكترونيات" },
        { ...baseProduct, id: "published-3", status: "published", category: "المنزل" },
        { ...baseProduct, id: "draft-1", status: "draft", category: "مسودة" },
        { ...baseProduct, id: "archived-1", status: "archived", category: "مؤرشف" },
      ],
    });

    expect(model.categories).toEqual(["إلكترونيات", "المنزل"]);
  });

  it("fills unused Bento slots from real published categories without persisting parallel blocks", () => {
    const baseProduct = TECH_PRESET.products[0];
    const configured = block(1, { targetType: "category", targetValue: "إلكترونيات" });
    const model = techBentoHomeModel({
      ...TECH_PRESET,
      marketingBlocks: [configured],
      products: [
        { ...baseProduct, id: "published-1", status: "published", category: "إلكترونيات" },
        { ...baseProduct, id: "published-2", status: "published", category: "المنزل" },
        { ...baseProduct, id: "draft-1", status: "draft", category: "مسودة" },
      ],
    });

    expect(model.bentoItems).toHaveLength(2);
    expect(model.bentoItems[0].id).toBe(configured.id);
    expect(model.bentoItems[1]).toMatchObject({
      title: "المنزل",
      targetType: "category",
      targetValue: "المنزل",
      derivedFromCategory: true,
    });
    expect(model.bentoItems.some((item) => item.title === "مسودة")).toBe(false);
    expect(configured).not.toHaveProperty("derivedFromCategory");
  });

  it("keeps legacy stores truthful with empty marketing collections", () => {
    const model = techBentoHomeModel({ ...TECH_PRESET, marketingBlocks: undefined, showHeroBanner: false });
    expect(model.bentoItems).toEqual([]);
    expect(model.sideAds).toEqual([]);
    expect(model.discoveryItems).toEqual([]);
    expect(model.categories).toEqual([]);
    expect(model.hero.imageUrl).toBeUndefined();
  });
});
