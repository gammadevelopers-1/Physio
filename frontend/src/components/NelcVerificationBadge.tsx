// Official NELC Entity Verification Badge.
// Embed code is provided by NELC verbatim — do NOT change src, dimensions,
// or referrerPolicy (the unsafe-url policy is required for NELC's
// domain verification check).
//
// Always inline / non-fixed. Two placements share this single iframe:
//   - Desktop → sits in the Footer bottom row.
//   - Mobile  → sits inside MobileFooterStrip (rendered at end of page,
//               above the fixed BottomNav).
// The previous mobile-floating variant covered page content on scroll
// and was replaced by the MobileFooterStrip.
const BADGE_HTML =
  '<iframe src="https://services.futurex.sa/entity-badge?code=ZI7I5zI4sILCc8Ll" width="250" height="60" referrerpolicy="unsafe-url" style="border: none; max-width: 100%; display: block;" title="NELC Verified Entity"></iframe>';

export default function NelcVerificationBadge() {
  return (
    <div
      className="inline-block"
      aria-label="NELC Verified Entity"
      dir="ltr"
      dangerouslySetInnerHTML={{ __html: BADGE_HTML }}
    />
  );
}
