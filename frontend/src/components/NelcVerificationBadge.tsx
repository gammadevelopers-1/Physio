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

  return (
    <div
      className="fixed bottom-[88px] end-4 z-[40] pointer-events-auto"
      aria-label="NELC Verified Entity"
    >
      <iframe
        src="https://services.futurex.sa/entity-badge?code=ZI7I5zI4sILCc8Ll"
        width="250"
        height="60"
        referrerPolicy="unsafe-url"
        style={{ border: "none" }}
        title="NELC Verified Entity"
      />
    </div>
  );
}
