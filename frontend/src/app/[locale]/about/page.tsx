import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getAboutPageData, getStrapiMediaUrl } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isRTL = locale === "ar";

  const {
    aboutPage: data,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getAboutPageData(locale);

  const blocks = data?.blocks;
  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  const isExternal = (src: string) => src.startsWith("http");

  // Hero images — Strapi only
  const heroImageDesktop = data?.heroImage ? getStrapiMediaUrl(data.heroImage.url) : null;
  const heroImageMobile = data?.heroImageMobile
    ? getStrapiMediaUrl(data.heroImageMobile.url)
    : heroImageDesktop;

  // Presence flags
  const hasHeroText = !!(data?.heroTitle || data?.heroDescription);
  const hasHeroButtons = !!(data?.heroExploreButtonLabel || data?.heroGetStartedButtonLabel);
  const hasHeroImage = !!heroImageDesktop;
  const hasHero = hasHeroText || hasHeroButtons || hasHeroImage;

  const complianceItems = (data?.complianceItems || []).filter((i) => i.text && i.text.trim());
  const hasCompliance = !!(data?.complianceTitle || complianceItems.length > 0);

  const learningCards = (data?.learningCards || []).filter((c) => c.title && c.image);
  const hasLearning = !!(data?.learningTitle || data?.learningSubtitle || learningCards.length > 0);

  const features = (data?.features || []).filter((f) => f.title && f.description);
  const hasCapabilities = !!(data?.capabilitiesTitle || data?.capabilitiesSubtitle || features.length > 0);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      {/* Section 1: About Hero Section */}
      {hasHero && (
        <section className="bg-[var(--surface-intense)]">
          <div className={`flex flex-col lg:flex-row min-h-[400px] lg:min-h-[600px] ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            {/* Left Content */}
            <div className={`flex-1 bg-[var(--surface-intense)] flex items-center justify-center px-4 py-8 md:px-12 md:py-16 lg:px-16 lg:py-20 order-2 ${isRTL ? "lg:order-2" : "lg:order-1"}`}>
              <div className={`max-w-[480px] w-full ${isRTL ? "text-right" : ""}`}>
                {data?.heroTitle && (
                  <h1 className="text-[var(--on-surface-default)] mb-4 md:mb-6 text-[36px] lg:text-[60px] font-semibold leading-[100%] tracking-[-0.72px] lg:tracking-[-1.2px]">
                    {data.heroTitle}
                  </h1>
                )}

                {data?.heroDescription && (
                  <p className="text-[var(--on-surface-default)] mb-6 md:mb-8 text-[18px] lg:text-[20px] font-normal leading-[28px]">
                    {data.heroDescription}
                  </p>
                )}

                {hasHeroButtons && (
                  <div className={`flex flex-row items-center gap-[10px] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                    {data?.heroExploreButtonLabel && (
                      <Link
                        href={`/${locale}/courses`}
                        className="flex items-center justify-center h-12 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl font-medium transition-colors text-sm md:text-base"
                      >
                        {data.heroExploreButtonLabel}
                      </Link>
                    )}
                    {data?.heroGetStartedButtonLabel && (
                      <Link
                        href={`/${locale}/get-started`}
                        className="flex items-center justify-center h-12 px-5 py-2 bg-[var(--surface-intense)] text-[var(--on-surface-default)] rounded-xl font-medium border border-[var(--outline-subtle)] transition-colors hover:bg-[var(--surface-container-low)] text-sm md:text-base"
                      >
                        {data.heroGetStartedButtonLabel}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Image */}
            {hasHeroImage && heroImageDesktop && heroImageMobile && (
              <div className={`w-full lg:flex-1 relative h-[434px] lg:h-auto lg:min-h-[600px] order-1 ${isRTL ? "lg:order-1" : "lg:order-2"}`}>
                <Image
                  src={heroImageMobile}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover lg:hidden"
                  priority
                  unoptimized={isExternal(heroImageMobile)}
                />
                <Image
                  src={heroImageDesktop}
                  alt=""
                  fill
                  sizes="50vw"
                  className="object-cover object-center hidden lg:block"
                  priority
                  unoptimized={isExternal(heroImageDesktop)}
                />
                <div
                  className="absolute inset-0 pointer-events-none hidden lg:block"
                  style={{
                    background: isRTL
                      ? "linear-gradient(to left, #ffffff 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0) 45%)"
                      : "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0) 45%)"
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none lg:hidden"
                  style={{
                    background: "linear-gradient(to bottom, rgba(255,255,255,0) 60%, rgba(255,255,255,0.8) 85%, #ffffff 100%)"
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />

      {/* Section 2: Compliance & Standards Section */}
      {hasCompliance && (
        <section className="bg-[#EEF3F7] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
          <div className={`flex flex-col items-center justify-center max-w-[800px] mx-auto text-center ${isRTL ? "text-right" : ""}`}>
            {data?.complianceTitle && (
              <h2 className="text-[var(--on-surface-default)] mb-6 md:mb-8 text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px] text-center w-full">
                {data.complianceTitle}
              </h2>
            )}

            {complianceItems.length > 0 && (
              <div className="flex flex-col mb-8 md:mb-10">
                {complianceItems.map((item) => (
                  <p key={item.id} className="text-[#000] lg:text-[var(--on-surface-variant)] text-[18px] lg:text-[20px] font-normal leading-[28px]">
                    {item.text}
                  </p>
                ))}
              </div>
            )}

            {data?.complianceButtonLabel && (
              <>
                <Link
                  href={`/${locale}/programs`}
                  className="w-full lg:w-auto lg:hidden flex items-center justify-center h-12 px-5 py-2 btn-gold rounded-xl font-medium transition-all duration-300 text-white"
                >
                  {data.complianceButtonLabel}
                </Link>
                <Link
                  href={`/${locale}/programs`}
                  className="hidden lg:flex items-center justify-center h-12 px-8 py-3 bg-transparent btn-gold rounded-xl font-medium border transition-all duration-300 text-white"
                >
                  {data.complianceButtonLabel}
                </Link>
              </>
            )}
          </div>
        </section>
      )}
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-2')} sideLoadedData={sideLoadedData} />

      {/* Section 3: Learning Experience Section */}
      {hasLearning && (
        <section className="bg-[var(--surface-intense)] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
          <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
            {data?.learningTitle && (
              <h2 className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px]">
                {data.learningTitle}
              </h2>
            )}

            {data?.learningSubtitle && (
              <p className="text-[var(--on-surface-default)] lg:text-[var(--on-surface-variant)] mb-10 md:mb-14 text-center text-[18px] lg:text-[20px] font-normal leading-[28px]">
                {data.learningSubtitle}
              </p>
            )}

            {learningCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full" dir={isRTL ? "rtl" : "ltr"}>
                {learningCards.map((card) => {
                  const imgDesktop = card.image ? getStrapiMediaUrl(card.image.url) : null;
                  const imgMobile = card.imageMobile ? getStrapiMediaUrl(card.imageMobile.url) : imgDesktop;
                  if (!imgDesktop || !imgMobile) return null;
                  return (
                    <div key={card.id} className="relative pb-4">
                      <div className="relative h-[286px] lg:h-[250px] rounded-2xl overflow-hidden shadow-[-2px_8px_2px_0_rgba(0,0,0,0.00),-1px_5px_2px_0_rgba(0,0,0,0.01)] lg:shadow-none">
                        <Image
                          src={imgMobile}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover lg:hidden"
                          unoptimized={isExternal(imgMobile)}
                        />
                        <Image
                          src={imgDesktop}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover hidden lg:block"
                          unoptimized={isExternal(imgDesktop)}
                        />
                      </div>
                      <div className="relative -mt-12 mx-4 bg-[var(--surface-intense)] rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-[var(--outline-subtle)] p-4 text-center h-[140px] flex flex-col items-center justify-between">
                        <h3 className="text-[var(--on-surface-default)] font-semibold text-[20px] leading-normal">
                          {card.title}
                        </h3>
                        {data?.learningReadMoreLabel && card.linkUrl && (
                          <Link
                            href={card.linkUrl}
                            className={`inline-flex items-center justify-center gap-2 text-[#a37f49] font-medium hover:opacity-80 transition-opacity h-10 px-5 py-2 rounded-xl text-[14px] ${isRTL ? "flex-row-reverse" : ""}`}
                          >
                            {data.learningReadMoreLabel}
                            {isRTL ? (
                              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                            ) : (
                              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                            )}
                          </Link>
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
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-3')} sideLoadedData={sideLoadedData} />

      {/* Section 4: Platform Capabilities Section */}
      {hasCapabilities && (
        <section className="bg-[#EEF3F7] px-4 py-12 md:px-12 md:py-20 lg:px-16 lg:py-24">
          <div className="flex flex-col items-center justify-center max-w-[1200px] mx-auto">
            {data?.capabilitiesTitle && (
              <h2 className="text-[var(--on-surface-default)] mb-3 md:mb-4 text-center text-[30px] lg:text-[48px] font-semibold leading-[100%] tracking-[-0.15px] lg:tracking-[-0.24px]">
                {data.capabilitiesTitle}
              </h2>
            )}

            {data?.capabilitiesSubtitle && (
              <p className="text-[var(--on-surface-default)] mb-10 md:mb-14 text-center text-[18px] lg:text-[20px] font-normal leading-[28px]">
                {data.capabilitiesSubtitle}
              </p>
            )}

            {features.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8 w-full" dir={isRTL ? "rtl" : "ltr"}>
                {features.map((f) => {
                  const iconUrl = f.icon ? getStrapiMediaUrl(f.icon.url) : null;
                  return (
                    <div
                      key={f.id}
                      className="flex flex-col items-center bg-white lg:bg-[var(--surface-intense)] rounded-[16px] py-6 px-8 lg:p-8 text-center lg:border lg:border-[var(--outline-subtle)]"
                      style={{ boxShadow: "-2px 8px 2px 0 rgba(0,0,0,0.00), -1px 5px 2px 0 rgba(0,0,0,0.01)" }}
                    >
                      {iconUrl && (
                        <div className="w-[38px] h-[38px] lg:w-12 lg:h-12 flex items-center justify-center mb-2 lg:mb-4">
                          <Image
                            src={iconUrl}
                            alt=""
                            width={38}
                            height={38}
                            className="w-[38px] h-[38px] lg:w-8 lg:h-8 object-contain"
                            unoptimized={isExternal(iconUrl)}
                          />
                        </div>
                      )}
                      <h3 className="text-[var(--on-surface-default)] text-[14px] lg:text-[18px] font-semibold mb-2">
                        {f.title}
                      </h3>
                      {f.description && (
                        <p className="text-[#4A4C4F] text-[14px] font-normal leading-[20px] w-[251px] lg:w-auto">
                          {f.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
    </main>
  );
}
