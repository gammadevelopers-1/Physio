"use client";

import type {
  TestimonialsCarouselBlockData,
  SideLoadedData,
  HomePage,
} from "@/lib/strapi/types";
import Testimonials from "@/components/Testimonials";

interface TestimonialsCarouselBlockProps {
  data: TestimonialsCarouselBlockData;
  sideLoadedData: SideLoadedData;
}

export function TestimonialsCarouselBlock({
  data,
  sideLoadedData,
}: TestimonialsCarouselBlockProps) {
  // Testimonials expects `sectionData` shaped like HomePage.
  const sectionData: Partial<HomePage> = {
    testimonialsTitle: data.title,
    testimonialsDescription: data.description,
  };

  return (
    <Testimonials
      testimonials={sideLoadedData.testimonials}
      sectionData={sectionData as any}
    />
  );
}
