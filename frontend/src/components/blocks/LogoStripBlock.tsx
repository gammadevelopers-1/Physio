"use client";

import Image from "next/image";
import type {
  LogoStripBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { Marquee } from "@/components/ui/marquee";

interface LogoStripBlockProps {
  data: LogoStripBlockData;
  sideLoadedData: SideLoadedData;
}

export function LogoStripBlock({ data }: LogoStripBlockProps) {
  const logos = (data.logos || []).filter((logo) => logo.url);

  if (logos.length === 0) return null;

  return (
    <section className="py-8 md:py-16 px-4 md:px-0 overflow-hidden">
      <div className="flex flex-col gap-6 md:gap-10 items-center">
        {/* Optional title */}
        {data.title && (
          <h2
            className="text-[var(--on-surface-default)] font-semibold text-center leading-9"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h2)",
            }}
          >
            {data.title}
          </h2>
        )}

        {data.enableMarquee ? (
          /* Marquee mode - similar to Partners component */
          <Marquee pauseOnHover speed={30} className="w-full">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="flex items-center justify-center"
                style={{
                  height: 66,
                  marginLeft: 48,
                  marginRight: 48,
                }}
              >
                <Image
                  src={getStrapiMediaUrl(logo.url)}
                  alt={logo.alternativeText || logo.name}
                  width={logo.width || 120}
                  height={logo.height || 66}
                  unoptimized
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: 175,
                    maxHeight: 66,
                    objectFit: "contain",
                  }}
                />
              </div>
            ))}
          </Marquee>
        ) : (
          /* Grid mode */
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 max-w-[1280px] mx-auto w-full">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="flex items-center justify-center"
                style={{ height: 66 }}
              >
                <Image
                  src={getStrapiMediaUrl(logo.url)}
                  alt={logo.alternativeText || logo.name}
                  width={logo.width || 120}
                  height={logo.height || 66}
                  unoptimized
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: 175,
                    maxHeight: 66,
                    objectFit: "contain",
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
