"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invoiceApi } from "@/lib/api";
import { formatSar, formatDate, statusPillClasses } from "./billingHelpers";

/**
 * Lists every invoice (tax invoice) issued to the student. Reuses the
 * existing `/invoices/my-invoices` endpoint (already permission-guarded);
 * download streams from `/invoices/:id/pdf`. No new backend needed.
 */
type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
};

const BillingInvoicesTab = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoiceApi
      .getMyInvoices(1, 100)
      .then((res) => {
        if (cancelled) return;
        const mapped: InvoiceRow[] = (res.data || []).map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber ?? inv.id.slice(0, 8),
          totalAmount: String(inv.totalAmount ?? "0"),
          status: inv.status ?? "issued",
          issuedAt: inv.issuedAt,
          paidAt: inv.paidAt ?? null,
        }));
        setRows(mapped);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await invoiceApi.getPdfUrl(id);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.info(t("common.loadFailed"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E5E7EB]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center text-sm text-[#DC2626]">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 px-4 text-center">
          <FileText className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[#1F2937]">
            {t("invoices.emptyTitle")}
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            {t("invoices.emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wider text-[#6B7280]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-medium text-start">
                  {t("invoices.cols.number")}
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-start">
                  {t("invoices.cols.issuedAt")}
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-end">
                  {t("invoices.cols.amount")}
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-start">
                  {t("invoices.cols.status")}
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-end">
                  {t("invoices.cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 text-sm font-medium text-[#1F2937] tabular-nums">
                    {r.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280] tabular-nums">
                    {formatDate(r.issuedAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-sm text-end text-[#1F2937] font-medium tabular-nums">
                    {formatSar(r.totalAmount)} {t("common.sar")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {(() => {
                      const mapped = invoiceStatusToLabelKey(r.status);
                      return (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(mapped)}`}
                        >
                          {labelForInvoiceStatus(mapped, t)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-end">
                    <button
                      type="button"
                      onClick={() => handleDownload(r.id)}
                      disabled={downloadingId === r.id}
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline disabled:opacity-60"
                    >
                      {downloadingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {t("common.downloadInvoice")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BillingInvoicesTab;

/** Map invoice.status (draft/issued/paid/overdue/cancelled/refunded) onto
 *  the closest pill key in the billing.status i18n namespace. */
function invoiceStatusToLabelKey(
  raw: string,
): "paid" | "pending" | "refunded" | "rejected" {
  if (raw === "paid") return "paid";
  if (raw === "refunded") return "refunded";
  if (raw === "cancelled") return "rejected";
  // draft / issued / overdue all read as "pending" for the student.
  return "pending";
}

function labelForInvoiceStatus(
  key: "paid" | "pending" | "refunded" | "rejected",
  t: (k: string) => string,
): string {
  switch (key) {
    case "paid":
      return t("status.paid");
    case "refunded":
      return t("status.refunded");
    case "rejected":
      return t("status.rejected");
    case "pending":
    default:
      return t("status.pending");
  }
}
