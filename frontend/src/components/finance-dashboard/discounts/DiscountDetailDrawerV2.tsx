"use client";

/**
 * Discount detail drawer — opens from any tab.
 *
 * 4 tabs (Performance condensed into Overview to keep the drawer focused):
 *   • Overview     — header card with big code + status, KPI mini-cards,
 *                    validity / scope / flags facts
 *   • Configuration — read-only settings table + Edit button
 *   • Usage        — paginated usage history (student, course, savings,
 *                    cross-link to payment)
 *   • Audit        — timeline of all events incl. failed validations
 *
 * Footer: Edit / Toggle (enable/disable) / Delete.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Tag,
  Loader2,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Sparkles,
  Clock,
  Megaphone,
  Calendar,
  Hash,
  Users,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Drawer from "../shared/Drawer";
import Money from "../shared/Money";
import { FINANCE_COLORS } from "../shared/financeColors";
import { discountApi } from "@/lib/api";
import CreateCouponWizard from "./CreateCouponWizard";
import ConfirmDialog from "../shared/ConfirmDialog";

interface Detail {
  id: string;
  code: string;
  type: string;
  value: string | number;
  maxUses: number | null;
  currentUses: number;
  minOrderAmount: string | null;
  applicableCourses: string[];
  validFrom: string | null;
  validUntil: string | null;
  campaign: string | null;
  campaignId: string | null;
  autoApply: boolean;
  earlyBird: boolean;
  batchId: string | null;
  maxUsesPerUser: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalSaved: string;
  usageHistory: Array<{
    id: string;
    userId: string;
    email: string | null;
    amountSaved: number;
    usedAt: string;
  }>;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

interface Props {
  discountId: string | null;
  onClose: () => void;
  /** Fired after a mutation (delete / toggle / edit) so the parent can
   * refetch dependent tabs (e.g. Early-Bird cards otherwise stay stale
   * when a code is deleted via this drawer). */
  onChanged?: () => void;
}

function fmtDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleString(lng, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function computeStatus(d: Detail | null): "active" | "scheduled" | "expired" | "disabled" {
  if (!d) return "disabled";
  if (!d.isActive) return "disabled";
  const now = new Date();
  if (d.validFrom && new Date(d.validFrom) > now) return "scheduled";
  if (d.validUntil && new Date(d.validUntil) < now) return "expired";
  if (d.maxUses && d.currentUses >= d.maxUses) return "expired";
  return "active";
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  scheduled: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]" },
  expired: { bg: "bg-[#F1F5F9]", text: "text-[#475569]" },
  disabled: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
};

