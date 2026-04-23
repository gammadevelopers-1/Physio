"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { NELCPage } from "@/lib/strapi/types";

const NELCContent = ({ strapiData }: { strapiData?: NELCPage | null }) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Strict Strapi-only. No translation fallback, no hardcoded images.
  const heroTitle = strapiData?.heroTitle || "";
  const heroDescription = strapiData?.heroDescription || "";
  const infoBadges = (strapiData?.infoBadges || []).filter((b) => b.label);
  const nelcLogoUrl = strapiData?.nelcLogo?.url ? getStrapiMediaUrl(strapiData.nelcLogo.url) : null;

  const complianceTitle = strapiData?.complianceTitle || "";
  const complianceDescription = strapiData?.complianceDescription || "";
  const complianceCards = (strapiData?.complianceCards || []).filter((c) => c.title);

  // Section-level gating
  const hasHero = !!(heroTitle || heroDescription || infoBadges.length > 0 || nelcLogoUrl);
  const hasCompliance = !!(complianceTitle || complianceDescription || complianceCards.length > 0);

  return (
    <>
      {/* Hero Section */}
      {hasHero && (
        <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-16">
              {/* Content */}
              {(heroTitle || heroDescription || infoBadges.length > 0) && (
                <div className="flex flex-col gap-12 w-full md:max-w-[663px]">
                  {(heroTitle || heroDescription) && (
                    <div className="flex flex-col gap-6">
                      {heroTitle && (
                        <h1
                          className="font-semibold text-[#06080B] tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {heroTitle}
                        </h1>
                      )}
                      {heroDescription && (
                        <p className="text-[#06080B] leading-7 text-[18px] md:text-[20px]">
                          {heroDescription}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Info Badges — repeatable from Strapi */}
                  {infoBadges.length > 0 && (
                    <div className="flex flex-col md:flex-row flex-wrap gap-4 w-full">
                      {infoBadges.map((badge) => (
                        <div
                          key={badge.id}
                          className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1 md:min-w-[180px]"
                        >
                          <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                          <div className="flex flex-col">
                            <span className="font-medium text-[#06080B] text-[14px] leading-5">
                              {badge.label}
                            </span>
                            {badge.value && (
                              <span className="text-[#4A4C4F] text-[12px] leading-4">
                                {badge.value}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* NELC Logo — renders only when Strapi provides it */}
              {nelcLogoUrl && (
                <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
                  <Image
                    src={nelcLogoUrl}
                    alt=""
                    width={437}
                    height={172}
                    className="object-contain w-[277px] md:w-[437px] h-auto"
                    unoptimized={nelcLogoUrl.startsWith("http")}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Compliance Section */}
      {hasCompliance && (
        <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            {(complianceTitle || complianceDescription) && (
              <div className="flex flex-col items-center gap-4 mb-10 max-w-[768px] mx-auto">
                {complianceTitle && (
                  <h2
                    className="font-semibold text-[#06080B] text-center tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {complianceTitle}
                  </h2>
                )}
                {complianceDescription && (
                  <p className="text-[#06080B] text-center leading-7 text-[18px] md:text-[20px]">
                    {complianceDescription}
                  </p>
                )}
              </div>
            )}

            {complianceCards.length > 0 && (
              <div className="flex flex-col md:flex-row flex-wrap gap-8 md:gap-8 justify-center items-center">
                {complianceCards.map((card) => {
                  const imageUrl = card.image ? getStrapiMediaUrl(card.image.url) : null;
                  return (
                    <div
                      key={card.id}
                      className="flex flex-col items-center relative w-full md:w-auto pb-6"
                    >
                      {imageUrl && (
                        <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                          <Image
                            src={imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized={imageUrl.startsWith("http")}
                          />
                        </div>
                      )}
                      <div
                        className={`bg-[var(--color-surface-page)] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] ${imageUrl ? "-mt-24" : ""} relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]`}
                      >
                        <h3 className="font-semibold text-[#06080B] text-[18px] md:text-[20px]">
                          {card.title}
                        </h3>
                        {card.description && (
                          <p className="text-[#06080B] text-[16px] leading-6">
                            {card.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
};

export default NELCContent;
