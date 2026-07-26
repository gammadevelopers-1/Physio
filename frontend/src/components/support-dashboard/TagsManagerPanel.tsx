"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Tag as TagIcon,
  Zap,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  BarChart3,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import TagRulesModal from "./TagRulesModal";
import TagAnalyticsPanel from "./TagAnalyticsPanel";

type Tag = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  archivedAt: string | null;
  usageCount: number;
  ruleCount: number;
  createdAt: string;
};

// Two rows of swatches. The saturated row gives tags that "pop" in a
// dense queue; the soft row keeps the existing pastel palette for
// people who prefer subtle. The previous one-row pastel-only palette
// was almost impossible to tell apart in the picker.
const PRESET_COLORS = [
  // Saturated row — visible at a glance in a long ticket list
  "#DC2626", // red
  "#EA580C", // orange
  "#CA8A04", // amber
  "#16A34A", // green
  "#0891B2", // teal
  "#2563EB", // blue
  "#7C3AED", // violet
  "#DB2777", // pink
  "#475569", // slate
  // Soft row — pastels for low-priority / informational tags
  "#FECACA", // red 200
  "#FED7AA", // orange 200
  "#FEF08A", // yellow 200
  "#BBF7D0", // green 200
  "#A5F3FC", // cyan 200
  "#BFDBFE", // blue 200
  "#DDD6FE", // violet 200
  "#FBCFE8", // pink 200
  "#E5E7EB", // gray 200
];

function textForBg(hex: string): string {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "#111827";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    ? "#1F2937"
    : "#FFFFFF";
}

type Section = "active" | "archived" | "analytics";

