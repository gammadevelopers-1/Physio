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
 *
 * NOTE: No CSP nonce is set here. `type="application/ld+json"` is a non-executable
 * data block, so the CSP `script-src` directive (even with `'strict-dynamic'`)
 * never applies to it. Adding a nonce caused a hydration mismatch: browsers wipe
 * the `nonce` content attribute from the DOM after load (security), so the client
 * reads nonce="" while the SSR HTML carried the real nonce.
 */

interface JsonLdProps {
  /** A single JSON-LD object or an array of them. */
  data: unknown | unknown[];
  /** Optional id — useful when rendering multiple LD blocks per page. */
  id?: string;
}

export default function JsonLd({ data, id }: JsonLdProps) {
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
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
