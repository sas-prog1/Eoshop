// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ElegantEditorialHeader from "./ElegantEditorialHeader";
import ElegantStoriesHome from "./ElegantStoriesHome";
import type { ElegantDiscoveryViewModel, ElegantStoriesHomeViewModel, ElegantStoryViewModel } from "./model";

afterEach(cleanup);

function story(index: number): ElegantStoryViewModel {
  return {
    id: `story-${index}`,
    title: `قصة ${index}`,
    subtitle: `وصف القصة ${index}`,
    ctaLabel: "تسوق القصة",
    imageUrl: `https://cdn.example.test/story-${index}.webp`,
    mobileImageUrl: `https://cdn.example.test/story-${index}-mobile.webp`,
    altText: `صورة القصة ${index}`,
    disclosure: index === 2 ? "sponsored" : "none",
    sponsorName: index === 2 ? "دار الاختبار" : undefined,
    targetType: "products",
  };
}

const discoveryItems: ElegantDiscoveryViewModel[] = [
  { id: "discovery-1", title: "حقائب مختارة", imageUrl: "https://cdn.example.test/bags.webp", altText: "حقيبة مختارة", targetType: "products" },
  { id: "discovery-2", title: "عطور استثنائية", imageUrl: "https://cdn.example.test/perfume.webp", altText: "عطر مختار", disclosure: "sponsored", sponsorName: "دار الاختبار", targetType: "products" },
];

function model(stories: ElegantStoryViewModel[]): ElegantStoriesHomeViewModel {
  return {
    intro: {
      eyebrow: "قصص تستحق الاكتشاف",
      title: "إطلاق الموسم",
      subtitle: "تشكيلة جديدة ورؤية مختلفة.",
    },
    stories,
    discoveryItems,
  };
}

describe("ElegantStoriesHome isolated presentation", () => {
  it("renders at most five independent stories and derives one center feature", () => {
    const onOpenStory = vi.fn();
    const view = render(
      <ElegantStoriesHome
        model={model([1, 2, 3, 4, 5, 6].map(story))}
        onOpenStory={onOpenStory}
        onOpenDiscovery={vi.fn()}
        onOpenDiscoveryAll={vi.fn()}
      />,
    );

    const stage = view.container.querySelector("[data-elegant-story-count]");
    expect(stage?.getAttribute("data-elegant-story-count")).toBe("5");
    expect(view.container.querySelectorAll("[data-elegant-story-id]")).toHaveLength(5);
    expect(view.container.querySelectorAll('[data-elegant-story-featured="true"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-elegant-story-id="story-3"]')?.getAttribute("data-elegant-story-featured")).toBe("true");
    expect(screen.queryByText("قصة 6")).toBeNull();

    const firstImage = screen.getByAltText("صورة القصة 1");
    expect(firstImage.getAttribute("loading")).toBe("eager");
    expect(firstImage.getAttribute("fetchpriority")).toBe("high");
    expect(screen.getByAltText("صورة القصة 2").getAttribute("loading")).toBe("lazy");
    expect(view.container.querySelector('source[srcset="https://cdn.example.test/story-1-mobile.webp"]')).not.toBeNull();
    expect(screen.getAllByText("برعاية · دار الاختبار")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "تسوق القصة" })[0]);
    expect(onOpenStory).toHaveBeenCalledWith(expect.objectContaining({ id: "story-1" }));
  });

  it.each([0, 1, 2, 3, 4, 5])("keeps the %s-story state bounded without placeholder stories", (count) => {
    const view = render(
      <ElegantStoriesHome
        model={model(Array.from({ length: count }, (_, index) => story(index + 1)))}
        onOpenStory={vi.fn()}
        onOpenDiscovery={vi.fn()}
        onOpenDiscoveryAll={vi.fn()}
      />,
    );
    expect(view.container.querySelector("[data-elegant-story-count]")?.getAttribute("data-elegant-story-count")).toBe(String(count));
    expect(view.container.querySelectorAll("[data-elegant-story-id]")).toHaveLength(count);
  });

  it("renders image-only discovery tiles without prices or cart actions", () => {
    const onOpenDiscovery = vi.fn();
    const onOpenDiscoveryAll = vi.fn();
    render(
      <ElegantStoriesHome
        model={model([])}
        onOpenStory={vi.fn()}
        onOpenDiscovery={onOpenDiscovery}
        onOpenDiscoveryAll={onOpenDiscoveryAll}
      />,
    );

    expect(screen.getByRole("heading", { name: "مختارات المحرر" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "فتح حقائب مختارة" }));
    expect(onOpenDiscovery).toHaveBeenCalledWith(expect.objectContaining({ id: "discovery-1" }));
    expect(screen.queryByText(/ر\.س/)).toBeNull();
    expect(screen.queryByRole("button", { name: /إضافة/ })).toBeNull();
    expect(screen.getByText("برعاية · دار الاختبار")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "استكشف المختارات" }));
    expect(onOpenDiscoveryAll).toHaveBeenCalledTimes(1);
  });
});

describe("ElegantEditorialHeader truthful capabilities", () => {
  it("exposes supported navigation and omits account, favorites and blog controls", () => {
    const onSearchChange = vi.fn();
    const onSearchSubmit = vi.fn();
    const onOpenCart = vi.fn();
    const onSelectCategory = vi.fn();
    render(
      <ElegantEditorialHeader
        storeName="متجر فيلور"
        categories={["نساء", "رجال", "الجمال", "المنزل", "إلكترونيات", "قسم سادس"]}
        cartCount={2}
        searchQuery=""
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onOpenHome={vi.fn()}
        onOpenProducts={vi.fn()}
        onOpenAbout={vi.fn()}
        onOpenCart={onOpenCart}
        onSelectCategory={onSelectCategory}
      />,
    );

    expect(screen.queryByText("المدونة")).toBeNull();
    expect(screen.queryByLabelText(/المفضلة|الحساب/)).toBeNull();
    expect(screen.queryByText("قسم سادس")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "نساء" })[0]);
    expect(onSelectCategory).toHaveBeenCalledWith("نساء");
    fireEvent.change(screen.getAllByRole("searchbox")[0], { target: { value: "عطر" } });
    expect(onSearchChange).toHaveBeenCalledWith("عطر");
    fireEvent.submit(screen.getAllByRole("search")[0]);
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "فتح السلة، 2 منتج" }));
    expect(onOpenCart).toHaveBeenCalledTimes(1);
  });
});
