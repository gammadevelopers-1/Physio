"use client";

import { usePathname } from "next/navigation";

// Official NELC Entity Verification Badge.
// Embed code is provided by NELC verbatim — do NOT change src, dimensions,
// or referrerPolicy (the unsafe-url policy is required for NELC's
// domain verification check).
export default function NelcVerificationBadge() {
  const pathname = usePathname() || "";

  // Public pages only — exclude authenticated dashboards.
  if (/\/dashboard(\/|$)/.test(pathname)) return null;

  // The iframe markup is set via dangerouslySetInnerHTML so the attribute
  // names are byte-identical to NELC's embed (lowercase `referrerpolicy`,
  // not React's `referrerPolicy`). NELC's spec marks `referrerpolicy=
  // "unsafe-url"` as required for their domain verification check, and we
  // were asked not to alter it.
  return (
    <div
      className="fixed bottom-[88px] end-4 z-[40] pointer-events-auto"
      aria-label="NELC Verified Entity"
      dangerouslySetInnerHTML={{
        __html:
          '<iframe src="https://services.futurex.sa/entity-badge?code=ZI7I5zI4sILCc8Ll" width="250" height="60" referrerpolicy="unsafe-url" style="border: none;" title="NELC Verified Entity"></iframe>',
      }}
    />
  );
}
