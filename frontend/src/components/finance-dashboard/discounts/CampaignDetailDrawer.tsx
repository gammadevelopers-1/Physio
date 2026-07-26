"use client";

/**
 * Campaign detail drawer — opens from CampaignsTabV2 cards.
 *
 * Type-aware overview:
 *   • Header pill for campaign type (Standard / Early Bird)
 *   • Big redeemed/budget hero
 *   • Direct-discount block (only if the campaign owns a discount) — shows
 *     value, scope, coupon-stacking policy
 *   • Codes block (only if any codes attached)
 *   • Banner block with a WORKING toggle (PATCH showOnSite) + inline CTA
 *   • Period + bulk-batch tag
 *
 * Codes tab lists the child coupon codes.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Megaphone,
  Tag,
  Calendar,
  Loader2,
  Percent,
  Sparkles,
  Layers,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import Drawer from "../shared/Drawer";
import Money from "../shared/Money";
import { discountApi } from "@/lib/api";
import { getScopeLabel, pickCampaignText, type CampaignScope, type CampaignType, type CampaignDiscountType } from "./CampaignsTabV2";

interface Campaign {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  startsAt: string | null;
  endsAt: string | null;
  budget: string | null;
  currentSpend: string;
  isActive: boolean;
  showOnSite: boolean;
  bannerCta: string | null;
  bannerCtaAr: string | null;
  bulkBatchId?: string | null;
  campaignType?: CampaignType;
  discountType?: CampaignDiscountType;
  discountValue?: string | number | null;
  scope?: CampaignScope;
  scopeDeliveryTypes?: string[];
  scopeCourseIds?: string[];
  allowsCoupon?: boolean;
  codeCount?: number;
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
  /** Called after a drawer-side mutation (banner toggle, CTA edit) so the
   * parent card list can refresh. Optional — the drawer works standalone. */
  onChanged?: () => void;
}

function fmtDate(iso: string | null, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, { day: "2-digit", month: "short", year: "numeric" });
}

