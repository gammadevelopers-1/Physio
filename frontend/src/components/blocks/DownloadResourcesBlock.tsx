"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  name?: string;
  size?: number;
  ext?: string;
}

interface DownloadItem {
  id: number;
  title: string;
  description?: string;
  file?: StrapiMedia;
  icon?: string;
}

interface DownloadResourcesBlockData {
  __component: "blocks.download-resources-block";
  id: number;
  title?: string;
  description?: string;
  resources?: DownloadItem[];
  columns?: "2" | "3" | "4";
  visibility?: string;
  position?: string;
}

interface DownloadResourcesBlockProps {
  data: DownloadResourcesBlockData;
  sideLoadedData: SideLoadedData;
}

const columnClasses: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function DownloadResourcesBlock({ data }: DownloadResourcesBlockProps) {
  const cols = data.columns || "3";

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        <div className={`grid ${columnClasses[cols]} gap-6 w-full`}>
          {data.resources?.map((res) => (
            <div
              key={res.id}
              className="flex flex-col gap-3 p-5 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm"
            >
              <div className="text-3xl">{res.icon || "\uD83D\uDCC4"}</div>
              <h3
                className="font-semibold text-[var(--on-surface-default)]"
                style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
              >
                {res.title}
              </h3>
              {res.description && (
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {res.description}
                </p>
              )}
              {res.file && (
                <a
                  href={getStrapiMediaUrl(res.file.url)}
                  download
                  className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
                >
                  Download
                  {res.file.ext && (
                    <span className="text-xs text-[var(--on-surface-variant)] uppercase">
                      ({res.file.ext.replace(".", "")})
                    </span>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
