import React from "react";
import ElegantDiscoveryRail from "./ElegantDiscoveryRail";
import ElegantEditorialHero from "./ElegantEditorialHero";
import { DEFAULT_ELEGANT_STORIES_TOKENS, type ElegantStoriesHomeViewModel, type ElegantStoriesThemeTokens, type ElegantStoryViewModel } from "./model";
import "./elegantStories.css";

interface Props {
  model: ElegantStoriesHomeViewModel;
  tokens?: Partial<ElegantStoriesThemeTokens>;
  onOpenStory: (story: ElegantStoryViewModel) => void;
  onOpenDiscovery: (item: ElegantStoriesHomeViewModel["discoveryItems"][number]) => void;
  onOpenDiscoveryAll: () => void;
}

type ElegantCssProperties = React.CSSProperties & {
  "--elegant-background": string;
  "--elegant-surface": string;
  "--elegant-ink": string;
  "--elegant-muted-ink": string;
  "--elegant-border": string;
  "--elegant-accent": string;
};

export default function ElegantStoriesHome({ model, tokens, onOpenStory, onOpenDiscovery, onOpenDiscoveryAll }: Props) {
  const resolvedTokens = { ...DEFAULT_ELEGANT_STORIES_TOKENS, ...tokens };
  const style: ElegantCssProperties = {
    "--elegant-background": resolvedTokens.background,
    "--elegant-surface": resolvedTokens.surface,
    "--elegant-ink": resolvedTokens.ink,
    "--elegant-muted-ink": resolvedTokens.mutedInk,
    "--elegant-border": resolvedTokens.border,
    "--elegant-accent": resolvedTokens.accent,
  };

  return (
    <main className="elegant-stories-home" data-elegant-stories-home dir="rtl" style={style}>
      <ElegantEditorialHero intro={model.intro} stories={model.stories} onOpenStory={onOpenStory} onOpenDiscovery={onOpenDiscoveryAll} />

      <ElegantDiscoveryRail items={model.discoveryItems} onOpen={onOpenDiscovery} onOpenAll={onOpenDiscoveryAll} />
    </main>
  );
}
