import type { ActorRole } from "./ActorRoleContext";

/**
 * Cross-page link builder for finance content components that may render in
 * either the finance role's standalone routes (`/dashboard/finance/*`) or
 * embedded inside the admin finance shell (`/dashboard/admin/finance?tab=*`).
 *
 * When `role === 'admin'` we stay inside `/dashboard/admin/finance` and
 * encode the target as `?tab=...&...` query params — AdminFinanceShell's
 * tab/section handlers read those and switch the active tab, while embedded
 * inner content components read entity-id deep-link params (paymentId,
 * invoiceId, refundId, findingId) from useSearchParams as usual.
 *
 * When `role === 'finance'` we keep the original `/dashboard/finance/<page>`
 * URLs so the standalone finance dashboard continues to work unchanged.
 *
 * `page` accepts the same logical names in both contexts (e.g. `payments`,
 * `invoices`, `refunds`, `bank-transfers`, `discounts`, `reconciliation`,
 * `reports`, `audit-log`, `settings`, `settings/tax-treatments`).
 */
export function financePath(
  role: ActorRole,
  locale: string,
  page: string,
  params?: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        sp.set(k, String(v));
      }
    }
  }

  if (role === "admin") {
    // Map finance page → admin shell tab + optional sub-section.
    let tab = page;
    let section: string | null = null;
    if (page === "settings/tax-treatments") {
      tab = "settings";
      section = "vat-treatments";
    } else if (page === "settings") {
      tab = "settings";
      section = "refund-policy";
    }
    sp.set("tab", tab);
    if (section) sp.set("section", section);
    return `/${locale}/dashboard/admin/finance?${sp.toString()}`;
  }

  const qs = sp.toString();
  return `/${locale}/dashboard/finance/${page}${qs ? `?${qs}` : ""}`;
}
