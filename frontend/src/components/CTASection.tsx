"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";

const CTASection = () => {
  const t = useTranslations("cta");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <section className="relative bg-[var(--surface-container-low)] px-4 lg:px-10 py-16 lg:py-[120px] overflow-hidden">
      {/* Background Image - Flipped horizontally in RTL */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`absolute w-[1440px] h-[1440px] ${isRTL ? "-scale-x-100" : ""}`}>
          <Image
            src="/images/cta-bg.png"
            alt=""
            fill
            className="object-cover opacity-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-8 items-center justify-center w-full">
        <h2
          className="text-[var(--on-surface-default)] font-semibold text-center leading-none tracking-[-0.24px] w-full lg:w-[600px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-h1)",
          }}
        >
          {t("title")}
        </h2>

        <p
          className="text-[var(--on-surface-default)] text-center leading-7 w-full lg:w-[590px]"
          style={{
            fontSize: "var(--typeface-font-styles-heading-subheading)",
          }}
        >
          {t("description")}
        </p>

        <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px]">
          {t("continueButton")}
        </button>
      </div>
    </section>
  );
};

export default CTASection;
