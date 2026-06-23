"use client";

/**
 * Coupon Codes tab. Scales to 100s of codes via:
 *   • Filter bar: status, type, scope, auto-apply, early-bird, campaign, search
 *   • Sortable columns: code, type, value, uses (n/limit bar), savings, status
 *   • Bulk select column → toolbar (enable/disable/delete N)
 *   • Pagination
 *   • Empty/loading states per filter
 *
 * Below the table: collapsible **Batches** section listing every bulk
 * generation with per-batch redemption stats and download.
 *
 * Header actions: Create Coupon (opens wizard) + Bulk Generate (opens wizard)
 * + Export CSV.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Search,
  Plus,
  Layers,
  Download,
  Filter,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Clock,
  Megaphone,
  CheckSquare,
  Square,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Copy,
  Power,
  PowerOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { discountApi } from "@/lib/api";
import Money from "../shared/Money";
import Select from "@/components/admin-dashboard/Select";
import CreateCouponWizard from "./CreateCouponWizard";
import BulkGenerateWizard from "./BulkGenerateWizard";
import ConfirmDialog from "../shared/ConfirmDialog";
import PortalMenu from "../shared/PortalMenu";

interface CouponRow {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  maxUses: number | null;
  currentUses: number;
  minOrderAmount: number | null;
  applicableCourses: string[];
  campaign: string | null;
  campaignId: string | null;
  autoApply: boolean;
  earlyBird: boolean;
  batchId: string | null;
  maxUsesPerUser: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  totalSaved: number;
}

interface BatchRow {
  id: string;
  prefix: string;
  requestedCount: number;
  createdCount: number;
  type: string;
  value: number;
  campaignLabel: string | null;
  earlyBird: boolean;
  autoApply: boolean;
  validUntil: string | null;
  createdAt: string;
  redeemed: number;
  totalSaved: number;
}

const PAGE_SIZE = 20;

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function computeStatus(c: CouponRow): "active" | "scheduled" | "expired" | "disabled" {
  if (!c.isActive) return "disabled";
  const now = new Date();
  if (c.validFrom && new Date(c.validFrom) > now) return "scheduled";
  if (c.validUntil && new Date(c.validUntil) < now) return "expired";
  // A code that's hit its max-uses cap is functionally expired even if
  // its validity window hasn't passed. Surface this so the dashboard
  // doesn't keep showing it as "Active" once it can no longer redeem.
  if (c.maxUses && c.currentUses >= c.maxUses) return "expired";
  return "active";
}

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", label: "Active" },
  scheduled: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", label: "Scheduled" },
  expired: { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Expired" },
  disabled: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", label: "Disabled" },
};

interface Props {
  onOpenCoupon: (id: string | null) => void;
  /** Bump from parent to force a refetch after a drawer-side mutation. */
  refreshKey?: number;
}

