"use client";

/**
 * Admin redemptions table.
 *
 * Polished layout: avatar-initials block for the user column, colored
 * status chip, relative timestamp, plus a "View coupon" quick-link when
 * the fulfillment payload includes a discount code (deep-links to the
 * finance discounts page with the coupon pre-opened).
 *
 * Phase 2: `other`-type rewards now route the fulfill button through a
 * dedicated modal so the admin can attach an artifact (code / link /
 * note) plus an optional private note. Already-fulfilled `other` rows
 * open the same modal in read-only mode from the "View artifact" button.
 * Non-Other reward types keep the simple one-click fulfill flow.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import Select from "../Select";
import { pointsAdminApi, type AdminRedemptionRow } from "@/lib/api";

const STATUS_OPTIONS = ["", "pending", "fulfilled", "failed", "reversed"] as const;

type ArtifactKind = "code" | "link" | "note";

interface FulfillModalState {
  row: AdminRedemptionRow;
  mode: "fulfill" | "view";
}

export default function RewardsRedemptions() {
  const t = useTranslations("adminDashboard.points.rewards");
  const locale = useLocale();
  const [rows, setRows] = useState<AdminRedemptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fulfillModal, setFulfillModal] = useState<FulfillModalState | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await pointsAdminApi.listRedemptions({
        page,
        limit: 25,
        status: statusFilter || undefined,
      });
      setRows(res.rows);
      setTotal(res.pagination.total);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Simple one-click fulfill for non-Other reward types.
  const simpleFulfill = async (id: string) => {
    try {
      await pointsAdminApi.transitionRedemption(id, { status: "fulfilled" });
      toast.success(t("toasts.fulfilled"));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const reverse = async (id: string) => {
    const reason = window.prompt(t("reversalReasonPrompt") || "Reason?");
    if (!reason) return;
    try {
      await pointsAdminApi.transitionRedemption(id, {
        status: "reversed",
        reason,
      });
      toast.success(t("toasts.reversed"));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  const statusSelectOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((s) => ({
        value: s,
        label: s ? t(`statuses.${s}`) : t("filters.allStatuses"),
      })),
    [t],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="w-48">
          <Select
            options={statusSelectOptions}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            placeholder={t("filters.allStatuses")}
            size="sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--color-border)] rounded-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
            <Clock className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {t("noRedemptions")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 lg:mx-0">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs uppercase text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3">{t("redemptionCols.user")}</th>
                <th className="text-left py-2 px-3">{t("redemptionCols.reward")}</th>
                <th className="text-right py-2 px-3">{t("redemptionCols.points")}</th>
                <th className="text-center py-2 px-3">{t("redemptionCols.status")}</th>
                <th className="text-left py-2 px-3">{t("redemptionCols.when")}</th>
                <th className="text-right py-2 px-3">{t("redemptionCols.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const couponId = (r.fulfillmentPayload?.discountCodeId as string) || null;
                const couponCode = (r.fulfillmentPayload?.discountCode as string) || null;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)]">
                          {initials(r.userFirstName, r.userLastName, r.userEmail)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[var(--color-text-primary)] truncate">
                            {r.userFirstName || r.userLastName
                              ? `${r.userFirstName ?? ""} ${r.userLastName ?? ""}`.trim()
                              : r.userEmail}
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)] truncate">
                            {r.userEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{r.rewardName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t(`types.${r.rewardType}`)}
                        </span>
                        {couponCode && (
                          <span className="text-xs font-mono text-[var(--color-text-primary)] px-1.5 py-0.5 rounded bg-[var(--color-border-subtle)]">
                            {couponCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {r.pointsSpent}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusChip status={r.status} labels={t} />
                      {r.failureReason && (
                        <div className="text-xs text-[#DC2626] mt-0.5">{r.failureReason}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)] whitespace-nowrap text-xs">
                      <div>{relativeTime(r.redeemedAt, locale)}</div>
                      <div className="text-[10px] opacity-70">
                        {new Date(r.redeemedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        {couponId && (
                          <a
                            href={`/dashboard/finance/discounts?couponId=${couponId}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                            title={t("viewCoupon")}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {t("viewCoupon")}
                          </a>
                        )}
                        {r.status === "pending" && r.rewardType === "other" && (
                          <button
                            onClick={() =>
                              setFulfillModal({ row: r, mode: "fulfill" })
                            }
                            className="px-2 py-1 text-xs rounded bg-[#DCFCE7] text-[#16A34A] hover:opacity-80"
                          >
                            {t("markFulfilled")}
                          </button>
                        )}
                        {r.status === "pending" && r.rewardType !== "other" && (
                          <button
                            onClick={() => simpleFulfill(r.id)}
                            className="px-2 py-1 text-xs rounded bg-[#DCFCE7] text-[#16A34A] hover:opacity-80"
                          >
                            {t("markFulfilled")}
                          </button>
                        )}
                        {r.status === "fulfilled" &&
                          r.rewardType === "other" &&
                          r.fulfillmentArtifact && (
                            <button
                              onClick={() =>
                                setFulfillModal({ row: r, mode: "view" })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                            >
                              <FileText className="w-3 h-3" />
                              {t("other.fulfill.viewArtifactButton")}
                            </button>
                          )}
                        {(r.status === "pending" || r.status === "fulfilled") && (
                          <button
                            onClick={() => reverse(r.id)}
                            className="px-2 py-1 text-xs rounded bg-[#FEF3C7] text-[#92400E] hover:opacity-80"
                          >
                            {t("reverse")}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50"
          >
            {t("prev")}
          </button>
          <span>{t("pageOf", { page, total: totalPages })}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50"
          >
            {t("next")}
          </button>
        </div>
      )}

      {fulfillModal && (
        <FulfillOtherModal
          row={fulfillModal.row}
          mode={fulfillModal.mode}
          onClose={() => setFulfillModal(null)}
          onFulfilled={async () => {
            setFulfillModal(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ─── FulfillOtherModal ────────────────────────────────────────
//
// Same component drives both flows:
//   - mode === "fulfill"  → editable form, submits POST /transition with
//                            {status: 'fulfilled', artifact, adminNote}
//   - mode === "view"     → same fields, disabled, no submit button
// Reusing one component instead of two keeps the artifact-shape rules
// (kind / value / note) in a single place.

function FulfillOtherModal({
  row,
  mode,
  onClose,
  onFulfilled,
}: {
  row: AdminRedemptionRow;
  mode: "fulfill" | "view";
  onClose: () => void;
  onFulfilled: () => Promise<void>;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const readOnly = mode === "view";
  const existing = row.fulfillmentArtifact;
  const initialKind: ArtifactKind =
    (existing?.kind as ArtifactKind | undefined) ?? "code";
  const initialValue = existing?.value ?? "";
  const initialNote =
    (existing?.meta && typeof existing.meta.note === "string"
      ? (existing.meta.note as string)
      : "") ?? "";

  const [kind, setKind] = useState<ArtifactKind>(initialKind);
  const [value, setValue] = useState(initialValue);
  const [adminNote, setAdminNote] = useState(initialNote);
  const [submitting, setSubmitting] = useState(false);

  const kindOptions = useMemo(
    () => [
      { value: "code", label: t("other.fulfill.kindCode") },
      { value: "link", label: t("other.fulfill.kindLink") },
      { value: "note", label: t("other.fulfill.kindNote") },
    ],
    [t],
  );

  const placeholder = useMemo(() => {
    if (kind === "code") return t("other.fulfill.valuePlaceholderCode");
    if (kind === "link") return t("other.fulfill.valuePlaceholderLink");
    return t("other.fulfill.valuePlaceholderNote");
  }, [kind, t]);

  const submit = async () => {
    if (!value.trim()) {
      toast.error(t("other.fulfill.valueRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await pointsAdminApi.transitionRedemption(row.id, {
        status: "fulfilled",
        artifact: { kind, value: value.trim() },
        adminNote: adminNote.trim() || undefined,
      });
      toast.success(t("toasts.fulfilled"));
      await onFulfilled();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">
              {readOnly
                ? t("other.fulfill.viewModalTitle")
                : t("other.fulfill.modalTitle")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {row.rewardName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-border-subtle)] rounded"
            aria-label={t("other.fulfill.closeButton")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("other.fulfill.kindLabel")}
            </label>
            <Select
              options={kindOptions}
              value={kind}
              onChange={(v) => setKind(v as ArtifactKind)}
              placeholder={t("other.fulfill.kindLabel")}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("other.fulfill.valueLabel")}
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={readOnly}
              rows={kind === "note" ? 4 : 2}
              className="w-full border border-[var(--color-input-border)] rounded px-3 py-1.5 text-sm bg-white resize-none disabled:bg-[var(--color-surface-page)] disabled:text-[var(--color-text-secondary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("other.fulfill.adminNoteLabel")}
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={t("other.fulfill.adminNoteHelper")}
              disabled={readOnly}
              rows={2}
              className="w-full border border-[var(--color-input-border)] rounded px-3 py-1.5 text-sm bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] resize-none disabled:opacity-80"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {t("other.fulfill.adminNoteHelper")}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
          >
            {readOnly ? t("other.fulfill.closeButton") : t("cancel")}
          </button>
          {!readOnly && (
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("other.fulfill.submitButton")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  status,
  labels,
}: {
  status: "pending" | "fulfilled" | "failed" | "reversed";
  labels: (key: string) => string;
}) {
  const map = {
    pending: { cls: "bg-[#FEF3C7] text-[#92400E]", Icon: Clock },
    fulfilled: { cls: "bg-[#DCFCE7] text-[#16A34A]", Icon: CheckCircle2 },
    failed: { cls: "bg-[#FEE2E2] text-[#DC2626]", Icon: XCircle },
    reversed: {
      cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
      Icon: RotateCcw,
    },
  } as const;
  const conf = map[status];
  const Icon = conf.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${conf.cls}`}
    >
      <Icon className="w-3 h-3" />
      {labels(`statuses.${status}`)}
    </span>
  );
}

function initials(
  first: string | null,
  last: string | null,
  email: string,
): string {
  const seed = `${first ?? ""} ${last ?? ""}`.trim() || email;
  const parts = seed.split(/\s+/).filter(Boolean);
  const chars =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : seed.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Cheap relative-time formatter — Intl.RelativeTimeFormat is available
 * in every browser we support and doesn't need a dep. Falls back to a
 * locale date string once the delta exceeds 30 days.
 */
function relativeTime(iso: string, locale: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((d - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 30 * 86400) return rtf.format(Math.round(diffSec / 86400), "day");
  return new Date(iso).toLocaleDateString(locale);
}
