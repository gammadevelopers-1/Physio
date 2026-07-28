"use client";

// Official NELC (SDAIA e-learning regulator) trust mark.
//
// Rendered as a static card + link on purpose. The previous iframe
// (services.futurex.sa/entity-badge) turned out to load FutureX's full
// Next.js app inside, which in turn pulled in Google Tag Manager,
// Cloudflare Insights, Hotjar, AND Genesys Cloud Messenger — the last
// of which rendered as an unwanted blue chat button on our footer.
// Swapping to a static card kills all four of those third-party
// scripts while preserving the visual trust signal, and the anchor
// still deep-links to the official FutureX verification page so
// visitors can confirm the accreditation is genuine.
//
// Two placements share this single component:
//   - Desktop → sits in the Footer bottom row.
//   - Mobile  → sits inside MobileFooterStrip.

import { CheckCircle2 } from "lucide-react";
import { useLocale } from "next-intl";

// Public verification page for this specific NELC-licensed entity.
// Confirmed by Amna — same code (ZI7I5zI4sILCc8Ll) that was used by
// the previous iframe embed.
const VERIFICATION_URL =
  "https://services.futurex.sa/certificate-verification?code=ZI7I5zI4sILCc8Ll";

export default function NelcVerificationBadge() {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = isRTL ? "جهة موثقة" : "Verified Entity";
  const subtitle = isRTL
    ? "من المركز الوطني للتعليم الإلكتروني"
    : "by the National eLearning Center";

  return (
    <a
      href={VERIFICATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} — ${subtitle}`}
      title={`${title} — ${subtitle}`}
      dir={isRTL ? "rtl" : "ltr"}
      className="inline-flex items-center gap-3 px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl shadow-sm hover:shadow-md transition-shadow"
    >
      <CheckCircle2
        className="w-7 h-7 text-[#16A34A] flex-shrink-0"
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-[#111827]">
          {title}
        </span>
        <span className="text-[11px] text-[#6B7280] mt-0.5">
          {subtitle}
        </span>
      </span>
    </a>
  );
}
