"use client";

import type {
  PartnersStripBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";
import Partners from "@/components/Partners";

interface PartnersStripBlockProps {
  data: PartnersStripBlockData;
  sideLoadedData: SideLoadedData;
}

export function PartnersStripBlock({
  data,
  sideLoadedData,
}: PartnersStripBlockProps) {
  return (
    <Partners
      partners={sideLoadedData.partners}
      sectionTitle={data.title}
    />
  );
}
