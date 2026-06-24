"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Info,
} from "lucide-react";
import Select from "@/components/admin-dashboard/Select";
import FinancePageShell from "./shared/FinancePageShell";
import { useActorRole } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import {
  financeApi,
  type VatTreatmentRow,
  type VatTreatmentValue,
} from "@/lib/api";

const TREATMENTS: VatTreatmentValue[] = ["standard", "exempt", "zero_rated"];

const TREATMENT_PILL: Record<VatTreatmentValue, { bg: string; fg: string }> = {
  standard:   { bg: "#DBEAFE", fg: "#1D4ED8" },
  exempt:     { bg: "#FEF3C7", fg: "#92400E" },
  zero_rated: { bg: "#E0E7FF", fg: "#4338CA" },
};

const formatInt = (n: number) => (n ?? 0).toLocaleString("en-US");

export interface VatTreatmentsContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

const VatTreatmentsContent = ({ embedded = false }: VatTreatmentsContentProps) => {
  const t = useTranslations("financeDashboard.vatTreatments");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const actorRole = useActorRole();

  const [search, setSearch] = useState("");
  const [treatmentFilter, setTreatmentFilter] = useState<VatTreatmentValue | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [rows, setRows] = useState<VatTreatmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await financeApi.listVatTreatments({
        search: search.trim() || undefined,
        treatment: treatmentFilter,
        page,
        pageSize,
      });
      setRows(res.data);
      setTotal(res.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, treatmentFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, treatmentFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  const allOnPageSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateRow = async (id: string, value: VatTreatmentValue) => {
    setRowBusy(id);
    try {
      await financeApi.updateVatTreatment(id, value);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, vatTreatment: value } : r)));
      toast.success(t("toastSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastSaveFailed"));
    } finally {
      setRowBusy(null);
    }
  };

  const handleBulk = async (value: VatTreatmentValue) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await financeApi.bulkUpdateVatTreatments(
        Array.from(selected),
        value,
      );
      toast.success(t("toastBulkSaved", { n: formatInt(res.count) }));
      setSelected(new Set());
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastSaveFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const filterOptions = [
    { value: "all", label: t("filters.all") },
    { value: "standard", label: t("treatments.standard") },
    { value: "exempt", label: t("treatments.exempt") },
    { value: "zero_rated", label: t("treatments.zero_rated") },
  ];

  const inner = (
    <>
      <Link
                href={financePath(actorRole, locale, "settings")}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-3"
              >
                {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                {t("backToSettings")}
              </Link>

              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">{t("subtitle")}</p>
              </div>

              <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-[12px] text-[#1E40AF] mb-4">
                <Info className="w-4 h-4 flex-shrink-0 mt-[1px]" />
                <span>{t("notice")}</span>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                      {t("filters.searchLabel")}
                    </label>
                    <div className="relative">
                      <Search className={`absolute top-2.5 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`} />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("filters.searchPlaceholder")}
                        className={`w-full h-10 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 border border-[var(--color-border)] rounded-lg text-[13px]`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                      {t("filters.treatmentLabel")}
                    </label>
                    <Select
                      value={treatmentFilter}
                      onChange={(v) => setTreatmentFilter(v as VatTreatmentValue | "all")}
                      options={filterOptions}
                      size="default"
                    />
                  </div>
                </div>
              </div>

              {/* Bulk actions bar */}
              {selected.size > 0 && (
                <div className="flex items-center justify-between gap-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-xl p-3 mb-4">
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {t("bulk.selected", { n: formatInt(selected.size) })}
                  </span>
                  <div className="flex items-center gap-2">
                    {TREATMENTS.map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => handleBulk(tr)}
                        disabled={bulkBusy}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                      >
                        {t("bulk.setAs", { treatment: t(`treatments.${tr}`) })}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      {t("bulk.clear")}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {loading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 bg-[var(--color-surface-page)] rounded-md animate-pulse" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("loadError")}</p>
                    <button
                      type="button"
                      onClick={fetchData}
                      className="mt-3 text-xs text-[var(--color-primary)] underline"
                    >
                      {t("retry")}
                    </button>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Search className="w-10 h-10 text-[var(--color-text-secondary)] opacity-40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("noResults")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
                            <th className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={allOnPageSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 accent-[var(--color-primary)]"
                              />
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold`}>
                              {t("col.course")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold`}>
                              {t("col.deliveryType")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold`}>
                              {t("col.price")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold`}>
                              {t("col.sales90d")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold`}>
                              {t("col.treatment")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors"
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected.has(r.id)}
                                  onChange={() => toggleRow(r.id)}
                                  className="w-4 h-4 accent-[var(--color-primary)]"
                                />
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="text-[var(--color-text-primary)] font-medium">{r.title}</div>
                                {r.titleAr && (
                                  <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5" dir="rtl">
                                    {r.titleAr}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top text-[var(--color-text-secondary)]">
                                {r.deliveryType || "—"}
                              </td>
                              <td className="px-4 py-3 align-top font-mono" dir="ltr">
                                SAR {Number(r.price || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 align-top text-[var(--color-text-secondary)]">
                                {formatInt(r.salesCount)}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {TREATMENTS.map((tr) => {
                                    const active = r.vatTreatment === tr;
                                    const pill = TREATMENT_PILL[tr];
                                    const isBusy = rowBusy === r.id;
                                    return (
                                      <button
                                        key={tr}
                                        type="button"
                                        onClick={() => !active && handleUpdateRow(r.id, tr)}
                                        disabled={isBusy || active}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                          active
                                            ? "border-transparent"
                                            : "bg-[var(--color-surface-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] cursor-pointer"
                                        }`}
                                        style={
                                          active
                                            ? { backgroundColor: pill.bg, color: pill.fg }
                                            : undefined
                                        }
                                      >
                                        {active && isBusy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : active ? (
                                          <CheckCircle className="w-3 h-3" />
                                        ) : null}
                                        {t(`treatments.${tr}`)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)]">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("pagination.showing", {
                          from: formatInt(from),
                          to: formatInt(to),
                          total: formatInt(total),
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          {t("pagination.previous")}
                        </button>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {formatInt(page)} / {formatInt(totalPages)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t("pagination.next")}
                          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
    </>
  );

  return embedded ? inner : <FinancePageShell>{inner}</FinancePageShell>;
};

export default VatTreatmentsContent;
