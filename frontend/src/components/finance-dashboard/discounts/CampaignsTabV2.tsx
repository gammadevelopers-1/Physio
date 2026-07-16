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
} from "lucide-react";
import { toast } from "sonner";
import { discountApi } from "@/lib/api";
import Money from "../shared/Money";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmDialog from "../shared/ConfirmDialog";

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
  /** Set when the campaign was auto-created by a bulk-generate batch.
   * Surfaces a "Bulk batch" pill on the card so finance can tell them
   * apart from manual campaigns. */
  bulkBatchId?: string | null;
  codeCount: number;
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, { day: "2-digit", month: "short", year: "numeric" });
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
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  const requestDeactivate = (c: Campaign) => {
    setConfirmDeleteId(c.id);
    setOpenMenuId(null);
  };

  const performDeactivate = async () => {
    if (!confirmDeleteId) return;
    setActioning(true);
    try {
      await discountApi.deleteCampaign(confirmDeleteId);
      toast.success(t("toasts.deactivated"));
      setConfirmDeleteId(null);
      await fetchData();
    } catch {
      toast.error(t("toasts.deactivateError"));
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

          <div className={`flex-1 flex justify-end ${isRTL ? "justify-start" : ""}`}>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((c) => {
            const budget = c.budget ? Number(c.budget) : null;
            const spent = Number(c.currentSpend ?? 0);
            const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const now = new Date();
            const ended = c.endsAt && new Date(c.endsAt) < now;
            const isLive = c.isActive && !ended;

            return (
              <div
                key={c.id}
                onClick={() => onOpenCampaign(c.id)}
                className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] hover:shadow-md transition-shadow cursor-pointer relative"
              >
                {/* Header strip */}
                <div className="px-5 py-4 rounded-t-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {c.name}
                        </h3>
                        {c.bulkBatchId && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] uppercase tracking-wide flex-shrink-0">
                            {tShared("campaignsV2.autoBulkTag")}
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </div>
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
                          {c.isActive && (
                            <button
                              type="button"
                              onClick={() => requestDeactivate(c)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#B91C1C] hover:bg-[#FEE2E2] text-start"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t("actions.deactivate")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  {/* Period */}
                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{fmtDate(c.startsAt, locale)} → {fmtDate(c.endsAt, locale)}</span>
                  </div>

                  {/* Budget bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[var(--color-text-secondary)]">{t("budget")}</span>
                      {budget ? (
                        <span className="text-[var(--color-text-primary)] font-medium">
                          <Money amount={spent} decimals={0} /> / <Money amount={budget} decimals={0} />
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">{t("unlimited")}</span>
                      )}
                    </div>
                    {budget !== null && (
                      <div className="h-2 bg-[var(--color-surface-page)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? "bg-[#DC2626]" : pct >= 70 ? "bg-[#D97706]" : "bg-[var(--color-primary)]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-[12px] pt-2 border-t border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-secondary)]">
                      <span className="font-semibold text-[var(--color-text-primary)]">{c.codeCount}</span> {t("codes")}
                    </span>
                    {c.showOnSite && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#6D28D9] flex items-center gap-1">
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
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await fetchData();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title={tShared("confirms.deactivateCampaignTitle")}
        message={tShared("confirms.deactivateCampaignBody")}
        confirmLabel={tShared("confirms.deactivateCampaignBtn")}
        danger
        loading={actioning}
        onConfirm={performDeactivate}
        onClose={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

// ─── Inline campaign form modal ──────────────────────────────────────

const CampaignFormModal = ({
  editing,
  onClose,
  onSaved,
}: {
  editing: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useTranslations("financeDashboard.discountsPage.campaignsV2.form");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [startsAt, setStartsAt] = useState(editing?.startsAt ? editing.startsAt.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState(editing?.endsAt ? editing.endsAt.slice(0, 10) : "");
  const [budget, setBudget] = useState(editing?.budget ?? "");
  const [showOnSite, setShowOnSite] = useState(editing?.showOnSite ?? false);
  const [bannerCta, setBannerCta] = useState(editing?.bannerCta ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: {
        name: string;
        description?: string;
        startsAt?: string;
        endsAt?: string;
        budget?: number;
        showOnSite: boolean;
        bannerCta?: string;
      } = {
        name: name.trim(),
        description: description?.trim() || undefined,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        budget: budget ? Number(budget) : undefined,
        showOnSite,
        bannerCta: bannerCta?.trim() || undefined,
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
      <div className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {editing ? t("editTitle") : t("createTitle")}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("description")}</label>
            <textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
            />
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
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("bannerCta")}</label>
              <input
                type="text"
                value={bannerCta ?? ""}
                onChange={(e) => setBannerCta(e.target.value)}
                placeholder={t("bannerCtaPlaceholder")}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
              />
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
