"use client";

import type {
  VideoEmbedBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface VideoEmbedBlockProps {
  data: VideoEmbedBlockData;
  sideLoadedData: SideLoadedData;
}

export function VideoEmbedBlock({ data }: VideoEmbedBlockProps) {
  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6 items-center">
        {/* Optional title and description */}
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h1)",
                }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        {/* Video content */}
        <div className="w-full rounded-2xl overflow-hidden">
          {data.videoFile ? (
            <video
              autoPlay={data.autoplay}
              controls={!data.autoplay}
              loop={data.autoplay}
              muted={data.autoplay}
              playsInline
              className="w-full h-auto"
            >
              <source
                src={getStrapiMediaUrl(data.videoFile.url)}
                type={data.videoFile.mime}
              />
            </video>
          ) : data.videoUrl ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={data.videoUrl}
                title={data.title || "Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
