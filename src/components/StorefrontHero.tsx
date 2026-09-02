import React from "react";
import type { StoreConfig } from "../types";
import { readableAccent, readableForeground } from "../utils/readableForeground";

interface Props {
  config: StoreConfig;
  isElegant: boolean;
  primaryColor: string;
  secondaryColor: string;
  onOpen: () => void;
}

const heroHeightClass: Record<NonNullable<StoreConfig["heroBannerHeight"]>, string> = {
  compact: "min-h-[300px] md:min-h-[340px]",
  medium: "min-h-[390px] md:min-h-[460px]",
  large: "min-h-[500px] md:min-h-[600px]",
};

export default function StorefrontHero({ config, isElegant, primaryColor, secondaryColor, onOpen }: Props) {
  const height = config.heroBannerHeight ?? "medium";
  const desktopImage = config.heroBannerImage?.trim() || config.heroBannerMobileImage?.trim();
  const mobileImage = config.heroBannerMobileImage?.trim() || desktopImage;
  const imageVisible = config.showHeroBanner === true && Boolean(desktopImage);
  const overlayOpacity = Math.min(100, Math.max(0, config.heroBannerOverlayOpacity ?? 35)) / 100;
  const cardBackground = config.cardBgColor || "#FFFFFF";
  const borderColor = config.borderColor || (isElegant ? "#F2EAE1" : "#1E293B");
  const textColor = imageVisible ? "#FFFFFF" : readableAccent(secondaryColor, cardBackground);
  const bodyColor = imageVisible ? "rgba(255,255,255,0.9)" : readableAccent(config.textColor || "#475569", cardBackground);

  return (
    <section
      data-storefront-hero
      data-storefront-hero-height={height}
      className={`relative isolate flex overflow-hidden rounded-[2rem] border shadow-sm ${heroHeightClass[height]}`}
      style={{ backgroundColor: isElegant ? cardBackground : "#020617", borderColor }}
    >
      {imageVisible && (
        <picture className="absolute inset-0 h-full w-full">
          {mobileImage ? <source media="(max-width: 767px)" srcSet={mobileImage} /> : null}
          <img
            src={desktopImage}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
            sizes="100vw"
            className="h-full w-full object-cover"
            style={{ objectPosition: `${config.heroBannerFocalPointX ?? 50}% ${config.heroBannerFocalPointY ?? 50}%` }}
            referrerPolicy="no-referrer"
          />
        </picture>
      )}
      {imageVisible && <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />}
      {imageVisible && <div className="absolute inset-0 bg-gradient-to-l from-slate-950/90 via-slate-950/65 to-slate-950/30" />}
      {!imageVisible && isElegant && <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent to-current opacity-[0.04]" style={{ color: primaryColor }} />}

      <div className="relative z-10 flex w-full items-center px-5 py-10 sm:px-8 md:px-12 md:py-14">
        <div className="max-w-3xl space-y-5 text-right">
          {config.heroBannerBadge?.trim() && (
            <span
              className="inline-flex rounded-full border px-3 py-1.5 text-xs font-black backdrop-blur-sm"
              style={{
                borderColor: imageVisible ? "rgba(255,255,255,0.35)" : borderColor,
                backgroundColor: imageVisible ? "rgba(15,23,42,0.38)" : `${primaryColor}12`,
                color: imageVisible ? "#FFFFFF" : readableAccent(primaryColor, cardBackground),
              }}
            >
              {config.heroBannerBadge}
            </span>
          )}
          <h1 className="max-w-2xl text-3xl font-black leading-[1.3] sm:text-4xl md:text-5xl" style={{ color: textColor, textShadow: imageVisible ? "0 2px 18px rgba(0,0,0,0.65)" : undefined }}>
            {config.heroBannerTitle?.trim() || config.storeName}
          </h1>
          <p className="max-w-2xl text-sm leading-8 sm:text-base" style={{ color: bodyColor, textShadow: imageVisible ? "0 1px 12px rgba(0,0,0,0.7)" : undefined }}>
            {config.heroBannerSubtitle?.trim() || config.slogan}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="min-h-11 rounded-xl px-6 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transform-none"
            style={{ backgroundColor: primaryColor, color: readableForeground(primaryColor), outlineColor: primaryColor }}
          >
            {config.heroBannerButtonText?.trim() || "تصفح المنتجات"}
          </button>
        </div>
      </div>
    </section>
  );
}
