"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Plus,
  X,
  Sparkles,
  Calendar,
  Trash2,
  Edit3,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import Money from "./shared/Money";
import Select from "@/components/admin-dashboard/Select";
import { discountApi } from "@/lib/api";

/**
 * Campaigns tab inside the Finance Discounts page. Self-contained CRUD
 * for `coupon_campaigns`. Lives in its own component so it can be
 * mounted/swapped against the existing Codes tab without growing
 * DiscountsContent further.
 */

type Campaign = Awaited<
  ReturnType<typeof discountApi.listCampaigns>
>["data"][number];

const CampaignsTab = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [statusFilter, setStatusFilter] = useState<"active" | "expired" | "all">("active");
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formShowOnSite, setFormShowOnSite] = useState(false);
  const [formBannerCta, setFormBannerCta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.listCampaigns({
        status: statusFilter,
        limit: 50,
      });
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormStartsAt("");
    setFormEndsAt("");
    setFormBudget("");
    setFormShowOnSite(false);
    setFormBannerCta("");
    setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setFormName(c.name);
    setFormDescription(c.description || "");
    setFormStartsAt(c.startsAt ? c.startsAt.slice(0, 16) : "");
    setFormEndsAt(c.endsAt ? c.endsAt.slice(0, 16) : "");
    setFormBudget(c.budget != null ? String(c.budget) : "");
    setFormShowOnSite(c.showOnSite);
    setFormBannerCta(c.bannerCta || "");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error(t("discountsPage.campaigns.fields.name"));
      return;
    }
    setSubmitting(true);
    try {
      const dto = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        startsAt: formStartsAt || undefined,
        endsAt: formEndsAt || undefined,
        budget: formBudget.trim() ? Number(formBudget) : undefined,
        showOnSite: formShowOnSite,
        bannerCta: formBannerCta.trim() || undefined,
      };
      if (editing) {
        await discountApi.updateCampaign(editing.id, dto);
      } else {
        await discountApi.createCampaign(dto);
      }
      toast.success("Saved");
      setShowForm(false);
      await fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (c: Campaign) => {
    if (!confirm(t("discountsPage.campaigns.deactivateConfirm"))) return;
    try {
      await discountApi.deleteCampaign(c.id);
      toast.success("Deactivated");
      await fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(
          locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB",
          { year: "numeric", month: "short", day: "2-digit" },
        )
      : t("discountsPage.campaigns.noEndDate");

  return (
    <div>
      {/* Header row */}
      <div className={`flex items-center justify-between gap-2 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="w-[180px]">
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            options={[
              { value: "active", label: t("discountsPage.campaigns.activeFilter") },
              { value: "expired", label: t("discountsPage.campaigns.expiredFilter") },
              { value: "all", label: t("discountsPage.campaigns.allFilter") },
            ]}
            size="sm"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("discountsPage.campaigns.newButton")}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-center text-[var(--color-text-secondary)] py-12">
          {t("discountsPage.campaigns.empty")}
        </p>
      ) : (
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.name")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.period")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.budget")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.spent")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.codes")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.showOnSite")}</Th>
                <Th isRTL={isRTL}>{t("discountsPage.campaigns.table.status")}</Th>
                <th className="py-3 px-4 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isActive =
                  c.isActive &&
                  (!c.endsAt || new Date(c.endsAt) >= new Date());
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]"
                  >
                    <td className="py-3 px-4">
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate max-w-[200px]">
                        {c.name}
                      </p>
                      {c.description && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[200px]">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
                      {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)}
                    </td>
                    <td className="py-3 px-4">
                      {c.budget != null ? (
                        <Money
                          amount={Number(c.budget)}
                          iconSize={11}
                          decimals={0}
                          className="text-[12px] text-[var(--color-text-primary)]"
                        />
                      ) : (
                        <span className="text-[12px] text-[var(--color-text-secondary)]">
                          {t("discountsPage.campaigns.unlimitedBudget")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Money
                        amount={Number(c.currentSpend)}
                        iconSize={11}
                        decimals={0}
                        className="text-[12px] text-[var(--color-text-primary)]"
                      />
                    </td>
                    <td className="py-3 px-4 text-[12px] text-[var(--color-text-secondary)]">
                      {c.codeCount}
                    </td>
                    <td className="py-3 px-4">
                      {c.showOnSite ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700">
                          <Sparkles className="w-3 h-3" /> on
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                          off
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isActive
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : "bg-[#F1F5F9] text-[#475569]"
                        }`}
                      >
                        {isActive
                          ? t("discountsPage.campaigns.status.active")
                          : t("discountsPage.campaigns.status.expired")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="p-1 rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {c.isActive && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(c)}
                            className="p-1 rounded-md hover:bg-[#FEE2E2] text-[#DC2626]"
                            title={t("discountsPage.campaigns.deactivateButton")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--color-border-subtle)]">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {editing
                  ? t("discountsPage.campaigns.editTitle")
                  : t("discountsPage.campaigns.createTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label={t("discountsPage.campaigns.fields.name")}>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("discountsPage.campaigns.placeholders.name")}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                />
              </Field>
              <Field label={t("discountsPage.campaigns.fields.description")}>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("discountsPage.campaigns.placeholders.description")}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("discountsPage.campaigns.fields.startsAt")}>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </Field>
                <Field label={t("discountsPage.campaigns.fields.endsAt")}>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </Field>
              </div>
              <Field label={t("discountsPage.campaigns.fields.budget")}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={formShowOnSite}
                  onChange={(e) => setFormShowOnSite(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                {t("discountsPage.campaigns.fields.showOnSite")}
              </label>
              {formShowOnSite && (
                <Field label={t("discountsPage.campaigns.fields.bannerCta")}>
                  <input
                    type="text"
                    value={formBannerCta}
                    onChange={(e) => setFormBannerCta(e.target.value)}
                    placeholder={t("discountsPage.campaigns.placeholders.bannerCta")}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </Field>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-card)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !formName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                {t("discountsPage.campaigns.saveButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Th({
  children,
  isRTL,
}: {
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <th
      scope="col"
      className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${
        isRTL ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export default CampaignsTab;
