"use client";

/**
 * Campaigns tab — card grid (replaces the dense table).
 *
 * Each card shows:
 *   • Name + description
 *   • Period (start → end)
 *   • Budget burn bar (spent/budget %)
 *   • Active codes count
 *   • Banner status pill
 *   • Status pill (active / expired)
 *   • Actions row (Edit, Deactivate, Open detail)
 *
 * Top bar: status filter (active/expired/all), search, Create button.
 *
 * Click anywhere on a card → opens the CampaignDetailDrawer.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  Search,
  Megaphone,
  Calendar,
  Loader2,
  ToggleRight,
  Pencil,
  Trash2,
  MoreVertical,
  ExternalLink,
  X,
  Sparkles,
  Tag,
  Percent,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { discountApi, publicApi } from "@/lib/api";
import Money from "../shared/Money";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmDialog from "../shared/ConfirmDialog";
import Select from "@/components/admin-dashboard/Select";

export type CampaignType = "standard" | "early_bird";
export type CampaignDiscountType = "none" | "percentage" | "fixed";
export type CampaignScope =
  | "code_only"
  | "all_paid"
  | "by_delivery_type"
  | "specific_courses";

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
  /** Set when the campaign was auto-created by a bulk-generate batch.
   * Surfaces a "Bulk batch" pill on the card so finance can tell them
   * apart from manual campaigns. */
  bulkBatchId?: string | null;
  codeCount: number;
  // First-class campaign discount fields (migration 0103)
  campaignType?: CampaignType;
  discountType?: CampaignDiscountType;
  discountValue?: string | number | null;
  scope?: CampaignScope;
  scopeDeliveryTypes?: string[];
  scopeCourseIds?: string[];
  allowsCoupon?: boolean;
}

/** Locale-aware pick for a campaign's public-facing name/description.
 * Falls back to the primary field when the Arabic variant is missing. */
export function pickCampaignText(
  c: { name?: string | null; nameAr?: string | null; description?: string | null; descriptionAr?: string | null },
  locale: string,
): { name: string; description: string | null } {
  const useAr = locale === "ar";
  const name = (useAr && c.nameAr) ? c.nameAr : (c.name ?? "");
  const description = useAr
    ? (c.descriptionAr ?? c.description ?? null)
    : (c.description ?? null);
  return { name, description };
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, { day: "2-digit", month: "short", year: "numeric" });
}

/** Human-readable one-liner describing where a campaign's direct discount
 * applies. Reused on the card and in the drawer. */
export function getScopeLabel(
  c: Pick<Campaign, "scope" | "scopeDeliveryTypes" | "scopeCourseIds" | "codeCount">,
  t: (key: string, params?: Record<string, string | number>) => string,
  tShared: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (c.scope) {
    case "all_paid":
      return t("scopeSummary.allPaid");
    case "by_delivery_type": {
      const types = (c.scopeDeliveryTypes ?? []).map((k) =>
        tShared(`campaignsV2.form.deliveryTypes.${k}`),
      );
      return types.length
        ? t("scopeSummary.byDeliveryType", { list: types.join(" · ") })
        : t("scopeSummary.byDeliveryTypeEmpty");
    }
    case "specific_courses":
      return t("scopeSummary.specificCourses", { n: c.scopeCourseIds?.length ?? 0 });
    case "code_only":
    default:
      return t("scopeSummary.codeOnly", { n: c.codeCount });
  }
}

interface Props {
  onOpenCampaign: (id: string | null) => void;
  refreshKey?: number;
}

