import { describe, expect, it } from "vitest";
import {
  cloneStorefrontMarketingBlocks,
  type StorefrontMarketingBlock,
  validStorefrontMarketingBlocks,
} from "./storefrontMarketingBlocks";

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function asset(index: number): string {
  return `/api/store-assets/tenant-a/${uuid(100 + index)}`;
}

function block(index = 1, overrides: Partial<StorefrontMarketingBlock> = {}): StorefrontMarketingBlock {
  return {
    id: uuid(index),
    placement: "hero_bento",
    position: index,
    enabled: true,
    contentType: "category",
    title: `مساحة ${index}`,
    ctaLabel: "استكشف الآن",
    imageUrl: asset(index),
    altText: `صورة مساحة ${index}`,
    targetType: "products",
    disclosure: "none",
    ...overrides,
  };
}

describe("storefront marketing blocks contract", () => {
  it("accepts a bounded valid block", () => {
    expect(validStorefrontMarketingBlocks([block()])).toBe(true);
  });

  it("clones blocks before they enter mutable editor state", () => {
    const original = [block()];
    const cloned = cloneStorefrontMarketingBlocks(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  it("accepts the exact 22-block placement capacity including editorial stories", () => {
    const blocks = [
      ...Array.from({ length: 5 }, (_, index) => block(index + 1)),
      ...Array.from({ length: 2 }, (_, index) => block(index + 6, { placement: "side_ad", position: index + 1 })),
      ...Array.from({ length: 10 }, (_, index) => block(index + 8, { placement: "discovery", position: index + 1 })),
      ...Array.from({ length: 5 }, (_, index) => block(index + 18, { placement: "editorial_story", position: index + 1 })),
    ];
    expect(validStorefrontMarketingBlocks(blocks)).toBe(true);
  });

  it("rejects non-list values", () => {
    expect(validStorefrontMarketingBlocks({ 0: block() })).toBe(false);
  });

  it("rejects more than 22 blocks", () => {
    expect(validStorefrontMarketingBlocks(Array.from({ length: 23 }, (_, index) => block(index + 1)))).toBe(false);
  });

  it("rejects unknown block keys", () => {
    expect(validStorefrontMarketingBlocks([{ ...block(), injected: true }])).toBe(false);
  });

  it("rejects malformed UUID identifiers", () => {
    expect(validStorefrontMarketingBlocks([block(1, { id: "not-a-uuid" })])).toBe(false);
  });

  it("rejects duplicate identifiers", () => {
    expect(validStorefrontMarketingBlocks([block(1), block(2, { id: uuid(1), position: 2 })])).toBe(false);
  });

  it("enforces the limit of every placement", () => {
    expect(validStorefrontMarketingBlocks(Array.from({ length: 6 }, (_, index) => block(index + 1)))).toBe(false);
    expect(validStorefrontMarketingBlocks(Array.from({ length: 6 }, (_, index) => block(index + 1, { placement: "editorial_story" })))).toBe(false);
  });

  it("requires unique contiguous positions from one", () => {
    expect(validStorefrontMarketingBlocks([block(1), block(2, { position: 3 })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1), block(2, { position: 1 })])).toBe(false);
  });

  it("checks trimmed required copy lengths", () => {
    expect(validStorefrontMarketingBlocks([block(1, { title: " " })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { ctaLabel: "x" })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { altText: "x" })])).toBe(false);
  });

  it("bounds optional copy fields", () => {
    expect(validStorefrontMarketingBlocks([block(1, { subtitle: "x".repeat(181) })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { badge: "x".repeat(41) })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { sponsorName: "x".repeat(81) })])).toBe(false);
  });

  it("accepts only managed same-shape image paths", () => {
    expect(validStorefrontMarketingBlocks([block(1, { imageUrl: "https://cdn.example.test/image.webp" })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { mobileImageUrl: "data:image/png;base64,unsafe" })])).toBe(false);
  });

  it("accepts six-digit colors and rejects arbitrary CSS", () => {
    expect(validStorefrontMarketingBlocks([block(1, { backgroundColor: "#A1b2C3", textColor: "#ffffff" })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { textColor: "var(--secret)" })])).toBe(false);
  });

  it("keeps opacity and focal points as integer percentages", () => {
    expect(validStorefrontMarketingBlocks([block(1, { overlayOpacity: 30, focalPointX: 50, focalPointY: 100 })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { overlayOpacity: 30.5 })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { focalPointX: 101 })])).toBe(false);
  });

  it("forbids a value on the all-products target", () => {
    expect(validStorefrontMarketingBlocks([block(1, { targetType: "products", targetValue: "General" })])).toBe(false);
  });

  it("requires UUID values for product targets", () => {
    expect(validStorefrontMarketingBlocks([block(1, { targetType: "product", targetValue: uuid(200) })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { targetType: "product", targetValue: "sku-1" })])).toBe(false);
  });

  it("requires a non-empty category target", () => {
    expect(validStorefrontMarketingBlocks([block(1, { targetType: "category", targetValue: "عطور" })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { targetType: "category", targetValue: " " })])).toBe(false);
  });

  it("allows only disclosed HTTPS external campaigns without credentials", () => {
    const campaign = { contentType: "campaign", targetType: "external", disclosure: "sponsored", sponsorName: "دار تجارية" } as const;
    expect(validStorefrontMarketingBlocks([block(1, { ...campaign, targetValue: "https://example.test/campaign" })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { ...campaign, targetValue: "http://example.test" })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { ...campaign, targetValue: "https://user:pass@example.test" })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { ...campaign, disclosure: "none", targetValue: "https://example.test" })])).toBe(false);
  });

  it("requires UTC RFC3339 schedules with an increasing interval", () => {
    expect(validStorefrontMarketingBlocks([block(1, { startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-09-02T00:00:00+00:00" })])).toBe(true);
    expect(validStorefrontMarketingBlocks([block(1, { startsAt: "2026-09-01T03:00:00+03:00" })])).toBe(false);
    expect(validStorefrontMarketingBlocks([block(1, { startsAt: "2026-09-02T00:00:00Z", endsAt: "2026-09-01T00:00:00Z" })])).toBe(false);
  });
});
