/**
 * Server-rendered JSON-LD `<script>` element.
 *
 * Usage:
 *   <JsonLd data={courseLD({ ... })} />
 *   <JsonLd data={[orgLD, breadcrumbLD]} />
 *
 * One or many objects per render. Uses `dangerouslySetInnerHTML` because
 * Next.js otherwise escapes `<` characters inside <script> bodies. The
 * payload is built server-side from typed inputs, so we control the JSON.
 */

import { headers } from "next/headers";

interface JsonLdProps {
  /** A single JSON-LD object or an array of them. */
  data: unknown | unknown[];
  /** Optional id — useful when rendering multiple LD blocks per page. */
  id?: string;
}

export default async function JsonLd({ data, id }: JsonLdProps) {
  // Per-request CSP nonce (set in middleware). Inline scripts — including
  // `application/ld+json` — are blocked by the strict script-src unless they
  // carry the matching nonce. All current callers are server components.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const payload = Array.isArray(data) ? data : [data];
  // Strip `undefined` and forbid `</script>` injection (defensive).
  const json = JSON.stringify(payload.length === 1 ? payload[0] : payload).replace(
    /</g,
    '\\u003c',
  );
  return (
    <script
      type="application/ld+json"
      id={id}
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
