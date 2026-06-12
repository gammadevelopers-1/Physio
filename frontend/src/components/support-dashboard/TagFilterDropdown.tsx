"use client";

import { useEffect, useRef, useState } from "react";
import { Tag as TagIcon, ChevronDown, Check, X, Loader2 } from "lucide-react";
import { supportApi } from "@/lib/api";

type Tag = {
  id: string;
  name: string;
  color: string;
};

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

// Themed multi-select tag filter for ticket list views. Maps to the
// existing backend `?tags=id1,id2` filter (AND semantics — every chosen
// tag must be present). Stateless: the parent owns `selectedIds` and
// receives changes via `onChange`. Archived tags are excluded from the
// dropdown but a selected-then-archived tag still renders as a chip
// so the URL/state stays usable.
export default function TagFilterDropdown({
  selectedIds,
  onChange,
  className,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    supportApi
      .listTicketTags()
      .then((rows) => {
        if (!cancelled) {
          setTags(rows.map((r) => ({ id: r.id, name: r.name, color: r.color })));
        }
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = (tags || []).filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()),
  );

  const selectedTags = (tags || []).filter((t) => selectedIds.includes(t.id));
  // Show stub chips for selected IDs we haven't loaded yet (e.g. tag
  // got archived after a deep-link). Keeps the UI honest.
  const stubIds = selectedIds.filter((id) => !(tags || []).some((t) => t.id === id));

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className || ""}`}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-10 px-3 flex items-center justify-between gap-2 bg-[var(--color-surface-card)] border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)] w-full"
        >
          <span className="inline-flex items-center gap-1.5 truncate text-start">
            <TagIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
            {selectedIds.length === 0 ? (
              <span className="text-[var(--color-text-secondary)]">
                Filter by tag
              </span>
            ) : (
              <span>
                {selectedIds.length} tag{selectedIds.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-[var(--color-border-subtle)]">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags…"
                className="w-full h-8 px-2 text-sm border border-[var(--color-input-border)] rounded focus:outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {tags === null ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--color-text-secondary)] text-center">
                  {query ? "No matches." : "No tags available."}
                </p>
              ) : (
                filtered.map((tag) => {
                  const checked = selectedIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggle(tag.id)}
                      className="w-full px-3 py-2 text-start hover:bg-[var(--color-border-subtle)] flex items-center gap-2"
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          checked
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                            : "border-[var(--color-input-border)]"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full"
                        style={{
                          backgroundColor: tag.color,
                          color: textForBg(tag.color),
                        }}
                      >
                        {tag.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedIds.length > 0 && (
              <div className="px-2 py-1.5 border-t border-[var(--color-border-subtle)] flex justify-between">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs text-[var(--color-primary)] font-medium"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected chip strip — visible below the button for context */}
      {(selectedTags.length > 0 || stubIds.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full"
              style={{
                backgroundColor: t.color,
                color: textForBg(t.color),
              }}
            >
              {t.name}
              <button
                type="button"
                onClick={() => toggle(t.id)}
                aria-label={`Remove ${t.name}`}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {stubIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)] italic"
              title="Archived or missing tag"
            >
              archived
              <button
                type="button"
                onClick={() => toggle(id)}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
