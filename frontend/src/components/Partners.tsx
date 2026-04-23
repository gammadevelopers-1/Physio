"use client";

import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";
import type { Partner } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface PartnersProps {
  partners?: Partner[];
  sectionTitle?: string | null;
}

const Partners = ({ partners = [], sectionTitle }: PartnersProps) => {
  // Only use Strapi partners that have logos uploaded
  const partnersWithLogos = partners.filter((p) => p.logo?.url);

  // Hide the whole section when there are no Strapi partners
  if (partnersWithLogos.length === 0) {
    return null;
  }

  return (
    <section className="bg-[var(--color-surface-page)] py-8 md:py-20 px-4 md:px-0 overflow-hidden">
      <div className="flex flex-col gap-6 md:gap-12 items-center">
        {/* Title — only renders when Strapi provides one */}
        {sectionTitle && (
          <div className="flex justify-center md:px-16">
            <h2
              className="text-[var(--color-text-primary)] md:text-[var(--on-surface-default)] font-semibold text-center leading-9 md:w-[560px]"
              style={{ fontSize: "var(--typeface-font-styles-heading-h2)" }}
            >
              {sectionTitle}
            </h2>
          </div>
        )}

        {/* Desktop Partner Logos Marquee */}
        <Marquee
          pauseOnHover
          speed={30}
          className="w-full hidden md:flex"
        >
          {partnersWithLogos.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-center"
              style={{
                height: 66,
                marginLeft: 48,
                marginRight: 48,
              }}
            >
              <Image
                src={getStrapiMediaUrl(partner.logo?.url)}
                alt={partner.name}
                width={partner.logo?.width || 95}
                height={partner.logo?.height || 66}
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

        {/* Mobile Partner Logos Marquee */}
        <Marquee
          pauseOnHover
          speed={25}
          className="w-full md:hidden"
        >
          {partnersWithLogos.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-center"
              style={{
                height: 32,
                marginLeft: 23,
                marginRight: 23,
              }}
            >
              <Image
                src={getStrapiMediaUrl(partner.logo?.url)}
                alt={partner.name}
                width={partner.logo?.width || 46}
                height={partner.logo?.height || 32}
                unoptimized
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: 85,
                  maxHeight: 32,
                  objectFit: "contain",
                }}
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};

export default Partners;
