"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface AnchorLinkItem {
  id: number;
  label: string;
  anchorId: string;
}

interface AnchorLinksBlockData {
  __component: "blocks.anchor-links-block";
  id: number;
  title?: string;
  links?: AnchorLinkItem[];
  sticky?: boolean;
  variant?: "horizontal" | "vertical";
  visibility?: string;
  position?: string;
}

interface AnchorLinksBlockProps {
  data: AnchorLinksBlockData;
  sideLoadedData: SideLoadedData;
}

export function AnchorLinksBlock({ data }: AnchorLinksBlockProps) {
  return (
    <nav
      className={`px-4 lg:px-16 py-4 ${data.sticky ? "sticky top-0 z-30 bg-white shadow-sm" : ""}`}
    >
      <div className="max-w-[1280px] mx-auto">
        {data.title && (
          <p className="text-sm font-medium text-[var(--on-surface-variant)] mb-2">
            {data.title}
          </p>
        )}
        <ul
          className={
            data.variant === "vertical"
              ? "flex flex-col gap-2"
              : "flex flex-wrap items-center gap-4"
          }
        >
          {data.links?.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.anchorId}`}
                className="text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
