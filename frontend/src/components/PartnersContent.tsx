"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { Partner, PartnersPage } from "@/lib/strapi/types";

interface PartnersContentProps {
  partners: Partner[];
  strapiData?: PartnersPage | null;
}

export default function PartnersContent({ partners, strapiData }: PartnersContentProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = strapiData?.title || "";

  // Only use Strapi partners if at least one has a logo uploaded
  const partnersWithLogos = partners.filter((p) => p.logo?.url);
  const hasPartners = partnersWithLogos.length > 0;

  // Build rows of 3 from Strapi partners that have logos
  const strapiRows: Partner[][] = [];
  if (hasPartners) {
    for (let i = 0; i < partnersWithLogos.length; i += 3) {
      strapiRows.push(partnersWithLogos.slice(i, i + 3));
    }
  }

  return (
    <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[1312px] mx-auto flex flex-col items-center">
        {title && (
          <h1
            className="font-semibold tracking-[-0.24px] text-[#06080B] text-center mb-12 md:mb-16 text-[32px] md:text-[48px] leading-none"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {title}
          </h1>
        )}

        {hasPartners ? (
          <>
            {/* Desktop - rows of 3 from Strapi */}
            <div className="hidden md:flex flex-col gap-16 items-center w-full max-w-[880px]">
              {strapiRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between w-full">
                  {row.map((partner) => {
                    const logoUrl = getStrapiMediaUrl(partner.logo.url);
                    return (
                      <div
                        key={partner.id}
                        className="flex items-center justify-center"
                        style={{ width: "200px", height: "100px" }}
                      >
                        <Image
                          src={logoUrl}
                          alt={partner.name}
                          width={150}
                          height={80}
                          style={{ maxWidth: "150px", maxHeight: "80px", objectFit: "contain" }}
                          unoptimized={logoUrl.startsWith("http")}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Mobile - single column from Strapi */}
            <div className="md:hidden flex flex-col gap-8 w-full items-center">
              {partnersWithLogos.map((partner) => {
                const logoUrl = getStrapiMediaUrl(partner.logo.url);
                return (
                  <div key={partner.id} className="flex items-center justify-center w-full py-4">
                    <Image
                      src={logoUrl}
                      alt={partner.name}
                      width={150}
                      height={80}
                      style={{ maxWidth: "150px", maxHeight: "80px", objectFit: "contain" }}
                      unoptimized={logoUrl.startsWith("http")}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[#4A4C4F] text-center leading-6 text-[16px]">
            {isRTL ? "لا يوجد شركاء حالياً" : "No partners yet"}
          </p>
        )}
      </div>
    </section>
  );
}
