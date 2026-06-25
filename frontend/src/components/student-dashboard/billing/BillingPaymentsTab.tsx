"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  studentFinanceApi,
  type StudentPaymentRow,
  type StudentPaymentsFilters,
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DatePicker from "@/components/ui/DatePicker";
import {
  formatSar,
  formatDate,
  pickCourseTitle,
  statusPillClasses,
  statusLabel,
} from "./billingHelpers";

type Props = {
  onOpenPayment: (paymentId: string) => void;
};

const STATUS_FILTER_OPTIONS = [
  "all",
  "paid",
  "pending",
  "awaiting_approval",
  "failed",
  "abandoned",
  "refunded",
  "partially_refunded",
] as const;

const GATEWAY_FILTER_OPTIONS = [
  "all",
  "moyasar",
  "tamara",
  "tabby",
  "bank_transfer",
] as const;

const BillingPaymentsTab = ({ onOpenPayment }: Props) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<StudentPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [filters, setFilters] = useState<StudentPaymentsFilters>({});
  const [draftFilters, setDraftFilters] = useState<StudentPaymentsFilters>({});

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentFinanceApi.listPayments(page, 20, filters);
      setRows(res.data);
      setPagination({ total: res.pagination.total, pages: res.pagination.pages });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, filters, t]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const applyFilters = () => {
    setPage(1);
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters({});
    setFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 items-end">
          <FilterDropdown
            label={t("payments.filters.status")}
            value={draftFilters.status ?? "all"}
            onChange={(v) =>
              setDraftFilters((f) => ({ ...f, status: v === "all" ? undefined : v }))
            }
            options={STATUS_FILTER_OPTIONS.map((s) => ({
              value: s,
              label:
                s === "all" ? t("payments.filters.all") : statusLabel(s, t),
            }))}
            isRTL={isRTL}
          />
          <FilterDropdown
            label={t("payments.filters.method")}
            value={draftFilters.gateway ?? "all"}
            onChange={(v) =>
              setDraftFilters((f) => ({ ...f, gateway: v === "all" ? undefined : v }))
            }
            options={GATEWAY_FILTER_OPTIONS.map((g) => ({
              value: g,
              label: g === "all" ? t("payments.filters.all") : t(`gateway.${g}`),
            }))}
            isRTL={isRTL}
          />
          <DateFilter
            label={t("payments.filters.from")}
            value={draftFilters.dateFrom ?? ""}
            onChange={(v) =>
              setDraftFilters((f) => ({ ...f, dateFrom: v || undefined }))
            }
          />
          <DateFilter
            label={t("payments.filters.to")}
            value={draftFilters.dateTo ?? ""}
            onChange={(v) =>
              setDraftFilters((f) => ({ ...f, dateTo: v || undefined }))
            }
          />
        </div>
        <div className="flex gap-2 mt-3 justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-md"
          >
            {t("payments.filters.clear")}
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            {t("payments.filters.apply")}
          </button>
        </div>
      </div>

      {/* Body */}
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
            {t("payments.emptyTitle")}
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            {t("payments.emptyDesc")}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <Th>{t("payments.cols.date")}</Th>
                  <Th>{t("payments.cols.course")}</Th>
                  <Th align="end">{t("payments.cols.amount")}</Th>
                  <Th>{t("payments.cols.method")}</Th>
                  <Th>{t("payments.cols.status")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-[#F9FAFB] cursor-pointer"
                    onClick={() => onOpenPayment(p.id)}
                  >
                    <Td className="text-[#6B7280] tabular-nums">
                      {formatDate(p.paidAt ?? p.createdAt, locale)}
                    </Td>
                    <Td className="text-[#1F2937] font-medium max-w-xs truncate">
                      {pickCourseTitle(p.courseTitle, p.courseTitleAr, locale)}
                    </Td>
                    <Td align="end" className="tabular-nums text-[#1F2937] font-medium">
                      {formatSar(p.amount)} {t("common.sar")}
                    </Td>
                    <Td className="text-[#6B7280] text-xs">
                      {gatewayLabel(p.gateway, t)}
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(p.status)}`}
                      >
                        {statusLabel(p.status, t)}
                      </span>
                    </Td>
                    <Td>
                      <ChevronRight
                        className={`w-4 h-4 text-[#9CA3AF] ${isRTL ? "rotate-180" : ""}`}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenPayment(p.id)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-xl p-3 text-left flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1F2937] truncate">
                      {pickCourseTitle(p.courseTitle, p.courseTitleAr, locale)}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {formatDate(p.paidAt ?? p.createdAt, locale)} ·{" "}
                      {gatewayLabel(p.gateway, t)}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-sm font-semibold text-[#1F2937] tabular-nums">
                      {formatSar(p.amount)} {t("common.sar")}
                    </div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusPillClasses(p.status)}`}
                    >
                      {statusLabel(p.status, t)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-xl px-3 py-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-[#374151] disabled:opacity-40"
              >
                {isRTL ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
              <span className="text-xs text-[#6B7280] tabular-nums">
                {page} / {pagination.pages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-[#374151] disabled:opacity-40"
              >
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BillingPaymentsTab;

function gatewayLabel(
  raw: string,
  t: (key: string) => string,
): string {
  const known = new Set(["moyasar", "tamara", "tabby", "bank_transfer", "mock"]);
  return known.has(raw) ? t(`gateway.${raw}`) : raw;
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "end";
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium ${align === "end" ? "text-end" : "text-start"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: "end";
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 text-sm ${align === "end" ? "text-end" : "text-start"} ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

function FilterDropdown({
  label,
  value,
  onChange,
  options,
  isRTL,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isRTL: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="flex flex-col gap-1 text-xs text-[#6B7280]">
      <span>{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-full h-9 ps-3 pe-2 flex items-center justify-between gap-2 border border-[#E5E7EB] rounded-md text-sm bg-white text-[#1F2937] hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          >
            <span className="truncate">{selected?.label ?? "—"}</span>
            <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isRTL ? "end" : "start"}
          sideOffset={4}
          className="min-w-(--radix-dropdown-menu-trigger-width) max-h-72 overflow-y-auto"
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => onChange(o.value)}
                className={isSelected ? "bg-[#F3F4F6] text-[#1F2937]" : ""}
              >
                <span className="flex-1">{o.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-[#6B7280]">
      <span>{label}</span>
      <DatePicker
        value={value}
        onChange={onChange}
        className="py-1.5! rounded-md!"
        placeholder="—"
      />
    </div>
  );
}
