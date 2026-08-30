import React from "react";
import ElegantStoryCard from "./ElegantStoryCard";
import type { ElegantStoryViewModel } from "./model";

interface Props {
  stories: ElegantStoryViewModel[];
  onOpenStory: (story: ElegantStoryViewModel) => void;
  onOpenDiscovery: () => void;
}

export default function ElegantStoryStage({ stories, onOpenStory, onOpenDiscovery }: Props) {
  const visibleStories = stories.filter((story) => story.visible !== false).slice(0, 5);
  const featuredIndex = Math.floor((visibleStories.length - 1) / 2);

  if (visibleStories.length === 0) {
    return (
      <section className="elegant-story-stage elegant-story-stage--empty" data-elegant-story-count="0" aria-label="قصص المتجر">
        <p>لم يضف المتجر قصصًا موسمية بعد.</p>
        <button type="button" onClick={onOpenDiscovery}>استكشف المختارات</button>
      </section>
    );
  }

  return (
    <section
      className="elegant-story-stage"
      data-elegant-story-count={visibleStories.length}
      aria-label={`قصص المتجر، ${visibleStories.length}`}
    >
      {visibleStories.map((story, index) => (
        <ElegantStoryCard
          key={story.id}
          story={story}
          featured={index === featuredIndex && visibleStories.length >= 3}
          priority={index === 0}
          onOpen={onOpenStory}
        />
      ))}
    </section>
  );
}
