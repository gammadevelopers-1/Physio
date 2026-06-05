"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, Loader2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";

type Tag = { id: string; name: string; color: string };

interface Props {
  ticketId: string;
  initialTags: Tag[];
  /** Called after a successful save so the parent can refresh other UI. */
  onChange?: (tags: Tag[]) => void;
  disabled?: boolean;
}

// Render text on top of an arbitrary chip color. We can't rely on the
// admin to pick a contrasting text color, so we derive one from the
// chip's perceived luminance.
function textForBg(hex: string): string {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "#111827";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#1F2937" : "#FFFFFF";
}

export default function TicketTagPanel({
  ticketId,
  initialTags,
  onChange,
  disabled,
}: Props) {
  const [applied, setApplied] = useState<Tag[]>(initialTags);
  const [registry, setRegistry] = useState<Tag[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resync if the parent re-fetches the ticket and feeds new initials.
  useEffect(() => {
    setApplied(initialTags);
  }, [initialTags]);

  // Lazy-load the registry the first time the picker opens. Avoids the
  // GET /tickets/tags hit on every ticket render.
  useEffect(() => {
    if (!open || registry !== null) return;
    supportApi
      .listTicketTags()
      .then((list) =>
        setRegistry(
          list.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        ),
      )
      .catch(() => setRegistry([]));
  }, [open, registry]);

  const appliedIds = useMemo(
    () => new Set(applied.map((t) => t.id)),
    [applied],
  );

  async function toggle(tag: Tag) {
    const next = appliedIds.has(tag.id)
      ? applied.filter((t) => t.id !== tag.id)
      : [...applied, tag];
    setSaving(true);
    try {
      const server = await supportApi.setTicketTags(
        ticketId,
        next.map((t) => t.id),
      );
      setApplied(server);
      onChange?.(server);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {applied.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full"
          style={{
            backgroundColor: tag.color,
            color: textForBg(tag.color),
          }}
        >
          <TagIcon className="w-3 h-3" />
          {tag.name}
        </span>
      ))}

      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Tag
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-20 w-56 max-h-64 overflow-y-auto bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg p-1">
                {registry === null ? (
                  <div className="flex items-center justify-center py-4 text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : registry.length === 0 ? (
                  <div className="px-2 py-3 text-[11px] text-[var(--color-text-secondary)] text-center">
                    No tags defined yet — add some under Settings.
                  </div>
                ) : (
                  registry.map((tag) => {
                    const isOn = appliedIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggle(tag)}
                        disabled={saving}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-[12px] rounded hover:bg-[var(--color-border-subtle)]"
                      >
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{
                            backgroundColor: tag.color,
                            color: textForBg(tag.color),
                          }}
                        >
                          {tag.name}
                        </span>
                        {isOn ? (
                          <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        ) : (
                          <span className="w-3.5 h-3.5" />
                        )}
                      </button>
                    );
                  })
                )}
                {applied.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await supportApi.setTicketTags(ticketId, []);
                        setApplied([]);
                        onChange?.([]);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to clear tags");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[#DC2626] border-t border-[var(--color-border-subtle)]"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