const DiscountDetailDrawerV2 = ({ discountId, onClose, onChanged }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.detailDrawer");
  const tShared = useTranslations("financeDashboard.discountsPage");
  const locale = useLocale();
  // const isRTL = locale === "ar"; // not needed — dir="rtl" on <html> handles flex order

  const [tab, setTab] = useState<"overview" | "config" | "usage" | "audit">("overview");
  const [data, setData] = useState<Detail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchData = useCallback(async () => {
    if (!discountId) return;
    setLoading(true);
    try {
      const res = await discountApi.getById(discountId);
      setData(res as Detail);
    } finally {
      setLoading(false);
    }
  }, [discountId]);

  useEffect(() => {
    if (discountId) {
      setTab("overview");
      setData(null);
      setAudit([]);
      fetchData();
    }
  }, [discountId, fetchData]);

  useEffect(() => {
    if (!discountId || tab !== "audit" || audit.length > 0) return;
    setAuditLoading(true);
    discountApi
      .getAudit(discountId)
      .then((rows) => setAudit(rows as AuditEntry[]))
      .catch(() => {})
      .finally(() => setAuditLoading(false));
  }, [discountId, tab, audit.length]);

  if (!discountId) return null;

  const status = computeStatus(data);
  const pill = STATUS_PILL[status];
  const valueNum = data ? Number(data.value) : 0;
  const totalSaved = data ? Number(data.totalSaved ?? 0) : 0;
  const usagePct =
    data?.maxUses && data.maxUses > 0
      ? Math.min(100, Math.round((data.currentUses / data.maxUses) * 100))
      : null;

  const handleToggle = async () => {
    if (!data) return;
    setActioning(true);
    try {
      await discountApi.update(data.id, { isActive: !data.isActive });
      toast.success(data.isActive ? t("toasts.disabled") : t("toasts.enabled"));
      await fetchData();
      onChanged?.();
    } catch {
      toast.error(t("toasts.toggleError"));
    } finally {
      setActioning(false);
    }
  };

  const performDelete = async () => {
    if (!data) return;
    setActioning(true);
    try {
      await discountApi.delete(data.id);
      toast.success(t("toasts.deleted"));
      setConfirmDelete(false);
      onClose();
      onChanged?.();
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setActioning(false);
    }
  };

  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: "overview", label: t("tabs.overview") },
    { key: "config", label: t("tabs.config") },
    { key: "usage", label: t("tabs.usage") },
    { key: "audit", label: t("tabs.audit") },
  ];

  return (
    <>
      <Drawer
        open={!!discountId}
        onClose={onClose}
        title={data ? data.code : t("loading")}
        subtitle={
          data
            ? data.type === "percentage"
              ? `${valueNum}% off`
              : `SAR ${valueNum} off`
            : undefined
        }
        width={640}
        headerExtra={
          data && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${pill.bg} ${pill.text}`}>
              {t(`statusPill.${status}`)}
            </span>
          )
        }
        footer={
          data && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={actioning}
                className="px-3 py-2 text-[12px] font-medium text-[#B91C1C] hover:bg-[#FEE2E2] rounded-md flex items-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("delete")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={actioning}
                  className={`px-3 py-2 text-[12px] font-medium rounded-md flex items-center gap-1.5 ${
                    data.isActive
                      ? "text-[#92400E] bg-[#FEF3C7] hover:opacity-90"
                      : "text-[#15803D] bg-[#DCFCE7] hover:opacity-90"
                  }`}
                >
                  {data.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {data.isActive ? t("disable") : t("enable")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("edit")}
                </button>
              </div>
            </div>
          )
        }
      >
        {/* Tab strip */}
        <div className={`flex items-center gap-1 px-5 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]`}>
          {tabs.map((tt) => (
            <button
              key={tt.key}
              type="button"
              onClick={() => setTab(tt.key)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
                tab === tt.key
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {tt.label}
            </button>
          ))}
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : tab === "overview" ? (
          <div className="p-5 space-y-4">
            {/* Hero badge */}
            <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 p-5 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#F59E0B] to-[#DC2626] text-white shadow-md mb-3">
                <Tag className="w-4 h-4" />
                <span className="font-bold text-base">
                  {data.type === "percentage" ? `${valueNum}% OFF` : `SAR ${valueNum} OFF`}
                </span>
              </div>
              <p className="font-mono text-3xl font-bold text-[var(--color-text-primary)] tracking-wide mb-2">
                {data.code}
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {data.autoApply && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Auto-apply
                  </span>
                )}
                {data.earlyBird && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFEDD5] text-[#9A3412] inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Early Bird
                  </span>
                )}
                {data.campaignId && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#6D28D9] inline-flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> {data.campaign ?? "Campaign"}
                  </span>
                )}
              </div>
            </div>

            {/* KPI mini-cards */}
            <div className="grid grid-cols-3 gap-3">
              <MiniKpi
                label={t("overview.uses")}
                value={`${data.currentUses}${data.maxUses ? ` / ${data.maxUses}` : ""}`}
                bar={usagePct}
                color={FINANCE_COLORS.info}
              />
              <MiniKpi
                label={t("overview.totalSaved")}
                value={<Money amount={totalSaved} decimals={0} />}
                color={FINANCE_COLORS.success}
              />
              <MiniKpi
                label={t("overview.uniqueUsers")}
                value={data.usageHistory.length}
                color={FINANCE_COLORS.violet}
              />
            </div>

            {/* Facts */}
            <div className="grid grid-cols-2 gap-3">
              <FactRow icon={Calendar} label={t("overview.validFrom")}>
                {fmtDateTime(data.validFrom, locale)}
              </FactRow>
              <FactRow icon={Calendar} label={t("overview.validUntil")}>
                {fmtDateTime(data.validUntil, locale)}
              </FactRow>
              <FactRow icon={Hash} label={t("overview.scope")}>
                {data.applicableCourses.length === 0
                  ? t("overview.globalScope")
                  : t("overview.nCourses", { n: data.applicableCourses.length })}
              </FactRow>
              <FactRow icon={Users} label={t("overview.perUser")}>
                {data.maxUsesPerUser ?? "∞"}
              </FactRow>
              {data.minOrderAmount && Number(data.minOrderAmount) > 0 && (
                <FactRow icon={ShoppingBag} label={t("overview.minOrder")}>
                  <Money amount={Number(data.minOrderAmount)} decimals={0} />
                </FactRow>
              )}
              <FactRow icon={Calendar} label={t("overview.created")}>
                {fmtDateTime(data.createdAt, locale)}
              </FactRow>
            </div>
          </div>
        ) : tab === "config" ? (
          <div className="p-5 space-y-3">
            <dl className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border-subtle)]">
              <ConfigRow label={t("config.code")} value={<span className="font-mono font-bold">{data.code}</span>} />
              <ConfigRow label={t("config.type")} value={data.type} />
              <ConfigRow
                label={t("config.value")}
                value={data.type === "percentage" ? `${valueNum}%` : <Money amount={valueNum} decimals={2} />}
              />
              <ConfigRow label={t("config.maxUses")} value={data.maxUses ?? "∞"} />
              <ConfigRow label={t("config.perUser")} value={data.maxUsesPerUser ?? "∞"} />
              <ConfigRow label={t("config.minOrder")} value={data.minOrderAmount ? <Money amount={Number(data.minOrderAmount)} /> : "—"} />
              <ConfigRow label={t("config.autoApply")} value={data.autoApply ? "✓" : "—"} />
              <ConfigRow label={t("config.earlyBird")} value={data.earlyBird ? "✓" : "—"} />
              <ConfigRow label={t("config.campaign")} value={data.campaign ?? "—"} />
              <ConfigRow label={t("config.scope")} value={data.applicableCourses.length === 0 ? t("overview.globalScope") : `${data.applicableCourses.length} course(s)`} />
              <ConfigRow label={t("config.batch")} value={data.batchId ?? "—"} />
            </dl>
          </div>
        ) : tab === "usage" ? (
          <div className="p-5">
            {data.usageHistory.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                {t("usage.empty")}
              </p>
            ) : (
              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">
                        {t("usage.user")}
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">
                        {t("usage.saved")}
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">
                        {t("usage.when")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usageHistory.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--color-border-subtle)]">
                        <td className="px-3 py-2.5 text-[12px] text-[var(--color-text-primary)] truncate max-w-[180px]">
                          {u.email ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#15803D] font-semibold">
                          <Money amount={u.amountSaved} decimals={0} />
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
                          {fmtDateTime(u.usedAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5">
            {auditLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : audit.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                {t("audit.empty")}
              </p>
            ) : (
              <ol className="relative ms-2 space-y-3">
                <div className="absolute start-2 top-2 bottom-2 w-px bg-[var(--color-border)]" />
                {audit.map((a) => {
                  const isFail = a.action === "discount_validation_failed";
                  return (
                    <li key={a.id} className="relative ps-7">
                      <span
                        className={`absolute start-0 top-1 w-4 h-4 rounded-full flex items-center justify-center ${
                          isFail ? "bg-[#FEE2E2]" : "bg-[#DCFCE7]"
                        }`}
                      >
                        {isFail ? (
                          <AlertCircle className="w-2.5 h-2.5 text-[#B91C1C]" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                        )}
                      </span>
                      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                            {a.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-secondary)]">
                            {fmtDateTime(a.createdAt, locale)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {a.actorEmail ?? "system"}
                          {a.metadata && (a.metadata as Record<string, unknown>).error
                            ? ` — ${(a.metadata as Record<string, unknown>).error as string}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </Drawer>

      {data && (
        <CreateCouponWizard
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            fetchData();
            onChanged?.();
          }}
          editing={{
            id: data.id,
            code: data.code,
            type: data.type as "percentage" | "fixed",
            value: valueNum,
            maxUses: data.maxUses,
            maxUsesPerUser: data.maxUsesPerUser,
            campaign: data.campaign,
            campaignId: data.campaignId,
            autoApply: data.autoApply,
            earlyBird: data.earlyBird,
            minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : null,
            applicableCourses: data.applicableCourses,
            validFrom: data.validFrom,
            validUntil: data.validUntil,
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={tShared("confirms.deleteCouponTitle")}
        message={tShared("confirms.deleteCouponBody")}
        confirmLabel={tShared("confirms.deleteCouponBtn")}
        danger
        loading={actioning}
        onConfirm={performDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
};

const MiniKpi = ({
  label,
  value,
  bar,
  color,
}: {
  label: string;
  value: React.ReactNode;
  bar?: number | null;
  color: { bg: string; text: string };
}) => (
  <div className={`p-3 rounded-xl ${color.bg} border border-[var(--color-border-subtle)]`}>
    <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{label}</p>
    <p className={`text-lg font-bold mt-0.5 ${color.text}`}>{value}</p>
    {bar !== null && bar !== undefined && (
      <div className="h-1 mt-1 bg-white/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.text.replace("text-", "bg-")}`} style={{ width: `${bar}%` }} />
      </div>
    )}
  </div>
);

const FactRow = ({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Tag;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)]">
    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] mb-1">
      <Icon className="w-3 h-3" /> {label}
    </div>
    <div className="text-sm font-medium text-[var(--color-text-primary)]">{children}</div>
  </div>
);

const ConfigRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="px-4 py-2.5 flex items-center justify-between gap-3">
    <dt className="text-[12px] text-[var(--color-text-secondary)]">{label}</dt>
    <dd className="text-[12px] font-medium text-[var(--color-text-primary)] text-end">{value}</dd>
  </div>
);

export default DiscountDetailDrawerV2;