const CampaignDetailDrawer = ({ campaignId, onClose, onOpenCoupon, onChanged }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.campaignsV2.drawer");
  const tCard = useTranslations("financeDashboard.discountsPage.campaignsV2");
  const tShared = useTranslations("financeDashboard.discountsPage");
  const locale = useLocale();

  const [tab, setTab] = useState<"overview" | "codes">("overview");
  const [data, setData] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [ctaDraft, setCtaDraft] = useState("");
  const [ctaArDraft, setCtaArDraft] = useState("");
  const [savingCta, setSavingCta] = useState(false);

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = (await discountApi.getCampaign(campaignId)) as Campaign;
      setData(res);
      setCtaDraft(res.bannerCta ?? "");
      setCtaArDraft(res.bannerCtaAr ?? "");
    } catch {
      setData(null);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setTab("overview");
    refetch().finally(() => setLoading(false));
  }, [campaignId, refetch]);

  if (!campaignId) return null;

  const budget = data?.budget ? Number(data.budget) : null;
  const spent = Number(data?.currentSpend ?? 0);
  const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const ended = data?.endsAt && new Date(data.endsAt) < new Date();
  const isLive = !!data?.isActive && !ended;

  const isEarlyBird = data?.campaignType === "early_bird";
  const hasDirectDiscount = data?.discountType && data.discountType !== "none";
  const codeCount = data?.codeCount ?? data?.codes?.length ?? 0;

  const toggleBanner = async () => {
    if (!data || bannerBusy) return;
    setBannerBusy(true);
    const next = !data.showOnSite;
    try {
      await discountApi.updateCampaign(data.id, { showOnSite: next });
      toast.success(next ? t("bannerToasts.on") : t("bannerToasts.off"));
      await refetch();
      onChanged?.();
    } catch {
      toast.error(t("bannerToasts.error"));
    } finally {
      setBannerBusy(false);
    }
  };

  const saveCta = async () => {
    if (!data || savingCta) return;
    const trimmed = ctaDraft.trim();
    const trimmedAr = ctaArDraft.trim();
    // Nothing to save if neither field changed.
    if (
      (data.bannerCta ?? "") === trimmed &&
      (data.bannerCtaAr ?? "") === trimmedAr
    ) {
      return;
    }
    setSavingCta(true);
    try {
      await discountApi.updateCampaign(data.id, {
        bannerCta: trimmed || null,
        bannerCtaAr: trimmedAr || null,
      });
      toast.success(t("bannerToasts.ctaSaved"));
      await refetch();
      onChanged?.();
    } catch {
      toast.error(t("bannerToasts.error"));
    } finally {
      setSavingCta(false);
    }
  };

  const TypeIcon = isEarlyBird ? Sparkles : Megaphone;
  const typeAccent = isEarlyBird
    ? "bg-[#FEF3C7] text-[#B45309] ring-[#F59E0B]/30"
    : "bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-[var(--color-primary)]/25";

  // Locale-aware header text for the drawer. Finance sees both locales in
  // the body (see below) so this just picks the primary one for the title.
  const localized = data ? pickCampaignText(data, locale) : null;

  return (
    <Drawer
      open={!!campaignId}
      onClose={onClose}
      title={localized?.name ?? t("loading")}
      subtitle={localized?.description ?? undefined}
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
      <div className="flex items-center gap-1 px-5 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
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
            {k === "codes" && codeCount > 0 && (
              <span className="ms-1 text-[10px] opacity-70">({codeCount})</span>
            )}
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
          {/* Type + bulk tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold ${typeAccent}`}>
              <TypeIcon className="w-3.5 h-3.5" />
              {tCard(isEarlyBird ? "typePill.earlyBird" : "typePill.standard")}
            </span>
            {data.bulkBatchId && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] uppercase tracking-wide">
                {tShared("campaignsV2.autoBulkTag")}
              </span>
            )}
          </div>

          {/* Bilingual review block — always shows both locales side by
              side so finance can spot-check the Arabic even from the /en
              dashboard (and vice versa). Missing translations render as a
              muted placeholder so nothing quietly ships as EN-only. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]/50 p-3">
            <div dir="ltr">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-0.5">
                {tShared("campaignsV2.drawer.bilingualEn")}
              </p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
                {data.name}
              </p>
              {data.description && (
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 whitespace-pre-line">
                  {data.description}
                </p>
              )}
            </div>
            <div dir="rtl">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-0.5">
                {tShared("campaignsV2.drawer.bilingualAr")}
              </p>
              {data.nameAr ? (
                <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
                  {data.nameAr}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--color-text-secondary)]">
                  {tShared("campaignsV2.drawer.bilingualMissing")}
                </p>
              )}
              {data.descriptionAr && (
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 whitespace-pre-line">
                  {data.descriptionAr}
                </p>
              )}
            </div>
          </div>

          {/* Big redeemed / budget hero */}
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
            {budget ? (
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
            ) : (
              <p className="text-[11px] text-[var(--color-text-secondary)]">{t("unlimitedBudget")}</p>
            )}
          </div>

          {/* Direct discount block — only when the campaign owns a discount */}
          {hasDirectDiscount && (
            <div className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                    <Percent className="w-4 h-4 text-[#166534]" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#166534] font-semibold">
                      {t("directDiscount")}
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)] leading-none mt-0.5">
                      {data.discountType === "percentage"
                        ? `${data.discountValue}%`
                        : <><Money amount={Number(data.discountValue)} decimals={0} /></>}
                      <span className="text-[11px] font-semibold uppercase text-[var(--color-text-secondary)] tracking-wide ms-1.5">
                        {tCard("offPill")}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-[12px] text-[var(--color-text-primary)] leading-relaxed">
                <span className="font-medium">{t("scopeLabel")}:</span>{" "}
                {getScopeLabel(
                  {
                    scope: data.scope,
                    scopeDeliveryTypes: data.scopeDeliveryTypes,
                    scopeCourseIds: data.scopeCourseIds,
                    codeCount,
                  },
                  tCard,
                  tShared,
                )}
              </div>
              {data.scope === "by_delivery_type" && (data.scopeDeliveryTypes ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.scopeDeliveryTypes!.map((dt) => (
                    <span
                      key={dt}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#DCFCE7] text-[#166534]"
                    >
                      {tShared(`campaignsV2.form.deliveryTypes.${dt}` as Parameters<typeof tShared>[0])}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2 pt-1 border-t border-[#DCFCE7]">
                <div className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 mt-0.5 flex items-center justify-center ${data.allowsCoupon ? "bg-[#166534]" : "bg-[var(--color-surface-page)] border border-[var(--color-border)]"}`}>
                  {data.allowsCoupon && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[var(--color-text-primary)]">
                    {data.allowsCoupon ? t("couponStackOn") : t("couponStackOff")}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {data.allowsCoupon ? t("couponStackOnHint") : t("couponStackOffHint")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Codes summary block — only when codes exist */}
          {codeCount > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-page)] flex items-center justify-center">
                <Tag className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                  {t("codesAttached", { n: codeCount })}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {t("codesAttachedHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("codes")}
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
              >
                {t("viewCodes")}
              </button>
            </div>
          )}

          {/* No-discount / no-codes empty state */}
          {!hasDirectDiscount && codeCount === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 flex items-start gap-3">
              <Layers className="w-4 h-4 text-[var(--color-text-secondary)] mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                  {t("emptyDiscount")}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {t("emptyDiscountHint")}
                </p>
              </div>
            </div>
          )}

          {/* Period card */}
          <div className="grid grid-cols-2 gap-3">
            <FactCard icon={Calendar} label={t("period")}>
              {fmtDate(data.startsAt, locale)}
              <br />→ {fmtDate(data.endsAt, locale)}
            </FactCard>
            <FactCard icon={Tag} label={t("codeCount")}>
              {codeCount}
            </FactCard>
          </div>

          {/* Banner block with WORKING toggle */}
          <div className={`rounded-2xl border p-4 space-y-3 ${data.showOnSite ? "bg-[#EDE9FE] border-[#DDD6FE]" : "bg-[var(--color-surface-card)] border-[var(--color-border)]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${data.showOnSite ? "bg-[#DDD6FE]" : "bg-[var(--color-surface-page)]"}`}>
                  <Megaphone className={`w-4 h-4 ${data.showOnSite ? "text-[#6D28D9]" : "text-[var(--color-text-secondary)]"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[12px] font-semibold ${data.showOnSite ? "text-[#6D28D9]" : "text-[var(--color-text-primary)]"}`}>
                    {data.showOnSite ? t("bannerActive") : t("bannerInactive")}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {data.showOnSite ? t("bannerActiveHint") : t("bannerInactiveHint")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleBanner}
                disabled={bannerBusy}
                aria-label={data.showOnSite ? t("bannerTurnOff") : t("bannerTurnOn")}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${data.showOnSite ? "bg-[#6D28D9]" : "bg-[var(--color-border)]"} ${bannerBusy ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${data.showOnSite ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            {data.showOnSite && (
              <div className="pt-2 border-t border-[#DDD6FE] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6D28D9] mb-1">
                      {t("bannerCtaEn")}
                    </label>
                    <input
                      type="text"
                      value={ctaDraft}
                      onChange={(e) => setCtaDraft(e.target.value)}
                      placeholder={t("bannerCtaPlaceholder")}
                      className="w-full px-3 py-1.5 text-[12px] border border-[#DDD6FE] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6D28D9] mb-1">
                      {t("bannerCtaArLabel")}
                    </label>
                    <input
                      type="text"
                      value={ctaArDraft}
                      onChange={(e) => setCtaArDraft(e.target.value)}
                      placeholder={t("bannerCtaArPlaceholder")}
                      className="w-full px-3 py-1.5 text-[12px] border border-[#DDD6FE] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveCta}
                    disabled={
                      savingCta ||
                      ((data.bannerCta ?? "") === ctaDraft.trim() &&
                        (data.bannerCtaAr ?? "") === ctaArDraft.trim())
                    }
                    className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#6D28D9] rounded-lg disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    {savingCta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t("bannerSaveCta")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5">
          {data.codes && data.codes.length > 0 ? (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2.5 text-start text-[11px] uppercase font-semibold">{t("cols.code")}</th>
                    <th className="px-3 py-2.5 text-start text-[11px] uppercase font-semibold">{t("cols.value")}</th>
                    <th className="px-3 py-2.5 text-start text-[11px] uppercase font-semibold">{t("cols.uses")}</th>
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
