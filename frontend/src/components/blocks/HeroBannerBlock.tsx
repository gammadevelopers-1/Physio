"use client";

import type {
  HeroBannerBlockData,
  SideLoadedData,
  HomePage,
} from "@/lib/strapi/types";
import Hero from "@/components/Hero";

interface HeroBannerBlockProps {
  data: HeroBannerBlockData;
  sideLoadedData: SideLoadedData;
}

export function HeroBannerBlock({ data }: HeroBannerBlockProps) {
  const hasButtons = data.buttons && data.buttons.length > 0;

  // Hero expects a `data` prop shaped like HomePage.
  // Map the generic block fields to the HomePage-shaped object.
  // Use empty string (not null) for buttons when none are added,
  // to prevent Hero from falling back to translation strings.
  const heroData: Partial<HomePage> = {
    heroTitle: data.title,
    heroTitleLine2: data.titleLine2 || "",
    heroTitleMobile: data.titleMobile,
    heroDescription: data.description,
    heroVideo: data.backgroundVideo,
    heroButton1Label: hasButtons ? (data.buttons![0]?.label ?? "") : "",
    heroButton1Link: hasButtons ? (data.buttons![0]?.url ?? null) : null,
    heroButton2Label: hasButtons && data.buttons!.length > 1 ? (data.buttons![1]?.label ?? "") : "",
    heroButton2Link: hasButtons && data.buttons!.length > 1 ? (data.buttons![1]?.url ?? null) : null,
    heroPartnerLogos: data.partnerLogos,
  };

  return <Hero data={heroData as any} />;
}