const DiscountCodesTab = ({ onOpenCoupon, refreshKey = 0 }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [autoApplyFilter, setAutoApplyFilter] = useState("all");
  const [earlyBirdFilter, setEarlyBirdFilter] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Wizards
  const [showCreate, setShowCreate] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  // Batches drawer
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [showBatches, setShowBatches] = useState(false);

  // Confirm dialogs (replace browser confirm())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.getAll(page, PAGE_SIZE, {
        status: status === "all" ? undefined : status,
        search: search || undefined,
        type: typeFilter === "all" ? undefined : (typeFilter as "percentage" | "fixed"),
        scope: scopeFilter === "all" ? undefined : (scopeFilter as "global" | "course"),
        autoApply: autoApplyFilter === "all" ? undefined : autoApplyFilter === "true",
        earlyBird: earlyBirdFilter === "all" ? undefined : earlyBirdFilter === "true",
      });
      const mapped: CouponRow[] = (res.data || []).map((d: Record<string, unknown>) => ({
        id: String(d.id),
        code: String(d.code),
        type: d.type as "percentage" | "fixed",
        value: Number(d.value),
        maxUses: (d.maxUses as number | null | undefined) ?? null,
        currentUses: Number(d.currentUses || 0),
        minOrderAmount: d.minOrderAmount ? Number(d.minOrderAmount) : null,
        applicableCourses: (d.applicableCourses as string[]) ?? [],
        campaign: (d.campaign as string | null) ?? null,
        campaignId: (d.campaignId as string | null) ?? null,
        autoApply: !!d.autoApply,
        earlyBird: !!d.earlyBird,
        batchId: (d.batchId as string | null) ?? null,
        maxUsesPerUser: (d.maxUsesPerUser as number | null | undefined) ?? null,
        validFrom: (d.validFrom as string | null) ?? null,
        validUntil: (d.validUntil as string | null) ?? null,
        isActive: !!d.isActive,
        createdAt: String(d.createdAt),
        totalSaved: Number(d.totalSaved || 0),
      }));
      setRows(mapped);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setTotal(res.pagination?.total ?? 0);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, [page, status, search, typeFilter, scopeFilter, autoApplyFilter, earlyBirdFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await discountApi.listBatches({ limit: 30 });
      setBatches(res.data as BatchRow[]);
    } catch {
      // ignore
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showBatches && batches.length === 0) fetchBatches();
  }, [showBatches, batches.length, fetchBatches]);

  const handleSearchInput = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setSearch(v);
    }, 350);
  };

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );

  const handleToggleCoupon = async (c: CouponRow) => {
    setActioning(true);
    try {
      await discountApi.update(c.id, { isActive: !c.isActive });
      toast.success(c.isActive ? t("toasts.disabled") : t("toasts.enabled"));
      await fetchRows();
    } catch {
      toast.error(t("toasts.toggleError"));
    } finally {
      setActioning(false);
      setOpenMenuId(null);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmDeleteId(id);
    setOpenMenuId(null);
  };

  const performDelete = async () => {
    if (!confirmDeleteId) return;
    setActioning(true);
    try {
      await discountApi.delete(confirmDeleteId);
      toast.success(t("toasts.deleted"));
      setConfirmDeleteId(null);
      await fetchRows();
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setActioning(false);
    }
  };

  const requestBulkAction = (action: "enable" | "disable" | "delete") => {
    if (selected.size === 0) return;
    if (action === "delete") {
      setConfirmBulkDelete(true);
      return;
    }
    void performBulkAction(action);
  };

  const performBulkAction = async (action: "enable" | "disable" | "delete") => {
    if (selected.size === 0) return;
    const verbs = {
      enable: t("toasts.enabled"),
      disable: t("toasts.disabled"),
      delete: t("toasts.deleted"),
    };
    setActioning(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        if (action === "delete") {
          await discountApi.delete(id);
        } else {
          await discountApi.update(id, { isActive: action === "enable" });
        }
      }
      toast.success(`${verbs[action]} · ${selected.size}`);
      setSelected(new Set());
      setConfirmBulkDelete(false);
      await fetchRows();
    } catch {
      toast.error(t("toasts.bulkError"));
    } finally {
      setActioning(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    toast.success(t("toasts.copied"));
  };

  const handleExport = async () => {
    try {
      await discountApi.export({
        status: status === "all" ? undefined : status,
        search: search || undefined,
      });
      toast.success(t("toasts.exported"));
    } catch {
      toast.error(t("toasts.exportError"));
    }
  };

  const handleEdit = (c: CouponRow) => {
    setEditingCoupon(c);
    setShowCreate(true);
    setOpenMenuId(null);
  };

  const handleDuplicate = (c: CouponRow) => {
    const dup: CouponRow = {
      ...c,
      id: "",
      code: `${c.code}-COPY`,
    };
    setEditingCoupon(null);
    // Open wizard with seeded values via setting editing=null + pre-set
    // No editing path means it'll insert; pre-fill is set by a small trick:
    // we use the editing prop but tell the wizard it's new (by clearing id later).
    setEditingCoupon(dup);
    setShowCreate(true);
    setOpenMenuId(null);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (status !== "all") n++;
    if (typeFilter !== "all") n++;
    if (scopeFilter !== "all") n++;
    if (autoApplyFilter !== "all") n++;
    if (earlyBirdFilter !== "all") n++;
    return n;
  }, [status, typeFilter, scopeFilter, autoApplyFilter, earlyBirdFilter]);

  return (
    <div className="space-y-5">
      {/* Toolbar — two rows so search has guaranteed width and buttons
          always fit on one line. No flex-row-reverse: dir="rtl" on
          <html> already handles RTL ordering. */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
        {/* Row 1: Search (grows) + action buttons (right) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full ps-9 pe-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-page)]"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] inline-flex items-center gap-1.5 whitespace-nowrap"
              title={t("actionShort.export")}
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span>{t("actionShort.export")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBulk(true)}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>{t("actionShort.bulk")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCoupon(null);
                setShowCreate(true);
              }}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>{t("actionShort.create")}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status pills + Filters chip */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 overflow-x-auto">
            {["all", "active", "scheduled", "expired", "disabled"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  status === s
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {t(`statusFilter.${s}`)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`px-3 py-2 border rounded-lg text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors self-start sm:self-auto ${
              activeFilterCount > 0
                ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5"
                : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
            }`}
          >
            <Filter className="w-4 h-4 flex-shrink-0" />
            <span>{t("filters.title")}</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filters strip */}
        {showAdvanced && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.type")}
              </label>
              <Select
                size="sm"
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: t("filters.any") },
                  { value: "percentage", label: t("filters.percentage") },
                  { value: "fixed", label: t("filters.fixed") },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.scope")}
              </label>
              <Select
                size="sm"
                value={scopeFilter}
                onChange={(v) => {
                  setScopeFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: t("filters.any") },
                  { value: "global", label: t("filters.globalScope") },
                  { value: "course", label: t("filters.courseScope") },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.autoApply")}
              </label>
              <Select
                size="sm"
                value={autoApplyFilter}
                onChange={(v) => {
                  setAutoApplyFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: t("filters.any") },
                  { value: "true", label: t("filters.yes") },
                  { value: "false", label: t("filters.no") },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.earlyBird")}
              </label>
              <Select
                size="sm"
                value={earlyBirdFilter}
                onChange={(v) => {
                  setEarlyBirdFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: t("filters.any") },
                  { value: "true", label: t("filters.yes") },
                  { value: "false", label: t("filters.no") },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk-action toolbar */}
      {selected.size > 0 && (
        <div className={`bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("bulk.selectedCount", { n: selected.size })}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
            >
              <X className="w-3 h-3" /> {t("bulk.clear")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={actioning}
              onClick={() => requestBulkAction("enable")}
              className="px-3 py-1.5 text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              <Power className="w-3.5 h-3.5" /> {t("bulk.enable")}
            </button>
            <button
              type="button"
              disabled={actioning}
              onClick={() => requestBulkAction("disable")}
              className="px-3 py-1.5 text-[12px] font-medium text-[#92400E] bg-[#FEF3C7] rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              <PowerOff className="w-3.5 h-3.5" /> {t("bulk.disable")}
            </button>
            <button
              type="button"
              disabled={actioning}
              onClick={() => requestBulkAction("delete")}
              className="px-3 py-1.5 text-[12px] font-medium text-[#B91C1C] bg-[#FEE2E2] rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> {t("bulk.delete")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="w-10 px-3 py-3">
                  <button type="button" onClick={toggleAll}>
                    {selected.size === rows.length && rows.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    )}
                  </button>
                </th>
                <Th>{t("columns.code")}</Th>
                <Th>{t("columns.value")}</Th>
                <Th>{t("columns.scope")}</Th>
                <Th>{t("columns.uses")}</Th>
                <Th>{t("columns.savings")}</Th>
                <Th>{t("columns.validity")}</Th>
                <Th>{t("columns.status")}</Th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-[var(--color-border-subtle)]">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-8 bg-[var(--color-surface-page)] rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Tag className="w-10 h-10 mx-auto text-[var(--color-text-secondary)]/40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t("noCoupons")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("noCouponsHint")}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const st = computeStatus(c);
                  const pill = STATUS_PILL[st];
                  const usagePct =
                    c.maxUses && c.maxUses > 0
                      ? Math.min(100, Math.round((c.currentUses / c.maxUses) * 100))
                      : null;
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]/50"
                    >
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => toggleRow(c.id)}>
                          {selected.has(c.id) ? (
                            <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => onOpenCoupon(c.id)}
                          className="flex items-center gap-2 text-start group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                                {c.code}
                              </span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyCode(c.code);
                                }}
                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {c.autoApply && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">
                                  <Sparkles className="w-2.5 h-2.5" /> Auto
                                </span>
                              )}
                              {c.earlyBird && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#9A3412]">
                                  <Clock className="w-2.5 h-2.5" /> Early
                                </span>
                              )}
                              {c.campaignId && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">
                                  <Megaphone className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {c.type === "percentage" ? `${c.value}%` : (
                            <Money amount={c.value} decimals={0} />
                          )}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wide">
                          {c.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
                        {c.applicableCourses.length === 0
                          ? t("scope.global")
                          : t("scope.nCourses", { n: c.applicableCourses.length })}
                      </td>
                      <td className="px-3 py-3 min-w-[160px]">
                        <div className="text-[12px] text-[var(--color-text-primary)] mb-1">
                          {c.currentUses}
                          {c.maxUses ? ` / ${c.maxUses}` : ` / ∞`}
                        </div>
                        {usagePct !== null && (
                          <div className="h-1.5 bg-[var(--color-surface-page)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-primary)] rounded-full"
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {c.totalSaved > 0 ? (
                          <span className="text-[#15803D] font-medium">
                            <Money amount={c.totalSaved} decimals={0} />
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
                        {c.validUntil ? fmtDate(c.validUntil, locale) : t("scope.noExpiry")}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
                          {t(`statusPill.${st}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <RowActionMenu
                          c={c}
                          open={openMenuId === c.id}
                          onOpenChange={(o) => setOpenMenuId(o ? c.id : null)}
                          onView={() => { setOpenMenuId(null); onOpenCoupon(c.id); }}
                          onEdit={() => handleEdit(c)}
                          onDuplicate={() => handleDuplicate(c)}
                          onToggle={() => handleToggleCoupon(c)}
                          onDelete={() => requestDelete(c.id)}
                          t={t}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-4 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-sm text-[var(--color-text-secondary)]`}>
            <span>
              {t("pagination.showing", {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, total),
                total,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md hover:bg-[var(--color-surface-page)] disabled:opacity-30"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <span className="px-2 text-[13px] font-medium text-[var(--color-text-primary)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md hover:bg-[var(--color-surface-page)] disabled:opacity-30"
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Batches accordion */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBatches((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--color-surface-page)] transition-colors"
        >
          <div className={`flex items-center gap-3`}>
            <div className="w-9 h-9 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#6D28D9]" />
            </div>
            <div className="text-start">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t("batches.title")}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("batches.subtitle")}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ${showBatches ? "rotate-180" : ""}`}
          />
        </button>

        {showBatches && (
          <div className="border-t border-[var(--color-border-subtle)] overflow-x-auto">
            {batchesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : batches.length === 0 ? (
              <p className="text-center py-10 text-sm text-[var(--color-text-secondary)]">
                {t("batches.empty")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                  <tr>
                    <Th>{t("batches.cols.prefix")}</Th>
                    <Th>{t("batches.cols.count")}</Th>
                    <Th>{t("batches.cols.discount")}</Th>
                    <Th>{t("batches.cols.redeemed")}</Th>
                    <Th>{t("batches.cols.saved")}</Th>
                    <Th>{t("batches.cols.created")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const pct = b.createdCount > 0 ? Math.round((b.redeemed / b.createdCount) * 100) : 0;
                    return (
                      <tr key={b.id} className="border-t border-[var(--color-border-subtle)]">
                        <td className="px-3 py-2.5 font-mono font-bold text-[var(--color-text-primary)] text-[12px]">
                          {b.prefix}
                          {(b.earlyBird || b.autoApply) && (
                            <span className="ms-2 inline-flex items-center gap-1">
                              {b.earlyBird && <Clock className="w-3 h-3 text-[#D97706]" />}
                              {b.autoApply && <Sparkles className="w-3 h-3 text-[#D97706]" />}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px]">
                          {b.createdCount}/{b.requestedCount}
                        </td>
                        <td className="px-3 py-2.5 text-[12px]">
                          {b.type === "percentage" ? `${b.value}%` : (<Money amount={b.value} decimals={0} />)}
                        </td>
                        <td className="px-3 py-2.5 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[var(--color-surface-page)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#16A34A] rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#15803D] font-medium">
                          <Money amount={b.totalSaved} decimals={0} />
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
                          {fmtDate(b.createdAt, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <CreateCouponWizard
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setEditingCoupon(null);
        }}
        onSaved={() => fetchRows()}
        editing={editingCoupon}
      />
      <BulkGenerateWizard
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onGenerated={() => {
          fetchRows();
          // refresh batches if open
          if (showBatches) fetchBatches();
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title={t("confirms.deleteCouponTitle")}
        message={t("confirms.deleteCouponBody")}
        confirmLabel={t("confirms.deleteCouponBtn")}
        danger
        loading={actioning}
        onConfirm={performDelete}
        onClose={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={t("confirms.bulkDeleteTitle", { n: selected.size })}
        message={t("confirms.bulkDeleteBody")}
        confirmLabel={t("confirms.bulkDeleteBtn", { n: selected.size })}
        danger
        loading={actioning}
        onConfirm={() => performBulkAction("delete")}
        onClose={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
};

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
);

const MenuItem = ({
  onClick,
  icon: Icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon: typeof Tag;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-page)] text-start ${
      danger ? "text-[#B91C1C] hover:bg-[#FEE2E2]" : "text-[var(--color-text-primary)]"
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {children}
  </button>
);

// Per-row action menu. Owns its trigger ref so the PortalMenu can
// anchor to the right element without prop-drilling refs through
// the whole table.
const RowActionMenu = ({
  c,
  open,
  onOpenChange,
  onView,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  t,
}: {
  c: CouponRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      <PortalMenu anchorRef={triggerRef} open={open} onClose={() => onOpenChange(false)}>
        <MenuItem onClick={onView} icon={Eye}>
          {t("actions.view")}
        </MenuItem>
        <MenuItem onClick={onEdit} icon={Pencil}>
          {t("actions.edit")}
        </MenuItem>
        <MenuItem onClick={onDuplicate} icon={Copy}>
          {t("actions.duplicate")}
        </MenuItem>
        <MenuItem onClick={onToggle} icon={c.isActive ? PowerOff : Power}>
          {c.isActive ? t("actions.disable") : t("actions.enable")}
        </MenuItem>
        <div className="border-t border-[var(--color-border-subtle)] my-1" />
        <MenuItem onClick={onDelete} icon={Trash2} danger>
          {t("actions.delete")}
        </MenuItem>
      </PortalMenu>
    </>
  );
};

export default DiscountCodesTab;
