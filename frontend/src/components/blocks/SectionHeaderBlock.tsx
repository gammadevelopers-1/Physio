"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface SectionHeaderBlockData {
  __component: "blocks.section-header-block";
  id: number;
  title: string;
  subtitle?: string;
  alignment?: "left" | "center" | "right";
  showDivider?: boolean;
  headingLevel?: "h1" | "h2" | "h3" | "h4";
  anchorId?: string;
  visibility?: string;
  position?: string;
}

interface SectionHeaderBlockProps {
  data: SectionHeaderBlockData;
  sideLoadedData: SideLoadedData;
}

const alignClasses: Record<string, string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const headingSizes: Record<string, string> = {
  h1: "var(--typeface-font-styles-heading-h1)",
  h2: "var(--typeface-font-styles-heading-h2, var(--typeface-font-styles-heading-h1))",
  h3: "var(--typeface-font-styles-heading-h3, var(--typeface-font-styles-heading-h5))",
  h4: "var(--typeface-font-styles-heading-h4, var(--typeface-font-styles-heading-h5))",
};

export function SectionHeaderBlock({ data }: SectionHeaderBlockProps) {
  if (!data.title?.trim() && !data.subtitle?.trim()) return null;

  const alignment = data.alignment || "center";
  const level = data.headingLevel || "h2";

  const heading = (() => {
    const props = {
      className: "font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]",
      style: { fontSize: headingSizes[level] } as React.CSSProperties,
    };
    switch (level) {
      case "h1": return <h1 {...props}>{data.title}</h1>;
      case "h3": return <h3 {...props}>{data.title}</h3>;
      case "h4": return <h4 {...props}>{data.title}</h4>;
      default:   return <h2 {...props}>{data.title}</h2>;
    }
  })();

  return (
    <section className="px-4 lg:px-16 py-8 lg:py-12" id={data.anchorId || undefined}>
      <div className={`max-w-[1280px] mx-auto flex flex-col gap-4 ${alignClasses[alignment]}`}>
        {heading}
        {data.subtitle && (
          <p
            className="text-[var(--on-surface-variant)] leading-7 max-w-[768px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {data.subtitle}
          </p>
        )}
        {data.showDivider !== false && (
          <hr className="w-16 border-t-2 border-[var(--surface-container-primary)] mt-2" />
        )}
      </div>
    </section>
  );
}
