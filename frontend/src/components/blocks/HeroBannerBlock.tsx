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
  // Hero expects a `data` prop shaped like HomePage.
  // Map the generic block fields to the HomePage-shaped object.
  const heroData: Partial<HomePage> = {
    heroTitle: data.title,
    heroTitleLine2: data.titleLine2,
    heroTitleMobile: data.titleMobile,
    heroDescription: data.description,
    heroVideo: data.backgroundVideo,
    heroButton1Label: data.buttons?.[0]?.label ?? null,
    heroButton1Link: data.buttons?.[0]?.url ?? null,
    heroButton2Label: data.buttons?.[1]?.label ?? null,
    heroButton2Link: data.buttons?.[1]?.url ?? null,
    heroPartnerLogos: data.partnerLogos,
  };

  return <Hero data={heroData as any} />;
}
