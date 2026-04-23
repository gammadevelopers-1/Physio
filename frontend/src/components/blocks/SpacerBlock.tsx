"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface SpacerBlockData {
  __component: "blocks.spacer-block";
  id: number;
  height?: "small" | "medium" | "large" | "extra-large";
  showDivider?: boolean;
  dividerColor?: string;
  visibility?: string;
  position?: string;
}

interface SpacerBlockProps {
  data: SpacerBlockData;
  sideLoadedData: SideLoadedData;
}

const heightMap: Record<string, string> = {
  small: "h-6 lg:h-8",
  medium: "h-12 lg:h-16",
  large: "h-20 lg:h-28",
  "extra-large": "h-32 lg:h-40",
};

export function SpacerBlock({ data }: SpacerBlockProps) {
  const h = heightMap[data.height || "medium"] || heightMap.medium;

  return (
    <div className={`${h} flex items-center justify-center px-4 lg:px-16`}>
      {data.showDivider && (
        <hr
          className="w-full max-w-[1280px] border-t"
          style={{ borderColor: data.dividerColor || "var(--color-border)" }}
        />
      )}
    </div>
  );
}
