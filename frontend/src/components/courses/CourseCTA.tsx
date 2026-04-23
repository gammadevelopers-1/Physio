"use client";

import Link from "next/link";

interface CourseCTAProps {
  isRTL?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

const CourseCTA = ({
  isRTL = false,
  title,
  description,
  buttonLabel,
  buttonHref,
}: CourseCTAProps) => {
  // Section only renders when at least the title is set in Strapi
  if (!title && !description && !buttonLabel) return null;

  const href = buttonHref || "/contact";

  return (
    <section className="bg-[var(--color-surface-page)] py-16 lg:py-20" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[800px] mx-auto px-4 text-center">
        {title && (
          <h2
            className="font-semibold text-[#06080b] mb-4"
            style={{ fontSize: "clamp(24px, 5vw, 36px)" }}
          >
            {title}
          </h2>
        )}
        {description && (
          <p className="text-[#4a4c4f] text-base lg:text-lg mb-8 max-w-[600px] mx-auto">
            {description}
          </p>
        )}
        {buttonLabel && (
          <Link
            href={href}
            className="inline-flex items-center justify-center h-10 px-6 py-2 btn-gold rounded-xl text-sm font-medium text-white"
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </section>
  );
};

export default CourseCTA;
