"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Tag,
  Percent,
  Zap,
  Calendar,
  Users,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import Drawer from "./shared/Drawer";
import Money from "./shared/Money";
import { FINANCE_COLORS } from "./shared/financeColors";
import { discountApi } from "@/lib/api";

type Tab = "overview" | "usage" | "audit";

interface Props {
  discountId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  onEditClick?: (discountId: string) => void;
}

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleString(lng, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const DiscountDetailDrawer = ({
  discountId,
  onClose,
  onChanged,
  onEditClick,
}: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [audit, setAudit] = useState<Awaited<
    ReturnType<typeof discountApi.getAudit>
  >>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  const open = !!discountId;

  const fetchDetail = useCallback(async () => {
    if (!discountId) return;
    setLoading(true);
    try {
      const res = await discountApi.getById(discountId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [discountId]);

  const fetchAudit = useCallback(async () => {
    if (!discountId) return;
    setAuditLoading(true);
    try {
      const res = await discountApi.getAudit(discountId);
      setAudit(res || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [discountId]);

  useEffect(() => {
    if (discountId) {
      setTab("overview");
      setExpandedAudit(new Set());
      fetchDetail();
    }
  }, [discountId, fetchDetail]);

  useEffect(() => {
    if (discountId && tab === "audit") fetchAudit();
  }, [discountId, tab, fetchAudit]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("discountsPage.drawer.tabs.overview") },
    { key: "usage", label: t("discountsPage.drawer.tabs.usage") },
    { key: "audit", label: t("discountsPage.drawer.tabs.audit") },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("discountsPage.drawer.title")}
      subtitle={data?.code || ""}
      width={620}
      headerExtra={
        data ? (
          <div className="flex items-center gap-1.5">
            {data.autoApply && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                <Zap className="w-3 h-3" />
                {t("discountsPage.drawer.overview.autoApply")}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                data.isActive
                  ? `${FINANCE_COLORS.success.bg} ${FINANCE_COLORS.success.textDark}`
                  : `${FINANCE_COLORS.slate.bg} ${FINANCE_COLORS.slate.textDark}`
              }`}
            >
              {data.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ) : null
      }
      footer={
        data && onEditClick ? (
          <button
            type="button"
            onClick={() => onEditClick(data.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90"
          >
            {t("discountsPage.drawer.overview.editButton")}
          </button>
        ) : null
      }
    >
      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 w-fit">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  tab === tb.key
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-3">
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    {t("discountsPage.drawer.overview.code")}
                  </p>
                  <span className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
                    {data.code}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                  <Row
                    label={t("discountsPage.drawer.overview.type")}
                    value={
                      <span className="text-[var(--color-text-primary)] inline-flex items-center gap-1">
                        {data.type === "percentage" ? (
                          <Percent className="w-3 h-3" />
                        ) : (
                          <Tag className="w-3 h-3" />
                        )}
                        {data.type}
                      </span>
                    }
                  />
                  <Row
                    label={t("discountsPage.drawer.overview.value")}
                    value={
                      data.type === "percentage" ? (
                        <span className="text-[var(--color-text-primary)] font-semibold">
                          {Number(data.value)}%
                        </span>
                      ) : (
                        <Money
                          amount={Number(data.value)}
                          className="text-[var(--color-text-primary)] font-semibold"
                          iconSize={12}
                        />
                      )
                    }
                  />
                </div>
              </div>

              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                <Row
                  icon={<Users className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("discountsPage.drawer.overview.currentUses")}
                  value={
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {data.currentUses ?? 0}
                      {data.maxUses !== null && data.maxUses !== undefined
                        ? ` / ${data.maxUses}`
                        : ""}
                    </span>
                  }
                />
                {data.maxUsesPerUser !== null && (
                  <Row
                    label={t("discountsPage.drawer.overview.maxUsesPerUser")}
                    value={
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {data.maxUsesPerUser}
                      </span>
                    }
                  />
                )}
                <Row
                  icon={<Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("discountsPage.drawer.overview.validFrom")}
                  value={
                    <span className="text-[12px] text-[var(--color-text-primary)]">
                      {formatDateTime(data.validFrom, locale)}
                    </span>
                  }
                />
                <Row
                  label={t("discountsPage.drawer.overview.validUntil")}
                  value={
                    <span className="text-[12px] text-[var(--color-text-primary)]">
                      {formatDateTime(data.validUntil, locale)}
                    </span>
                  }
                />
                {data.minOrderAmount && (
                  <Row
                    label={t("discountsPage.drawer.overview.minOrderAmount")}
                    value={
                      <Money
                        amount={Number(data.minOrderAmount)}
                        iconSize={12}
                        className="text-[var(--color-text-primary)] text-sm"
                      />
                    }
                  />
                )}
                <Row
                  icon={<BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("discountsPage.drawer.overview.applicableCourses")}
                  value={
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {Array.isArray(data.applicableCourses) && data.applicableCourses.length > 0
                        ? `${data.applicableCourses.length}`
                        : t("discountsPage.drawer.overview.noCourses")}
                    </span>
                  }
                />
                {data.campaign && (
                  <Row
                    label={t("discountsPage.drawer.overview.campaign")}
                    value={
                      <span className="text-[12px] text-[var(--color-text-primary)] bg-[var(--color-surface-page)] rounded px-1.5 py-0.5">
                        {data.campaign}
                      </span>
                    }
                  />
                )}
                <Row
                  label={t("discountsPage.drawer.overview.createdAt")}
                  value={
                    <span className="text-[12px] text-[var(--color-text-secondary)]">
                      {formatDateTime(data.createdAt, locale)}
                    </span>
                  }
                />
              </div>
            </div>
          )}

          {tab === "usage" && (
            <div className="space-y-2">
              {!data.usageHistory || data.usageHistory.length === 0 ? (
                <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">
                  {t("discountsPage.drawer.usage.empty")}
                </p>
              ) : (
                data.usageHistory.map((u: any) => (
                  <div
                    key={u.id}
                    className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {u.email || u.userId?.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                          {formatDateTime(u.usedAt, locale)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Money
                          amount={u.amountSaved}
                          className="text-sm font-semibold text-[#15803D]"
                          iconSize={12}
                        />
                        <Link
                          href={`/${locale}/dashboard/finance/payments?paymentId=${u.paymentId}`}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline mt-0.5"
                        >
                          {t("discountsPage.drawer.usage.openPayment")}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-2">
              {auditLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">
                  {t("discountsPage.drawer.audit.empty")}
                </p>
              ) : (
                audit.map((entry) => {
                  const expanded = expandedAudit.has(entry.id);
                  const hasMeta =
                    entry.metadata && Object.keys(entry.metadata).length > 0;
                  return (
                    <div
                      key={entry.id}
                      className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                            {entry.action}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            {formatDateTime(entry.createdAt, locale)}
                            {entry.actorName ? (
                              <>
                                {" · "}
                                {t("discountsPage.drawer.audit.by")}{" "}
                                <span className="text-[var(--color-text-primary)]">
                                  {entry.actorName}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] rounded px-1.5 py-0.5">
                          {entry.entityType}
                        </span>
                      </div>
                      {hasMeta && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(expandedAudit);
                            if (next.has(entry.id)) next.delete(entry.id);
                            else next.add(entry.id);
                            setExpandedAudit(next);
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          {expanded ? (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {t("discountsPage.drawer.audit.hideMeta")}
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3 h-3" />
                              {t("discountsPage.drawer.audit.viewMeta")}
                            </>
                          )}
                        </button>
                      )}
                      {hasMeta && expanded && (
                        <pre className="mt-2 p-2 bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded text-[11px] text-[var(--color-text-primary)] overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

export default DiscountDetailDrawer;
