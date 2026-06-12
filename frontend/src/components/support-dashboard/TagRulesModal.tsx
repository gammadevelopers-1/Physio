"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Loader2,
  Trash2,
  Zap,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";

type Rule = {
  id: string;
  tagId: string;
  pattern: string;
  matchScope: "subject" | "description" | "both";
  enabled: boolean;
  createdAt: string;
};

const SCOPES: { value: Rule["matchScope"]; label: string; hint: string }[] = [
  {
    value: "both",
    label: "Subject + description",
    hint: "Default — match anywhere in the ticket",
  },
  {
    value: "subject",
    label: "Subject only",
    hint: "Tighter — won't fire from a tangential keyword in the body",
  },
  {
    value: "description",
    label: "Description only",
    hint: "Useful when subjects are template-like",
  },
];

// Settings → Tags → (per tag) Auto-apply rules.
//
// Each rule is a case-insensitive substring that, when found in the
// chosen scope of a NEW ticket, auto-attaches this tag. Rules are
// stored per-tag (cascade on delete). Enabled toggles let an admin
// pause a noisy rule without losing it.
export default function TagRulesModal({
  tagId,
  tagName,
  tagColor,
  onClose,
}: {
  tagId: string;
  tagName: string;
  tagColor: string;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pattern, setPattern] = useState("");
  const [scope, setScope] = useState<Rule["matchScope"]>("both");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);

  async function reload() {
    try {
      const list = await supportApi.listTagRules(tagId);
      setRules(list);
    } catch {
      setRules([]);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId]);

  // Esc-to-close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close scope dropdown on outside click
  useEffect(() => {
    if (!scopeOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        scopeRef.current &&
        !scopeRef.current.contains(e.target as Node)
      ) {
        setScopeOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [scopeOpen]);

  async function addRule() {
    const trimmed = pattern.trim();
    if (!trimmed) {
      toast.error("Enter a phrase to match");
      return;
    }
    setSaving(true);
    try {
      await supportApi.createTagRule(tagId, {
        pattern: trimmed,
        matchScope: scope,
      });
      setPattern("");
      toast.success("Rule added");
      await reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add rule");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: Rule) {
    setBusyId(rule.id);
    try {
      await supportApi.updateTagRule(rule.id, { enabled: !rule.enabled });
      await reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: Rule) {
    setBusyId(rule.id);
    try {
      await supportApi.deleteTagRule(rule.id);
      toast.success("Rule removed");
      await reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  const selectedScope = SCOPES.find((s) => s.value === scope) || SCOPES[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-surface-card)] rounded-2xl shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              Auto-apply rules
            </h3>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full"
              style={{
                backgroundColor: tagColor,
                color: "#1F2937",
              }}
            >
              {tagName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            When a new ticket contains any phrase below in the chosen scope,
            this tag is attached automatically (case-insensitive). Disable a
            rule to pause without losing it.
          </p>

          {/* Add new rule */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--color-text-primary)]">
              Phrase to match
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                maxLength={200}
                placeholder="e.g. refund, login error, can't access"
                className="flex-1 h-10 px-3 bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addRule();
                }}
              />
              {/* Themed scope dropdown */}
              <div ref={scopeRef} className="relative w-56">
                <button
                  type="button"
                  onClick={() => setScopeOpen((v) => !v)}
                  className="w-full h-10 px-3 flex items-center justify-between bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <span className="truncate text-start">
                    {selectedScope.label}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      scopeOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {scopeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10 py-1 overflow-hidden">
                    {SCOPES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setScope(s.value);
                          setScopeOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-start hover:bg-[var(--color-border-subtle)] flex items-start justify-between gap-2 ${
                          s.value === scope
                            ? "bg-[var(--color-border-subtle)]"
                            : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm ${
                              s.value === scope
                                ? "text-[var(--color-primary)] font-medium"
                                : "text-[var(--color-text-primary)]"
                            }`}
                          >
                            {s.label}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            {s.hint}
                          </div>
                        </div>
                        {s.value === scope && (
                          <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-1" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={addRule}
                disabled={saving || !pattern.trim()}
                className="inline-flex items-center gap-1 px-3 h-10 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
          </div>

          {/* List of existing rules */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--color-text-primary)]">
              Existing rules
            </label>
            {rules === null ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : rules.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
                No rules yet — this tag is only ever applied by hand.
              </p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(rule)}
                    disabled={busyId === rule.id}
                    aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      rule.enabled
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-border)]"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                        rule.enabled ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        rule.enabled
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)] line-through"
                      }`}
                    >
                      “{rule.pattern}”
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] uppercase">
                      {rule.matchScope === "both"
                        ? "Subject + description"
                        : rule.matchScope === "subject"
                          ? "Subject only"
                          : "Description only"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(rule)}
                    disabled={busyId === rule.id}
                    aria-label="Delete rule"
                    className="p-1.5 text-[var(--color-text-secondary)] hover:text-[#DC2626] rounded disabled:opacity-50"
                  >
                    {busyId === rule.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
