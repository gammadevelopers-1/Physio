"use client";

import type {
  CTABannerBlockData,
  SideLoadedData,
  HomePage,
} from "@/lib/strapi/types";
import BecomeTrainer from "@/components/BecomeTrainer";
import CTASection from "@/components/CTASection";

interface CTABannerBlockProps {
  data: CTABannerBlockData;
  sideLoadedData: SideLoadedData;
}

export function CTABannerBlock({ data }: CTABannerBlockProps) {
  if (data.variant === "centered") {
    // CTASection expects a `data` prop shaped like HomePage.
    const ctaData: Partial<HomePage> = {
      ctaTitle: data.title,
      ctaDescription: data.description,
      ctaButtonLabel: data.buttons?.[0]?.label ?? null,
      ctaBackgroundImage: data.backgroundImage,
    };

    return <CTASection data={ctaData as any} />;
  }

  // For 'image-left' and 'image-right' variants, use BecomeTrainer.
  // BecomeTrainer expects a `data` prop shaped like HomePage.
  const trainerData: Partial<HomePage> = {
    becomeTrainerTitle: data.title,
    becomeTrainerDescription: data.description,
    becomeTrainerButtonLabel: data.buttons?.[0]?.label ?? null,
    becomeTrainerImage: data.image,
  };

  return <BecomeTrainer data={trainerData as any} />;
}
