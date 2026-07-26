"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Plus,
  Loader2,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";

type Rule = {
  id: string;
  tagId: string;
  pattern: string;
  matchScope: "subject" | "description" | "both";
  enabled: boolean;
  createdAt: string;
};

const SCOPE_VALUES: Rule["matchScope"][] = ["both", "subject", "description"];

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
  const t = useTranslations("supportDashboard.tagRules");
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pattern, setPattern] = useState("");
  const [scope, setScope] = useState<Rule["matchScope"]>("both");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function addRule() {
    const trimmed = pattern.trim();
    if (!trimmed) {
      toast.error(t("toasts.enterPhrase"));
      return;
    }
    setSaving(true);
    try {
      await supportApi.createTagRule(tagId, {
        pattern: trimmed,
        matchScope: scope,
      });
      setPattern("");
      toast.success(t("toasts.ruleAdded"));
      await reload();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.ruleAddFailed"));
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
      toast.error(err?.message || t("toasts.updateFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: Rule) {
    setBusyId(rule.id);
    try {
      await supportApi.deleteTagRule(rule.id);
      toast.success(t("toasts.ruleRemoved"));
      await reload();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.ruleDeleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  const selectedScopeHint = t(`scopes.${scope}Hint`);

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
              {t("title")}
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
            aria-label={t("closeAria")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("intro")}
          </p>

          {/* Add new rule */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--color-text-primary)]">
              {t("phraseLabel")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                maxLength={200}
                placeholder={t("phrasePlaceholder")}
                className="flex-1 h-10 px-3 bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addRule();
                }}
              />
              <div className="w-56">
                <Select
                  value={scope}
                  onChange={(v) => setScope(v as Rule["matchScope"])}
                  options={SCOPE_VALUES.map((v) => ({
                    value: v,
                    label: t(`scopes.${v}`),
                  }))}
                />
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
                {t("addButton")}
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {selectedScopeHint}
            </p>
          </div>

          {/* List of existing rules */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--color-text-primary)]">
              {t("existingRules")}
            </label>
            {rules === null ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : rules.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
                {t("noRules")}
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
                    aria-label={rule.enabled ? t("disableRuleAria") : t("enableRuleAria")}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      rule.enabled
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-border)]"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                        rule.enabled ? "start-[18px]" : "start-0.5"
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
                      {t(`scopes.${rule.matchScope}`)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(rule)}
                    disabled={busyId === rule.id}
                    aria-label={t("deleteRuleAria")}
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
            {t("doneButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
