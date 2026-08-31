import React from "react";
import ElegantStoryStage from "./ElegantStoryStage";
import type { ElegantEditorialIntroViewModel, ElegantStoryViewModel } from "./model";

interface Props {
  intro: ElegantEditorialIntroViewModel;
  stories: ElegantStoryViewModel[];
  onOpenStory: (story: ElegantStoryViewModel) => void;
  onOpenDiscovery: () => void;
}

export default function ElegantEditorialHero({ intro, stories, onOpenStory, onOpenDiscovery }: Props) {
  return (
    <section className="elegant-editorial-hero" aria-labelledby="elegant-editorial-title">
      <div className="elegant-editorial-intro">
        {intro.eyebrow?.trim() ? <p>{intro.eyebrow}</p> : null}
        <h1 id="elegant-editorial-title">{intro.title}</h1>
        {intro.subtitle?.trim() ? <span>{intro.subtitle}</span> : null}
        {intro.ctaLabel?.trim() ? <button type="button" onClick={onOpenDiscovery}>{intro.ctaLabel}</button> : null}
      </div>
      <ElegantStoryStage stories={stories} onOpenStory={onOpenStory} onOpenDiscovery={onOpenDiscovery} />
    </section>
  );
}
