"use client";

/**
 * Campaign detail drawer — opens from CampaignsTabV2 cards.
 *
 * 3 tabs:
 *   • Overview — header card, budget burn, period, banner status
 *   • Codes    — child codes table (click → opens coupon drawer)
 *   • Audit    — coming-soon placeholder (uses discount audit endpoint per-code)
 */

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Megaphone, Tag, ToggleRight, Calendar, Loader2 } from "lucide-react";
import Drawer from "../shared/Drawer";
import Money from "../shared/Money";
import { discountApi } from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  budget: string | null;
  currentSpend: string;
  isActive: boolean;
  showOnSite: boolean;
  bannerCta: string | null;
  codes?: Array<{
    id: string;
    code: string;
    type: string;
    value: string;
    currentUses: number;
    maxUses: number | null;
    isActive: boolean;
    autoApply: boolean;
    validFrom: string | null;
    validUntil: string | null;
  }>;
}

interface Props {
  campaignId: string | null;
  onClose: () => void;
  onOpenCoupon: (id: string) => void;
}

function fmtDate(iso: string | null, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, { day: "2-digit", month: "short", year: "numeric" });
}

const CampaignDetailDrawer = ({ campaignId, onClose, onOpenCoupon }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.campaignsV2.drawer");
  const locale = useLocale();
  // const isRTL = locale === "ar"; // not needed — dir="rtl" on <html> handles flex order

  const [tab, setTab] = useState<"overview" | "codes">("overview");
  const [data, setData] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    discountApi
      .getCampaign(campaignId)
      .then((res) => setData(res as Campaign))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    setTab("overview");
  }, [campaignId]);

  if (!campaignId) return null;

  const budget = data?.budget ? Number(data.budget) : null;
  const spent = Number(data?.currentSpend ?? 0);
  const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const ended = data?.endsAt && new Date(data.endsAt) < new Date();
  const isLive = !!data?.isActive && !ended;

  return (
    <Drawer
      open={!!campaignId}
      onClose={onClose}
      title={data?.name ?? t("loading")}
      subtitle={data?.description ?? undefined}
      width={640}
      headerExtra={
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isLive ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F1F5F9] text-[#475569]"
          }`}
        >
          {isLive ? t("active") : t("expired")}
        </span>
      }
    >
      {/* Tab strip */}
      <div className={`flex items-center gap-1 px-5 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]`}>
        {(["overview", "codes"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
              tab === k
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : !data ? (
        <p className="text-center py-12 text-sm text-[var(--color-text-secondary)]">{t("notFound")}</p>
      ) : tab === "overview" ? (
        <div className="p-5 space-y-4">
          {/* Big budget card */}
          <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold">
                  {t("totalSpent")}
                </p>
                <p className="text-3xl font-bold text-[var(--color-text-primary)]">
                  <Money amount={spent} decimals={2} />
                </p>
              </div>
            </div>
            {budget && (
              <>
                <div className="h-2.5 bg-[var(--color-surface-card)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${pct >= 90 ? "bg-[#DC2626]" : pct >= 70 ? "bg-[#D97706]" : "bg-[var(--color-primary)]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                  {pct}% {t("ofBudget")} <Money amount={budget} decimals={0} />
                </p>
              </>
            )}
          </div>

          {/* Grid of facts */}
          <div className="grid grid-cols-2 gap-3">
            <FactCard icon={Calendar} label={t("period")}>
              {fmtDate(data.startsAt, locale)}
              <br />→ {fmtDate(data.endsAt, locale)}
            </FactCard>
            <FactCard icon={Tag} label={t("codeCount")}>
              {data.codes?.length ?? 0}
            </FactCard>
          </div>

          {data.showOnSite && (
            <div className="p-3 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-start gap-3">
              <ToggleRight className="w-4 h-4 text-[#6D28D9] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[#6D28D9]">{t("bannerActive")}</p>
                {data.bannerCta && (
                  <p className="text-[11px] text-[#6D28D9]/80 mt-0.5">CTA: {data.bannerCta}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5">
          {data.codes && data.codes.length > 0 ? (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">{t("cols.code")}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">{t("cols.value")}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] uppercase font-semibold">{t("cols.uses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.codes.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onOpenCoupon(c.id)}
                      className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] cursor-pointer"
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-[12px] text-[var(--color-text-primary)]">
                        {c.code}
                      </td>
                      <td className="px-3 py-2.5 text-[12px]">
                        {c.type === "percentage" ? `${Number(c.value)}%` : <Money amount={Number(c.value)} decimals={0} />}
                      </td>
                      <td className="px-3 py-2.5 text-[12px]">{c.currentUses}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-[var(--color-text-secondary)]">{t("noCodes")}</p>
          )}
        </div>
      )}
    </Drawer>
  );
};

const FactCard = ({
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
    <div className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{children}</div>
  </div>
);

export default CampaignDetailDrawer;
