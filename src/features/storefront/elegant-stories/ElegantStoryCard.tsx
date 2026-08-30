import React from "react";
import { ArrowLeft } from "lucide-react";
import { clampPercentage, type ElegantStoryViewModel } from "./model";

interface Props {
  key?: React.Key;
  story: ElegantStoryViewModel;
  featured: boolean;
  priority: boolean;
  onOpen: (story: ElegantStoryViewModel) => void;
}

const disclosureLabel = {
  none: "",
  ad: "إعلان",
  sponsored: "برعاية",
} as const;

export default function ElegantStoryCard({ story, featured, priority, onOpen }: Props) {
  const disclosure = story.disclosure ?? "none";
  const overlayOpacity = Math.max(0.28, clampPercentage(story.overlayOpacity, 44) / 100);
  const focalX = clampPercentage(story.focalPointX, 50);
  const focalY = clampPercentage(story.focalPointY, 50);
  const descriptionId = story.subtitle?.trim() ? `elegant-story-description-${story.id}` : undefined;

  return (
    <article
      className="elegant-story-card"
      data-elegant-story-id={story.id}
      data-elegant-story-featured={featured ? "true" : "false"}
      style={{ backgroundColor: story.backgroundColor || "#302724", color: story.foregroundColor || "#ffffff" }}
    >
      {story.imageUrl.trim() ? (
        <picture className="elegant-story-card__picture">
          {story.mobileImageUrl?.trim() ? <source media="(max-width: 767px)" srcSet={story.mobileImageUrl} /> : null}
          <img
            src={story.imageUrl}
            alt={story.altText}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            sizes="(max-width: 767px) 82vw, (max-width: 1279px) 42vw, 24vw"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
          />
        </picture>
      ) : null}
      <span
        aria-hidden="true"
        className="elegant-story-card__overlay"
        style={{ background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.36}) 0%, rgba(0,0,0,${overlayOpacity}) 78%, rgba(0,0,0,${Math.min(0.9, overlayOpacity + 0.18)}) 100%)` }}
      />
      <div className="elegant-story-card__content">
        <div className="elegant-story-card__meta">
          {disclosure !== "none" ? (
            <span className="elegant-story-card__disclosure">
              {disclosureLabel[disclosure]}{story.sponsorName?.trim() ? ` · ${story.sponsorName}` : ""}
            </span>
          ) : null}
          {story.badge?.trim() ? <span>{story.badge}</span> : null}
        </div>
        <div className="elegant-story-card__copy">
          <h2>{story.title}</h2>
          {story.subtitle?.trim() ? <p id={descriptionId}>{story.subtitle}</p> : null}
        </div>
        <button type="button" aria-describedby={descriptionId} onClick={() => onOpen(story)}>
          <span>{story.ctaLabel}</span>
          <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
