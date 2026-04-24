"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  name?: string;
}

interface PdfViewerBlockData {
  __component: "blocks.pdf-viewer-block";
  id: number;
  title?: string;
  description?: string;
  pdfFile?: StrapiMedia;
  showDownloadButton?: boolean;
  downloadLabel?: string;
  height?: number;
  visibility?: string;
  position?: string;
}

interface PdfViewerBlockProps {
  data: PdfViewerBlockData;
  sideLoadedData: SideLoadedData;
}

export function PdfViewerBlock({ data }: PdfViewerBlockProps) {
  const pdfUrl = data.pdfFile ? getStrapiMediaUrl(data.pdfFile.url) : null;
  const height = data.height || 600;

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6 items-center">
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

        {pdfUrl && (
          <>
            <iframe
              src={pdfUrl}
              className="w-full rounded-xl border border-[var(--outline-subtle)]"
              style={{ height: `${height}px` }}
              title={data.title || "PDF viewer"}
            />
            {data.showDownloadButton !== false && (
              <a
                href={pdfUrl}
                download
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium"
              >
                {data.downloadLabel || "Download PDF"}
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
}