const CampaignsTabV2 = ({ onOpenCampaign, refreshKey = 0 }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.campaignsV2");
  const tShared = useTranslations("financeDashboard.discountsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"active" | "expired" | "all">("active");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formPreset, setFormPreset] = useState<Partial<Campaign> | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Campaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [actioning, setActioning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.listCampaigns({ status, search: search || undefined, limit: 50 });
      setRows(res.data as Campaign[]);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const performDeactivate = async () => {
    if (!confirmDeactivate) return;
    setActioning(true);
    try {
      // Deactivate = pause. Uses PATCH, not DELETE. Campaign row stays;
      // the manager can re-enable it later by editing dates or flipping
      // the toggle back on.
      await discountApi.updateCampaign(confirmDeactivate.id, { isActive: false });
      toast.success(t("toasts.deactivated"));
      setConfirmDeactivate(null);
      await fetchData();
    } catch {
      toast.error(t("toasts.deactivateError"));
    } finally {
      setActioning(false);
    }
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setActioning(true);
    try {
      await discountApi.deleteCampaign(confirmDelete.id);
      toast.success(t("toasts.deleted"));
      setConfirmDelete(null);
      await fetchData();
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
        <div className={`flex flex-col lg:flex-row lg:items-center gap-3`}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full ps-9 pe-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5">
            {(["active", "expired", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
                  status === s
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>

          <div className={`flex-1 flex items-center gap-2 justify-end ${isRTL ? "justify-start" : ""}`}>
            {/* Single create action. Early Bird is a Campaign Type toggle
                inside the form — flipping it auto-fills Early Bird defaults
                (7-day window, 15% off, banner on) as long as the user
                hasn't already customized those fields. */}
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormPreset({
                  campaignType: "standard",
                  discountType: "percentage",
                  scope: "all_paid",
                  showOnSite: false,
                  allowsCoupon: false,
                });
                setShowForm(true);
              }}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-95"
            >
              <Plus className="w-4 h-4" />
              {t("create")}
            </button>
          </div>
        </div>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 text-center">
          <Megaphone className="w-12 h-12 mx-auto text-[var(--color-text-secondary)]/40 mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("empty")}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((c) => {
            const budget = c.budget ? Number(c.budget) : null;
            const spent = Number(c.currentSpend ?? 0);
            const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const now = new Date();
            const ended = c.endsAt && new Date(c.endsAt) < now;
            const isLive = c.isActive && !ended;
            const isEarlyBird = c.campaignType === "early_bird";
            const hasDirectDiscount = c.discountType && c.discountType !== "none";

            // Type-specific accent colors.
            const accent = isEarlyBird
              ? { text: "text-[#B45309]", bg: "bg-[#FEF3C7]", strip: "from-[#FEF3C7] to-[#FEF9C3]/40", ring: "ring-[#F59E0B]/30" }
              : { text: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary)]/10", strip: "from-[var(--color-primary)]/12 to-[var(--color-primary)]/5", ring: "ring-[var(--color-primary)]/25" };
            const TypeIcon = isEarlyBird ? Sparkles : Megaphone;
            const scopeLabel = getScopeLabel(c, t, tShared);

            return (
              <div
                key={c.id}
                onClick={() => onOpenCampaign(c.id)}
                className="group bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative flex flex-col min-h-[340px] overflow-hidden"
              >
                {/* Colored type strip */}
                <div className={`h-1.5 bg-gradient-to-r ${accent.strip}`} />

                {/* Header row: type badge + status + kebab */}
                <div className="flex items-center justify-between gap-2 px-4 pt-3">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${accent.bg} ${accent.text} text-[11px] font-semibold ring-1 ${accent.ring}`}>
                    <TypeIcon className="w-3.5 h-3.5" />
                    {t(isEarlyBird ? "typePill.earlyBird" : "typePill.standard")}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                        isLive ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F1F5F9] text-[#475569]"
                      }`}
                    >
                      {isLive ? t("status.active") : t("status.expired")}
                    </span>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)]"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === c.id && (
                        <div className={`absolute z-10 top-full mt-1 ${isRTL ? "start-0" : "end-0"} bg-[var(--color-surface-card)] rounded-lg shadow-xl border border-[var(--color-border)] py-1 min-w-[160px]`}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenCampaign(c.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-page)] text-start"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("actions.open")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-page)] text-start"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t("actions.edit")}
                          </button>
                          {c.isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setConfirmDeactivate(c);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] text-start"
                            >
                              <ToggleRight className="w-3.5 h-3.5" />
                              {t("actions.deactivate")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                setOpenMenuId(null);
                                setActioning(true);
                                try {
                                  await discountApi.updateCampaign(c.id, { isActive: true });
                                  toast.success(t("toasts.activated"));
                                  await fetchData();
                                } catch {
                                  toast.error(t("toasts.activateError"));
                                } finally {
                                  setActioning(false);
                                }
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] text-start"
                            >
                              <ToggleRight className="w-3.5 h-3.5" />
                              {t("actions.activate")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setConfirmDelete(c);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#B91C1C] hover:bg-[#FEE2E2] text-start"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t("actions.delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name + description — locale-aware. Finance sees the
                    Arabic text on the /en dashboard when a translation is
                    provided so they can spot-check both sides at a glance
                    (secondary line below the primary). */}
                <div className="px-4 pt-3 pb-2">
                  {(() => {
                    const pri = pickCampaignText(c, locale);
                    const sec = pickCampaignText(c, locale === "ar" ? "en" : "ar");
                    return (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
                            {pri.name}
                          </h3>
                          {c.bulkBatchId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] uppercase tracking-wide">
                              {tShared("campaignsV2.autoBulkTag")}
                            </span>
                          )}
                        </div>
                        {sec.name && sec.name !== pri.name && (
                          <p
                            className="text-[11px] text-[var(--color-text-secondary)] leading-tight mt-0.5"
                            dir={locale === "ar" ? "ltr" : "rtl"}
                          >
                            {sec.name}
                          </p>
                        )}
                        {pri.description && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-1">
                            {pri.description}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Discount hero — the star of the card */}
                <div className="px-4 pb-3 flex-1 flex flex-col justify-center">
                  {hasDirectDiscount ? (
                    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-surface-page)] to-transparent px-4 py-3">
                      <div className="flex items-baseline gap-1">
                        <Percent className="w-4 h-4 text-[var(--color-primary)] self-center" />
                        <span className="text-2xl font-bold text-[var(--color-text-primary)] leading-none">
                          {c.discountType === "percentage"
                            ? `${c.discountValue}%`
                            : <><Money amount={Number(c.discountValue)} decimals={0} /></>}
                        </span>
                        <span className="text-[11px] font-semibold uppercase text-[var(--color-text-secondary)] tracking-wide">
                          {t("offPill")}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                        {scopeLabel}
                      </p>
                      {c.allowsCoupon && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 italic">
                          {t("cardCouponStack")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                          {t("cardCodeContainer")}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">
                          {t("cardCodeContainerHint", { n: c.codeCount })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer meta strip */}
                <div className="border-t border-[var(--color-border-subtle)] px-4 py-2.5 bg-[var(--color-surface-page)]/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)] min-w-0">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{fmtDate(c.startsAt, locale)} → {fmtDate(c.endsAt, locale)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[var(--color-text-secondary)] flex-shrink-0">
                      <Wallet className="w-3.5 h-3.5" />
                      {budget ? (
                        <span className="text-[var(--color-text-primary)] font-medium">
                          <Money amount={spent} decimals={0} />/<Money amount={budget} decimals={0} />
                        </span>
                      ) : (
                        <span>{t("unlimited")}</span>
                      )}
                    </div>
                  </div>
                  {budget !== null && (
                    <div className="h-1 bg-[var(--color-surface-card)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-[#DC2626]" : pct >= 70 ? "bg-[#D97706]" : "bg-[var(--color-primary)]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span className="font-semibold text-[var(--color-text-primary)]">{c.codeCount}</span> {t("codes")}
                    </span>
                    {c.showOnSite && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] flex items-center gap-1">
                        <ToggleRight className="w-3 h-3" /> {t("banner")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CampaignFormModal
          editing={editing}
          preset={formPreset}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setFormPreset(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            setFormPreset(null);
            await fetchData();
          }}
        />
      )}

      {/* Deactivate = pause (reversible). Uses PATCH isActive=false. */}
      <ConfirmDialog
        open={!!confirmDeactivate}
        title={tShared("confirms.deactivateCampaignTitle")}
        message={tShared("confirms.deactivateCampaignBody")}
        confirmLabel={tShared("confirms.deactivateCampaignBtn")}
        loading={actioning}
        onConfirm={performDeactivate}
        onClose={() => setConfirmDeactivate(null)}
      />

      {/* Delete = permanent. Warns if the campaign already has recorded
          spend (finance visibility) — we do not block, per client ask. */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={tShared("confirms.deleteCampaignTitle")}
        message={
          confirmDelete && Number(confirmDelete.currentSpend) > 0
            ? tShared("confirms.deleteCampaignBodyWithSpend", {
                spend: Number(confirmDelete.currentSpend).toFixed(2),
              })
            : tShared("confirms.deleteCampaignBody")
        }
        confirmLabel={tShared("confirms.deleteCampaignBtn")}
        danger
        loading={actioning}
        onConfirm={performDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
};

// ─── Inline campaign form modal ──────────────────────────────────────

const DELIVERY_TYPE_OPTIONS = ["zoom", "onsite", "blended", "self-paced", "webinar"] as const;

interface CourseOption {
  id: string;
  title: string;
  price: number;
}

const CampaignFormModal = ({
  editing,
  preset,
  onClose,
  onSaved,
}: {
  editing: Campaign | null;
  preset?: Partial<Campaign> | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useTranslations("financeDashboard.discountsPage.campaignsV2.form");
  const initial = editing ?? preset ?? null;
  const [name, setName] = useState(initial?.name ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(initial?.descriptionAr ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? initial.endsAt.slice(0, 10) : "");
  const [budget, setBudget] = useState(initial?.budget ?? "");
  const [showOnSite, setShowOnSite] = useState(initial?.showOnSite ?? false);
  const [bannerCta, setBannerCta] = useState(initial?.bannerCta ?? "");
  const [bannerCtaAr, setBannerCtaAr] = useState(initial?.bannerCtaAr ?? "");

  // First-class campaign discount fields
  const [campaignType, setCampaignType] = useState<CampaignType>(initial?.campaignType ?? "standard");
  const [discountType, setDiscountType] = useState<CampaignDiscountType>(initial?.discountType ?? "none");
  const [discountValue, setDiscountValue] = useState<string>(
    initial?.discountValue !== undefined && initial?.discountValue !== null
      ? String(initial.discountValue)
      : "",
  );
  const [scope, setScope] = useState<CampaignScope>(initial?.scope ?? "code_only");
  const [scopeDeliveryTypes, setScopeDeliveryTypes] = useState<string[]>(
    initial?.scopeDeliveryTypes ?? [],
  );
  const [scopeCourseIds, setScopeCourseIds] = useState<string[]>(initial?.scopeCourseIds ?? []);
  const [allowsCoupon, setAllowsCoupon] = useState(initial?.allowsCoupon ?? false);

  // Course-picker data (lazy-loaded when scope=specific_courses)
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");

  useEffect(() => {
    if (scope !== "specific_courses" || courseOptions.length > 0) return;
    setCoursesLoading(true);
    (async () => {
      try {
        const res = await publicApi.getCourses({ limit: 100 });
        if (res?.data) {
          setCourseOptions(
            (res.data as Array<{ id: string; title?: string; titleEn?: string; price?: number | string }>).map((c) => ({
              id: c.id,
              title: c.title || c.titleEn || "Untitled",
              price: Number(c.price ?? 0),
            })),
          );
        }
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, [scope, courseOptions.length]);

  // If the user switches scope to something that doesn't need scopeCourseIds
  // or scopeDeliveryTypes, clear them so the payload stays clean.
  useEffect(() => {
    if (scope !== "specific_courses") setScopeCourseIds([]);
    if (scope !== "by_delivery_type") setScopeDeliveryTypes([]);
    if (scope === "code_only" && discountType !== "none") setDiscountType("none");
  }, [scope, discountType]);

  const [saving, setSaving] = useState(false);

  const toggleDeliveryType = (dt: string) => {
    setScopeDeliveryTypes((prev) =>
      prev.includes(dt) ? prev.filter((x) => x !== dt) : [...prev, dt],
    );
  };
  const toggleCourseId = (id: string) => {
    setScopeCourseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredCourses = courseOptions.filter((c) =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase()),
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    // Client-side guards — backend re-validates
    if (discountType !== "none") {
      const val = Number(discountValue);
      if (!Number.isFinite(val) || val <= 0) {
        toast.error(t("errors.discountValueRequired"));
        return;
      }
      if (discountType === "percentage" && (val < 1 || val > 100)) {
        toast.error(t("errors.percentRange"));
        return;
      }
    }
    if (scope !== "code_only" && discountType === "none") {
      toast.error(t("errors.scopeNeedsDiscount"));
      return;
    }
    if (scope === "by_delivery_type" && scopeDeliveryTypes.length === 0) {
      toast.error(t("errors.pickDeliveryTypes"));
      return;
    }
    if (scope === "specific_courses" && scopeCourseIds.length === 0) {
      toast.error(t("errors.pickCourses"));
      return;
    }

    // Fixed-amount guard against the cheapest course in scope. Pre-flight
    // check that mirrors the backend rule so we surface a specific error
    // (which course + what price) before hitting the API. Only runs when
    // we have course prices loaded — the specific_courses path always
    // loads them; all_paid / by_delivery_type let the backend enforce
    // because we don't have every course's price on the client.
    if (
      discountType === "fixed" &&
      scope === "specific_courses" &&
      discountValue &&
      courseOptions.length > 0
    ) {
      const val = Number(discountValue);
      const selected = courseOptions.filter(
        (c) => scopeCourseIds.includes(c.id) && c.price > 0,
      );
      const offenders = selected.filter((c) => c.price <= val);
      if (offenders.length > 0) {
        const cheapest = offenders.reduce((a, b) => (a.price < b.price ? a : b));
        toast.error(
          t("errors.fixedTooLargeForCourse", {
            amount: val.toFixed(2),
            title: cheapest.title,
            price: cheapest.price.toFixed(2),
          }),
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr?.trim() || null,
        description: description?.trim() || undefined,
        descriptionAr: descriptionAr?.trim() || null,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        budget: budget ? Number(budget) : undefined,
        showOnSite,
        bannerCta: bannerCta?.trim() || undefined,
        bannerCtaAr: bannerCtaAr?.trim() || null,
        campaignType,
        discountType,
        discountValue:
          discountType === "none" ? null : Number(discountValue),
        scope,
        scopeDeliveryTypes: scope === "by_delivery_type" ? scopeDeliveryTypes : [],
        scopeCourseIds: scope === "specific_courses" ? scopeCourseIds : [],
        allowsCoupon,
      };
      if (editing) {
        await discountApi.updateCampaign(editing.id, payload);
        toast.success(t("editedToast"));
      } else {
        await discountApi.createCampaign(payload);
        toast.success(t("createdToast"));
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (t("saveError") as string));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {editing ? t("editTitle") : t("createTitle")}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Campaign type — Standard vs Early Bird. Early Bird surfaces
              this campaign on the Early Bird tab as well. */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("campaignType")}
            </label>
            <div className="flex gap-2">
              {(["standard", "early_bird"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setCampaignType(v);
                    // When the user flips to Early Bird on a fresh form,
                    // fill in the standard Early Bird conveniences — but
                    // only for fields the user hasn't already touched, so
                    // we never overwrite deliberate input.
                    if (v === "early_bird" && !editing) {
                      if (!discountValue) setDiscountValue("15");
                      if (!startsAt) {
                        setStartsAt(new Date().toISOString().slice(0, 10));
                      }
                      if (!endsAt) {
                        setEndsAt(
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .slice(0, 10),
                        );
                      }
                      setShowOnSite(true);
                    }
                  }}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    campaignType === v
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {t(`campaignTypes.${v}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {t("nameEn")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {t("nameAr")}
              </label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder={t("nameArPlaceholder")}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                dir="rtl"
              />
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {t("nameArHint")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {t("descriptionEn")}
              </label>
              <textarea
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {t("descriptionAr")}
              </label>
              <textarea
                value={descriptionAr ?? ""}
                onChange={(e) => setDescriptionAr(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                dir="rtl"
              />
            </div>
          </div>

          {/* ─── Discount + Scope block ─────────────────────────────── */}
          <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-3 bg-[var(--color-surface-page)]">
            <p className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
              {t("discountSection")}
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)] -mt-2">
              {t("discountSectionHint")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("discountType")}
                </label>
                <Select
                  value={discountType}
                  onChange={(v) => setDiscountType(v as CampaignDiscountType)}
                  options={[
                    { value: "none", label: t("discountTypes.none") },
                    { value: "percentage", label: t("discountTypes.percentage") },
                    { value: "fixed", label: t("discountTypes.fixed") },
                  ]}
                  size="sm"
                />
              </div>
              {discountType !== "none" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {discountType === "percentage" ? t("percentValue") : t("fixedValue")}
                  </label>
                  <input
                    type="number"
                    min={discountType === "percentage" ? 1 : 0}
                    max={discountType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percentage" ? "25" : "50"}
                    className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            {discountType !== "none" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("scope")}
                  </label>
                  <Select
                    value={scope}
                    onChange={(v) => setScope(v as CampaignScope)}
                    options={[
                      { value: "all_paid", label: t("scopes.all_paid") },
                      { value: "by_delivery_type", label: t("scopes.by_delivery_type") },
                      { value: "specific_courses", label: t("scopes.specific_courses") },
                    ]}
                    size="sm"
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t(`scopeHints.${scope}` as Parameters<typeof t>[0])}
                  </p>
                </div>

                {scope === "by_delivery_type" && (
                  <div className="flex flex-wrap gap-1.5">
                    {DELIVERY_TYPE_OPTIONS.map((dt) => {
                      const on = scopeDeliveryTypes.includes(dt);
                      return (
                        <button
                          key={dt}
                          type="button"
                          onClick={() => toggleDeliveryType(dt)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                            on
                              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                              : "bg-white border-[var(--color-border)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          {t(`deliveryTypes.${dt}` as Parameters<typeof t>[0])}
                        </button>
                      );
                    })}
                  </div>
                )}

                {scope === "specific_courses" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder={t("courseSearchPlaceholder")}
                      className="w-full h-8 px-2 border border-[var(--color-border)] rounded-lg text-xs"
                    />
                    {coursesLoading ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-lg bg-white divide-y divide-[var(--color-border-subtle)]">
                        {filteredCourses.length === 0 ? (
                          <p className="p-3 text-xs text-[var(--color-text-secondary)] text-center">
                            {t("noCoursesFound")}
                          </p>
                        ) : (
                          filteredCourses.map((c) => {
                            const isFree = c.price <= 0;
                            const on = scopeCourseIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                disabled={isFree}
                                onClick={() => !isFree && toggleCourseId(c.id)}
                                title={isFree ? t("freeCourseCannotBeAdded") : undefined}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-start ${
                                  isFree
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-[var(--color-surface-page)] cursor-pointer"
                                } ${on ? "bg-[var(--color-primary)]/10" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={isFree}
                                  readOnly
                                  className="w-3.5 h-3.5 accent-[var(--color-primary)]"
                                />
                                <span className="flex-1 truncate text-[var(--color-text-primary)]">
                                  {c.title}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                  {isFree ? t("freeLabel") : `SAR ${c.price}`}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {t("selectedCount", { n: scopeCourseIds.length })}
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={allowsCoupon}
                    onChange={(e) => setAllowsCoupon(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">{t("allowsCoupon")}</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{t("allowsCouponHint")}</p>
                  </div>
                </label>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("startsAt")}</label>
              <DatePicker value={startsAt} onChange={setStartsAt} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("endsAt")}</label>
              <DatePicker value={endsAt} onChange={setEndsAt} min={startsAt || undefined} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("budget")}</label>
            <input
              type="number"
              min="0"
              value={budget ?? ""}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={t("budgetHint")}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnSite}
              onChange={(e) => setShowOnSite(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("showBanner")}</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">{t("showBannerHint")}</p>
            </div>
          </label>
          {showOnSite && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t("bannerCtaEn")}
                </label>
                <input
                  type="text"
                  value={bannerCta ?? ""}
                  onChange={(e) => setBannerCta(e.target.value)}
                  placeholder={t("bannerCtaPlaceholder")}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t("bannerCtaAr")}
                </label>
                <input
                  type="text"
                  value={bannerCtaAr ?? ""}
                  onChange={(e) => setBannerCtaAr(e.target.value)}
                  placeholder={t("bannerCtaArPlaceholder")}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                  dir="rtl"
                />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[var(--color-border)] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignsTabV2;
