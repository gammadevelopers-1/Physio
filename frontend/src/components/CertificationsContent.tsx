"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, ChevronLeft, Home } from "lucide-react";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";
import type { CertificationsPage } from "@/lib/strapi/types";

const CertificationsContent = ({ strapiData }: { strapiData?: CertificationsPage | null }) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Everything is strict Strapi-only. No translation fallback, no hardcoded images.
  const breadcrumb = strapiData?.breadcrumb || "";
  const heroTitle = strapiData?.heroTitle || "";
  const heroDescription = strapiData?.heroDescription || "";
  const heroButtonLabel = strapiData?.heroButtonLabel || "";

  const nelcLogoUrl = strapiData?.nelcLogo?.url ? getStrapiMediaUrl(strapiData.nelcLogo.url) : null;
  const nelcTitle = strapiData?.nelcTitle || "";
  const nelcDescription = strapiData?.nelcDescription || "";
  const nelcLicenseLabel = strapiData?.nelcLicenseLabel || "";
  const nelcLicenseNumber = strapiData?.nelcLicenseNumber || "";

  const scfhsLogoUrl = strapiData?.scfhsLogo?.url ? getStrapiMediaUrl(strapiData.scfhsLogo.url) : null;
  const scfhsTitle = strapiData?.scfhsTitle || "";
  const scfhsDescription = strapiData?.scfhsDescription || "";
  const scfhsAccreditationLabel = strapiData?.scfhsAccreditationLabel || "";
  const scfhsAccreditationNumber = strapiData?.scfhsAccreditationNumber || "";

  const certificateImageUrl = strapiData?.certificateImage?.url ? getStrapiMediaUrl(strapiData.certificateImage.url) : null;
  const verificationTitle = strapiData?.verificationTitle || "";
  const verificationSubtitle = strapiData?.verificationSubtitle || "";
  const verificationPlaceholder = strapiData?.verificationPlaceholder || "";
  const verificationButtonLabel = strapiData?.verificationButtonLabel || "";

  const claimCMETitle = strapiData?.claimCMETitle || "";
  const steps = (strapiData?.steps || []).filter((s) => s.title);

  // Section-level presence flags
  const hasHero = !!(breadcrumb || heroTitle || heroDescription || heroButtonLabel);
  const hasNelcCard = !!(nelcLogoUrl || nelcTitle || nelcDescription);
  const hasScfhsCard = !!(scfhsLogoUrl || scfhsTitle || scfhsDescription);
  const hasAccreditation = hasNelcCard || hasScfhsCard;
  const hasVerification = !!(verificationTitle || verificationSubtitle || verificationButtonLabel || certificateImageUrl);
  const hasClaimCME = !!(claimCMETitle || steps.length > 0);

  return (
    <>
      {/* Hero Section */}
      {hasHero && (
        <section className="bg-[var(--color-surface-page)] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            {breadcrumb && (
              <div className="flex items-center gap-1 mb-6">
                <Link href="/" className="text-[#525252]">
                  <Home size={24} />
                </Link>
                {isRTL ? (
                  <ChevronLeft size={14} className="text-[#525252]" />
                ) : (
                  <ChevronRight size={14} className="text-[#525252]" />
                )}
                <span className="text-[var(--color-text-primary)] text-[14px]">{breadcrumb}</span>
              </div>
            )}

            {(heroTitle || heroDescription || heroButtonLabel) && (
              <div className="max-w-[663px]">
                {heroTitle && (
                  <h1
                    className="font-semibold text-[var(--color-text-primary)] tracking-[-0.24px] leading-none mb-6 text-[32px] md:text-[48px]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <p
                    className="text-[var(--color-text-primary)] leading-7 mb-6"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {heroDescription}
                  </p>
                )}
                {heroButtonLabel && (
                  <Link
                    href={resolveHref(strapiData?.heroButtonLink, locale) || "#"}
                    className="h-[40px] px-5 py-2 text-white rounded-xl text-sm font-medium btn-gold inline-flex items-center justify-center"
                  >
                    {heroButtonLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Accreditation Cards Section */}
      {hasAccreditation && (
        <section className="bg-[var(--color-surface-page)] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            <div className={`grid grid-cols-1 gap-6 ${hasNelcCard && hasScfhsCard ? "md:grid-cols-2" : "md:max-w-[640px] md:mx-auto"}`}>
              {/* NELC Card */}
              {hasNelcCard && (
                <div className="bg-white rounded-[20px] p-8 md:p-16 flex flex-col items-center gap-6 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                  {nelcLogoUrl && (
                    <div className="h-[80px] flex items-center justify-center">
                      <Image
                        src={nelcLogoUrl}
                        alt=""
                        width={203}
                        height={80}
                        className="object-contain"
                        unoptimized={nelcLogoUrl.startsWith("http")}
                      />
                    </div>
                  )}
                  {nelcTitle && (
                    <h2
                      className="font-semibold text-[var(--color-text-primary)] text-center"
                      style={{ fontSize: "var(--typeface-font-styles-heading-h2)" }}
                    >
                      {nelcTitle}
                    </h2>
                  )}
                  {(nelcDescription || nelcLicenseNumber) && (
                    <p
                      className="text-[var(--color-text-primary)] text-center leading-7"
                      style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                    >
                      {nelcDescription}
                      {nelcLicenseNumber && (
                        <>
                          {nelcDescription && <br />}
                          {nelcDescription && <br />}
                          {nelcLicenseLabel} [{nelcLicenseNumber}]
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* SCFHS Card */}
              {hasScfhsCard && (
                <div className="bg-white rounded-[20px] p-8 md:p-16 flex flex-col items-center gap-6 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                  {scfhsLogoUrl && (
                    <div className="h-[80px] flex items-center justify-center">
                      <Image
                        src={scfhsLogoUrl}
                        alt=""
                        width={194}
                        height={80}
                        className="object-contain"
                        unoptimized={scfhsLogoUrl.startsWith("http")}
                      />
                    </div>
                  )}
                  {scfhsTitle && (
                    <h2
                      className="font-semibold text-[var(--color-text-primary)] text-center"
                      style={{ fontSize: "var(--typeface-font-styles-heading-h2)" }}
                    >
                      {scfhsTitle}
                    </h2>
                  )}
                  {(scfhsDescription || scfhsAccreditationNumber) && (
                    <p
                      className="text-[var(--color-text-primary)] text-center leading-7"
                      style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                    >
                      {scfhsDescription}
                      {scfhsAccreditationNumber && (
                        <>
                          {scfhsDescription && <br />}
                          {scfhsDescription && <br />}
                          {scfhsAccreditationLabel} [{scfhsAccreditationNumber}]
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Certificate Verification Section */}
      {hasVerification && (
        <section className="bg-[var(--color-surface-page)] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            <div className="bg-[var(--color-surface-page)] rounded-[24px] p-6 md:p-12 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {(verificationTitle || verificationSubtitle || verificationButtonLabel) && (
                  <CertificateVerifyForm
                    isRTL={isRTL}
                    locale={locale}
                    titleLabel={verificationTitle}
                    subtitleLabel={verificationSubtitle}
                    placeholderLabel={verificationPlaceholder}
                    buttonLabel={verificationButtonLabel}
                  />
                )}

                {certificateImageUrl && (
                  <div className="w-full md:w-1/2">
                    <div className="rounded-[20px] overflow-hidden">
                      <Image
                        src={certificateImageUrl}
                        alt=""
                        width={651}
                        height={445}
                        className="w-full h-auto object-contain"
                        unoptimized={certificateImageUrl.startsWith("http")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* How to Claim CME Hours Section */}
      {hasClaimCME && (
        <section className="bg-[var(--color-surface-page)] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto">
            {claimCMETitle && (
              <h2
                className="font-semibold text-[var(--color-text-primary)] text-center tracking-[-0.24px] leading-none mb-8 text-[32px] md:text-[48px]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {claimCMETitle}
              </h2>
            )}

            {steps.length > 0 && (
              <div className="flex flex-col md:flex-row flex-wrap gap-6 justify-center px-0 md:px-36">
                {steps.map((step) => {
                  const iconUrl = step.icon ? getStrapiMediaUrl(step.icon.url) : null;
                  return (
                    <div
                      key={step.id}
                      className="bg-white rounded-[16px] px-8 py-6 flex flex-col items-center gap-2 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
                    >
                      {iconUrl && (
                        <div className="relative h-[56px] w-[65px]">
                          <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-[7px] w-[50px] h-[49px] bg-[var(--color-surface-page)] rounded-tl-[18px] rounded-tr-[5px] rounded-br-[10px] rounded-bl-[5px]`} />
                          <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center`}>
                            <Image
                              src={iconUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="object-contain"
                              unoptimized={iconUrl.startsWith("http")}
                            />
                          </div>
                        </div>
                      )}
                      <h3
                        className="font-semibold text-[var(--color-text-primary)] text-center"
                        style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
                      >
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className="text-[var(--color-text-secondary)] text-[14px] text-center leading-5 w-[251px]">
                          {step.description}
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
    </>
  );
};

function CertificateVerifyForm({
  isRTL,
  locale,
  titleLabel,
  subtitleLabel,
  placeholderLabel,
  buttonLabel,
}: {
  isRTL: boolean;
  locale: string;
  titleLabel: string;
  subtitleLabel: string;
  placeholderLabel: string;
  buttonLabel: string;
}) {
  const [certInput, setCertInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const handleVerify = async () => {
    const trimmed = certInput.trim();
    if (!trimmed) return;

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`/api/certificates/verify/${trimmed}`);

      if (!res.ok) {
        setToast({
          message: locale === "ar"
            ? "لم يتم العثور على الشهادة. يرجى التحقق من المعرف والمحاولة مرة أخرى."
            : "Certificate not found. Please check the ID and try again.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.verified && data.status === "approved") {
        window.open(`/${locale}/verify/${data.id}`, "_blank");
      } else {
        setToast({
          message: locale === "ar"
            ? "الشهادة غير معتمدة أو لم تتم الموافقة عليها بعد."
            : "Certificate is not approved or not yet verified.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message: locale === "ar"
          ? "حدث خطأ أثناء التحقق. يرجى المحاولة لاحقاً."
          : "An error occurred during verification. Please try again later.",
        type: "error",
      });
    }

    setLoading(false);
  };

  return (
    <div className="w-full md:w-1/2 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-[400px]">
        {(titleLabel || subtitleLabel) && (
          <div className="flex flex-col gap-1 mb-5">
            {titleLabel && (
              <h3 className="font-semibold text-[var(--color-text-primary)] text-[16px]">{titleLabel}</h3>
            )}
            {subtitleLabel && (
              <p className="text-[var(--color-text-secondary)] text-[14px]">{subtitleLabel}</p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-5">
          <input
            type="text"
            value={certInput}
            onChange={(e) => setCertInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder={placeholderLabel || ""}
            className={`w-full h-[48px] px-4 border border-[var(--color-border-subtle)] rounded-lg text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-border-subtle)] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "text-right" : "text-left"}`}
            dir={isRTL ? "rtl" : "ltr"}
          />
          {buttonLabel && (
            <button
              onClick={handleVerify}
              disabled={loading || !certInput.trim()}
              className="w-full h-[40px] text-white rounded-xl text-sm font-medium btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {locale === "ar" ? "جارٍ التحقق..." : "Verifying..."}
                </span>
              ) : (
                buttonLabel
              )}
            </button>
          )}
        </div>

        {toast && (
          <div className={`mt-4 p-3 rounded-lg text-[13px] ${
            toast.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default CertificationsContent;
