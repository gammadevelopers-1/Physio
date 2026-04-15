"use client";

import ReactMarkdown from "react-markdown";
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
        className={`${widthClasses[data.maxWidth]} mx-auto prose prose-lg prose-headings:text-[var(--on-surface-default)] prose-p:text-[var(--on-surface-variant)] prose-li:text-[var(--on-surface-variant)] prose-strong:text-[var(--on-surface-default)] prose-a:text-[#a37f49] max-w-none`}
      >
        <ReactMarkdown>{data.content}</ReactMarkdown>
      </div>
    </section>
  );
}
