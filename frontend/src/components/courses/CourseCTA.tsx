"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

interface CourseCTAProps {
  isRTL?: boolean;
}

const CourseCTA = ({ isRTL = false }: CourseCTAProps) => {
  const t = useTranslations("coursesPage");

  return (
    <section className="bg-[#EEF3F7] py-16 lg:py-20" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[800px] mx-auto px-4 text-center">
        <h2
          className="font-semibold text-[#06080b] mb-4"
          style={{ fontSize: "clamp(24px, 5vw, 36px)" }}
        >
          {t("cta.title")}
        </h2>
        <p className="text-[#4a4c4f] text-base lg:text-lg mb-8 max-w-[600px] mx-auto">
          {t("cta.description")}
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center h-10 px-6 py-2 btn-gold rounded-xl text-sm font-medium text-white"
        >
          {t("cta.button")}
        </Link>
      </div>
    </section>
  );
};

export default CourseCTA;
