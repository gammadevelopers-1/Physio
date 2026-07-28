// Official NELC (SDAIA e-learning regulator) trust mark.
//
// Rendered as a static image + link on purpose. The previous iframe
// (services.futurex.sa/entity-badge) turned out to load FutureX's full
// Next.js app inside, which in turn pulled in Google Tag Manager,
// Cloudflare Insights, Hotjar, AND Genesys Cloud Messenger — the last
// of which rendered as an unwanted blue chat button on our footer.
// Swapping to a static image kills all four of those third-party
// scripts while preserving the visual trust signal, and the anchor
// still deep-links to the official FutureX verification page so
// visitors can confirm the accreditation is genuine.
//
// Two placements share this single component:
//   - Desktop → sits in the Footer bottom row.
//   - Mobile  → sits inside MobileFooterStrip.

import Image from "next/image";

// Public verification page for this specific NELC-licensed entity.
// Same code (ZI7I5zI4sILCc8Ll) that was used by the previous iframe.
const VERIFICATION_URL =
  "https://services.futurex.sa/entity/ZI7I5zI4sILCc8Ll";

export default function NelcVerificationBadge() {
  return (
    <a
      href={VERIFICATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="NELC Verified Entity"
      title="NELC Verified Entity"
      dir="ltr"
      className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-md bg-white hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <Image
        src="/images/nelc-logo.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-auto object-contain"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Verified Entity
        </span>
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          NELC
        </span>
      </span>
    </a>
  );
}
