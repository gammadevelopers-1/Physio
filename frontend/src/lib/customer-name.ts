/**
 * Best-effort display cleanup for a customer/user name.
 *
 * Real names contain letters (Latin, Arabic, CJK, etc.), spaces, and a
 * handful of joiners: hyphens, apostrophes, periods. Anything else (parens,
 * `@`, digits, control chars) is data-entry garbage — some users type junk
 * during signup and it renders as gibberish on customer-facing surfaces
 * like invoices. We strip the noise; if nothing usable survives, we fall
 * back to a Title-Cased version of the email local-part.
 *
 * Mirrors backend `sanitizeCustomerName` in invoice.service.ts so PDF and
 * on-screen renderings agree.
 */
export function sanitizeCustomerName(
  raw: string | null | undefined,
  emailFallback?: string | null,
): string {
  const source = (raw || "").trim();
  const hasJunkChars = /[0-9()@#$%^*+={}\[\]<>\/\\|~`!?:;"]/.test(source);
  if (!hasJunkChars) {
    const cleaned = source
      .replace(/[^\p{L}\p{M}\s'\-\.]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 2) return cleaned;
  }
  const email = (emailFallback || "").trim();
  if (!email) return "Customer";
  const local = (email.split("@")[0] || "")
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (local.length < 2) return "Customer";
  return local.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
