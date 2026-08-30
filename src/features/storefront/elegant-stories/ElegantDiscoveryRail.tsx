import React from "react";
import { ArrowLeft } from "lucide-react";
import { clampPercentage, type ElegantDiscoveryViewModel } from "./model";

interface Props {
  items: ElegantDiscoveryViewModel[];
  onOpen: (item: ElegantDiscoveryViewModel) => void;
  onOpenAll: () => void;
}

const disclosureLabel = {
  none: "",
  ad: "إعلان",
  sponsored: "برعاية",
} as const;

export default function ElegantDiscoveryRail({ items, onOpen, onOpenAll }: Props) {
  const visibleItems = items.slice(0, 10);
  if (visibleItems.length === 0) return null;

  return (
    <section className="elegant-discovery" data-elegant-discovery aria-labelledby="elegant-discovery-title">
      <div className="elegant-discovery__heading">
        <h2 id="elegant-discovery-title">مختارات المحرر</h2>
        <button type="button" onClick={onOpenAll}>عرض الكل <ArrowLeft aria-hidden="true" /></button>
      </div>

      <div className="elegant-discovery__rail" role="list" aria-label="مختارات المحرر">
        {visibleItems.map((item) => {
          const disclosure = item.disclosure ?? "none";
          const focalX = clampPercentage(item.focalPointX, 50);
          const focalY = clampPercentage(item.focalPointY, 50);

          return (
            <article key={item.id} role="listitem" className="elegant-discovery-tile">
              <button type="button" onClick={() => onOpen(item)} aria-label={`فتح ${item.title}`}>
                <picture>
                  {item.mobileImageUrl?.trim() ? <source media="(max-width: 767px)" srcSet={item.mobileImageUrl} /> : null}
                  <img
                    src={item.imageUrl}
                    alt={item.altText}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 767px) 44vw, (max-width: 1279px) 28vw, 13vw"
                    style={{ objectPosition: `${focalX}% ${focalY}%` }}
                  />
                </picture>
                <span className="elegant-discovery-tile__shade" aria-hidden="true" />
                <span className="elegant-discovery-tile__title">{item.title}</span>
                {disclosure !== "none" || item.badge?.trim() ? (
                  <span className="elegant-discovery-tile__meta">
                    {disclosure !== "none" ? `${disclosureLabel[disclosure]}${item.sponsorName?.trim() ? ` · ${item.sponsorName}` : ""}` : item.badge}
                  </span>
                ) : null}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