// Settings → Tags. Three sections:
//   • Active     — the live taxonomy. Create / edit / archive / delete /
//                  manage auto-apply rules.
//   • Archived   — soft-archived tags. Hidden from the picker + matcher
//                  but assignments preserved. Restore turns them active.
//   • Analytics  — top tags, 30-day trend, per-category breakdown.
//
// Delete is gated by a themed modal that quotes usage count + offers
// Archive as the safer path. Hard delete still cascades, per the
// owner's call.
export default function TagsManagerPanel() {
  const t = useTranslations("supportDashboard.tagsManager");
  const [section, setSection] = useState<Section>("active");
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [creating, setCreating] = useState(false);
  const [rulesFor, setRulesFor] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  // form state shared by create + edit dialogs
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function reload() {
    try {
      const list = await supportApi.listTicketTags({ includeArchived: true });
      setTags(list);
    } catch {
      setTags([]);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const { active, archived } = useMemo(() => {
    const a: Tag[] = [];
    const arch: Tag[] = [];
    for (const t of tags || []) {
      if (t.archivedAt) arch.push(t);
      else a.push(t);
    }
    return { active: a, archived: arch };
  }, [tags]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setName("");
    setColor(PRESET_COLORS[0]);
    setDescription("");
  }

  function openEdit(tag: Tag) {
    setCreating(false);
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color);
    setDescription(tag.description ?? "");
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
  }

  async function save() {
    if (!name.trim()) {
      toast.error(t("toasts.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await supportApi.updateTicketTag(editing.id, {
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        });
        toast.success(t("toasts.tagUpdated"));
      } else {
        await supportApi.createTicketTag({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        });
        toast.success(t("toasts.tagCreated"));
      }
      await reload();
      closeDialog();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function archive(tag: Tag) {
    setBusyTagId(tag.id);
    try {
      await supportApi.archiveTicketTag(tag.id);
      toast.success(t("toasts.tagArchived", { name: tag.name }));
      await reload();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.archiveFailed"));
    } finally {
      setBusyTagId(null);
    }
  }

  async function unarchive(tag: Tag) {
    setBusyTagId(tag.id);
    try {
      await supportApi.unarchiveTicketTag(tag.id);
      toast.success(t("toasts.tagRestored", { name: tag.name }));
      await reload();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.restoreFailed"));
    } finally {
      setBusyTagId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await supportApi.deleteTicketTag(deleting.id);
      toast.success(t("toasts.tagDeleted"));
      await reload();
      setDeleting(null);
    } catch (err: any) {
      toast.error(err?.message || t("toasts.deleteFailed"));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("panelTitle")}
          </h3>
        </div>
        {section !== "analytics" && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e]"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("newTag")}
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--color-border-subtle)]">
        <SubTab
          label={tags ? `${t("tabs.active")} · ${active.length}` : t("tabs.active")}
          active={section === "active"}
          onClick={() => setSection("active")}
        />
        <SubTab
          label={tags ? `${t("tabs.archived")} · ${archived.length}` : t("tabs.archived")}
          active={section === "archived"}
          onClick={() => setSection("archived")}
        />
        <SubTab
          label={t("tabs.analytics")}
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          active={section === "analytics"}
          onClick={() => setSection("analytics")}
        />
      </div>

      {section === "analytics" ? (
        <TagAnalyticsPanel />
      ) : tags === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (section === "active" ? active : archived).length === 0 ? (
        <div className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
          {section === "active" ? t("emptyActive") : t("emptyArchived")}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(section === "active" ? active : archived).map((tag) => (
            <div
              key={tag.id}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                tag.archivedAt
                  ? "border-[var(--color-border-subtle)] opacity-75"
                  : "border-[var(--color-border-subtle)] hover:border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: tag.color,
                    color: textForBg(tag.color),
                  }}
                >
                  {tag.name}
                </span>
                {tag.description && (
                  <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
                    {tag.description}
                  </span>
                )}
                <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto flex items-center gap-2">
                  <span>
                    {t("ticketCount", { count: tag.usageCount })}
                  </span>
                  {tag.ruleCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[#15803D] bg-[#DCFCE7] border border-[#86EFAC] px-1.5 py-0.5 rounded">
                      <Zap className="w-2.5 h-2.5" />
                      {tag.ruleCount}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!tag.archivedAt && (
                  <>
                    <IconButton
                      title={t("autoApplyRules")}
                      onClick={() => setRulesFor(tag)}
                      hover="text-[var(--color-primary)]"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      title={t("actions.edit")}
                      onClick={() => openEdit(tag)}
                      hover="text-[var(--color-primary)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      title={t("actions.archive")}
                      onClick={() => archive(tag)}
                      disabled={busyTagId === tag.id}
                      hover="text-[#F59E0B]"
                    >
                      {busyTagId === tag.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </IconButton>
                  </>
                )}
                {tag.archivedAt && (
                  <IconButton
                    title={t("actions.restore")}
                    onClick={() => unarchive(tag)}
                    disabled={busyTagId === tag.id}
                    hover="text-[var(--color-primary)]"
                  >
                    {busyTagId === tag.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    )}
                  </IconButton>
                )}
                <IconButton
                  title={t("actions.delete")}
                  onClick={() => setDeleting(tag)}
                  hover="text-[#DC2626]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / edit modal ───────────────────────────── */}
      {(creating || editing) && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
              {editing ? t("dialog.editTitle") : t("dialog.newTitle")}
            </h4>

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              {t("dialog.nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full h-9 px-3 mb-3 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
              placeholder={t("dialog.namePlaceholder")}
            />

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1.5">
              {t("dialog.colorLabel")}
            </label>
            <div className="grid grid-cols-9 gap-1.5 mb-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = color.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`relative w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-[var(--color-primary)] scale-110"
                        : "ring-1 ring-inset ring-black/10"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={t("dialog.pickColor", { color: c })}
                    title={c}
                  >
                    {isSelected && (
                      <Check
                        className="w-3.5 h-3.5 absolute inset-0 m-auto"
                        style={{ color: textForBg(c) }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 h-8 px-2 text-[11px] font-mono border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="#hex"
              />
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {t("dialog.hexHint")}
              </span>
            </div>

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              {t("dialog.descriptionLabel")}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="w-full h-9 px-3 mb-4 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
              placeholder={t("dialog.descriptionPlaceholder")}
            />

            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full"
                style={{
                  backgroundColor: color,
                  color: textForBg(color),
                }}
              >
                {name || t("dialog.previewFallback")}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-3 h-9 text-sm rounded-lg border border-[var(--color-border)]"
                >
                  {t("dialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 h-9 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e] disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? t("dialog.save") : t("dialog.create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rules modal ─────────────────────────────────── */}
      {rulesFor && (
        <TagRulesModal
          tagId={rulesFor.id}
          tagName={rulesFor.name}
          tagColor={rulesFor.color}
          onClose={() => {
            setRulesFor(null);
            reload();
          }}
        />
      )}

      {/* ── Delete confirmation ─────────────────────────── */}
      {deleting && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleting(null);
          }}
        >
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t("delete.title", { name: deleting.name })}
              </h4>
            </div>
            <div className="px-5 py-4 text-sm text-[var(--color-text-primary)] space-y-2">
              {deleting.usageCount > 0 ? (
                <>
                  <p>
                    {t.rich("delete.appliedTo", {
                      count: deleting.usageCount,
                      strong: (chunks) => (
                        <span className="font-semibold text-[#DC2626]">{chunks}</span>
                      ),
                    })}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t.rich("delete.considerArchive", {
                      link: (chunks) => (
                        <button
                          type="button"
                          onClick={() => {
                            const target = deleting;
                            setDeleting(null);
                            archive(target);
                          }}
                          className="text-[var(--color-primary)] underline"
                        >
                          {chunks}
                        </button>
                      ),
                    })}
                  </p>
                </>
              ) : (
                <p>{t("delete.safeToRemove")}</p>
              )}
              {deleting.ruleCount > 0 && (
                <p className="text-xs text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded px-2 py-1.5">
                  {t("delete.rulesWarning", { count: deleting.ruleCount })}
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
                className="px-3 h-9 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-50"
              >
                {t("dialog.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteBusy}
                className="px-4 h-9 text-sm bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 inline-flex items-center gap-1"
              >
                {deleteBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t("delete.confirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
  hover,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  hover: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 text-[var(--color-text-secondary)] hover:${hover} rounded disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

