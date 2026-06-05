"use client";

import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Loader2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";

type Tag = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  usageCount: number;
  createdAt: string;
};

// Curated palette for the color picker. Admins can still type any hex,
// but most will pick from this list — keeps the chip palette coherent.
const PRESET_COLORS = [
  "#FEE2E2",
  "#FED7AA",
  "#FEF3C7",
  "#D1FAE5",
  "#CFFAFE",
  "#DBEAFE",
  "#EDE9FE",
  "#FCE7F3",
  "#E5E7EB",
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

export default function TagsManagerPanel() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [creating, setCreating] = useState(false);

  // form state shared by create + edit dialogs
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    try {
      const list = await supportApi.listTicketTags();
      setTags(list);
    } catch {
      setTags([]);
    }
  }

  useEffect(() => {
    reload();
  }, []);

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
      toast.error("Name is required");
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
        toast.success("Tag updated");
      } else {
        await supportApi.createTicketTag({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        });
        toast.success("Tag created");
      }
      await reload();
      closeDialog();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(tag: Tag) {
    const message =
      tag.usageCount > 0
        ? `Delete "${tag.name}"? ${tag.usageCount} ticket(s) currently use it — they'll lose this tag.`
        : `Delete "${tag.name}"?`;
    if (!window.confirm(message)) return;
    try {
      await supportApi.deleteTicketTag(tag.id);
      toast.success("Tag deleted");
      await reload();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Ticket Tags
          </h3>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e]"
        >
          <Plus className="w-3.5 h-3.5" />
          New tag
        </button>
      </div>

      {tags === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
          No tags yet. Create one to start tagging tickets.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)]"
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
                <span className="text-[10px] text-[var(--color-text-secondary)] ml-auto">
                  {tag.usageCount} ticket{tag.usageCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(tag)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] rounded"
                  aria-label="Edit tag"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[#DC2626] rounded"
                  aria-label="Delete tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
              {editing ? "Edit tag" : "New tag"}
            </h4>

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full h-9 px-3 mb-3 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
              placeholder="e.g. Refund"
            />

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${
                    color === c
                      ? "border-[var(--color-primary)]"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-24 h-7 px-2 text-[11px] font-mono border border-[var(--color-input-border)] rounded"
                placeholder="#hex"
              />
            </div>

            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="w-full h-9 px-3 mb-4 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
              placeholder="When to use this tag"
            />

            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full"
                style={{
                  backgroundColor: color,
                  color: textForBg(color),
                }}
              >
                {name || "Preview"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-3 h-9 text-sm rounded-lg border border-[var(--color-border)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 h-9 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e] disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
