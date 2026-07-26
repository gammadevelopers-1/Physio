"use client";

/**
 * Card-grid view of the admin rewards catalog.
 *
 * Renders one card per reward with type badge, status pill, cost/stock
 * meters and quick actions. The old table view was fine for a few rows
 * but stops scaling once managers start bundling multiple courses into
 * a single reward — the grid keeps each row's densely packed info
 * legible.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Pencil,
  Trash2,
  Ticket,
  BookOpen,
  Radio,
  Package,
  Sparkles,
  Power,
  PowerOff,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { pointsAdminApi, type AdminReward, type RewardType } from "@/lib/api";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Props {
  rewards: AdminReward[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (reward: AdminReward) => void;
  onReload: () => Promise<void>;
}

export default function RewardsCatalog({
  rewards,
  loading,
  onCreate,
  onEdit,
  onReload,
}: Props) {
  const t = useTranslations("adminDashboard.points.rewards");
  const [deleteTarget, setDeleteTarget] = useState<AdminReward | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = (r: AdminReward) => {
    setDeleteTarget(r);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await pointsAdminApi.deleteReward(deleteTarget.id);
      toast.success(t("toasts.deleted"));
      await onReload();
      setDeleteTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (r: AdminReward) => {
    try {
      await pointsAdminApi.updateReward(r.id, { isActive: !r.isActive });
      await onReload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  if (rewards.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((r) => (
          <RewardCard
            key={r.id}
            reward={r}
            onEdit={() => onEdit(r)}
            onDelete={() => handleDelete(r)}
            onToggle={() => toggleActive(r)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteTitle")}
        message={t("confirmDelete")}
        confirmLabel={t("deleteConfirmLabel")}
        cancelLabel={t("cancel")}
        loading={deleting}
        danger
        onConfirm={confirmDelete}
        onClose={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}

function RewardCard({
  reward,
  onEdit,
  onDelete,
  onToggle,
}: {
  reward: AdminReward;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const Icon = iconFor(reward.type);
  const stockLabel =
    reward.totalStock === null
      ? t("unlimited")
      : t("stockLeftBadge", {
          n: Math.max(0, reward.totalStock - reward.totalRedeemed),
        });

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4 flex flex-col hover:border-[var(--color-primary)]/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${badgeClasses(reward.type)}`}
          title={t(`types.${reward.type}`)}
        >
          <Icon className="w-4 h-4" strokeWidth={2} />
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            reward.isActive
              ? "bg-[#DCFCE7] text-[#16A34A]"
              : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
          }`}
        >
          {reward.isActive ? t("statuses.active") : t("statuses.inactive")}
        </span>
      </div>

      <div className="flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
          {t(`types.${reward.type}`)}
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
          {reward.nameEn}
        </h3>
        {reward.nameAr && (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5" dir="rtl">
            {reward.nameAr}
          </div>
        )}
        {reward.descriptionEn && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-2 line-clamp-2">
            {reward.descriptionEn}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-semibold">
          <Sparkles className="w-3 h-3" />
          {reward.pointsCost.toLocaleString()} {t("pointsUnit")}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-xs font-medium">
          {stockLabel}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-xs font-medium">
          {t("redeemedCount", { n: reward.totalRedeemed })}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 border-t border-[var(--color-border-subtle)] pt-3 -mx-1">
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded"
          title={reward.isActive ? t("deactivate") : t("activate")}
        >
          {reward.isActive ? (
            <PowerOff className="w-4 h-4" />
          ) : (
            <Power className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded"
          title={t("edit")}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] rounded"
          title={t("delete")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("adminDashboard.points.rewards");
  return (
    <div className="text-center py-16 border-2 border-dashed border-[var(--color-border)] rounded-xl">
      <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-[#B45309]" />
      </div>
      <h3 className="mt-3 text-base font-semibold">{t("empty.title")}</h3>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
        {t("empty.body")}
      </p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90"
      >
        <Plus className="w-4 h-4" />
        {t("empty.cta")}
      </button>
    </div>
  );
}

function iconFor(type: RewardType) {
  switch (type) {
    case "discount_coupon":
    case "fixed_discount_coupon":
      return Ticket;
    case "free_course":
      return BookOpen;
    case "free_webinar":
      return Radio;
    default:
      return Package;
  }
}

function badgeClasses(type: RewardType): string {
  switch (type) {
    case "discount_coupon":
    case "fixed_discount_coupon":
      return "bg-[#DBEAFE] text-[#1E40AF]";
    case "free_course":
      return "bg-[#DCFCE7] text-[#16A34A]";
    case "free_webinar":
      return "bg-[#EDE9FE] text-[#6D28D9]";
    default:
      return "bg-[#FEF3C7] text-[#92400E]";
  }
}
