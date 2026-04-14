"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface BreadcrumbItem {
  id: number;
  label: string;
  url: string;
  variant?: string;
  openInNewTab?: boolean;
}

interface BreadcrumbBlockData {
  __component: "blocks.breadcrumb-block";
  id: number;
  items?: BreadcrumbItem[];
  separator?: string;
  visibility?: string;
  position?: string;
}

interface BreadcrumbBlockProps {
  data: BreadcrumbBlockData;
  sideLoadedData: SideLoadedData;
}

export function BreadcrumbBlock({ data }: BreadcrumbBlockProps) {
  const separator = data.separator || "/";

  return (
    <nav className="px-4 lg:px-16 py-3" aria-label="Breadcrumb">
      <div className="max-w-[1280px] mx-auto">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {data.items?.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1">
              {index > 0 && (
                <span className="text-[var(--on-surface-variant)] mx-1">
                  {separator}
                </span>
              )}
              {index === (data.items?.length || 0) - 1 ? (
                <span className="text-[var(--on-surface-variant)] font-medium">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.url}
                  className="text-[var(--surface-container-primary)] hover:underline"
                  {...(item.openInNewTab
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
