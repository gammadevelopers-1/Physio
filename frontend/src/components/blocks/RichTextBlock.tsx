"use client";

import type {
  RichTextBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";

interface RichTextBlockProps {
  data: RichTextBlockData;
  sideLoadedData: SideLoadedData;
}

const widthClasses: Record<RichTextBlockData["maxWidth"], string> = {
  narrow: "max-w-2xl",
  medium: "max-w-4xl",
  full: "max-w-full",
};

export function RichTextBlock({ data }: RichTextBlockProps) {
  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div
        className={`${widthClasses[data.maxWidth]} mx-auto prose prose-lg`}
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
    </section>
  );
}
