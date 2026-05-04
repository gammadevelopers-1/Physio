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
  if (
    !data.title?.trim() &&
    !data.description?.trim() &&
    (!data.buttons || data.buttons.length === 0)
  ) {
    return null;
  }

  const primaryButton = data.buttons?.[0] ?? null;

  if (data.variant === "centered") {
    // CTASection expects a `data` prop shaped like HomePage.
    const ctaData: Partial<HomePage> = {
      ctaTitle: data.title,
      ctaDescription: data.description,
      ctaButtonLabel: primaryButton?.label ?? null,
      ctaButtonLink: primaryButton?.url ?? null,
      ctaBackgroundImage: data.backgroundImage,
    };

    return <CTASection data={ctaData as any} />;
  }

  // For 'image-left' and 'image-right' variants, use BecomeTrainer.
  // BecomeTrainer expects a `data` prop shaped like HomePage.
  const trainerData: Partial<HomePage> = {
    becomeTrainerTitle: data.title,
    becomeTrainerDescription: data.description,
    becomeTrainerButtonLabel: primaryButton?.label ?? null,
    becomeTrainerButtonLink: primaryButton?.url ?? null,
    becomeTrainerImage: data.image,
  };

  return <BecomeTrainer data={trainerData as any} />;
}
