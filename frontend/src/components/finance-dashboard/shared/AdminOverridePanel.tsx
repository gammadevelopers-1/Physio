"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";

export interface AdminOverrideAction {
  /** Stable key (used as button id). */
  key: string;
  /** Button label (already localized). */
  label: string;
  /** Tooltip / one-line description (already localized). */
  description?: string;
  /** Render as red/destructive (cancel, force-fail). */
  danger?: boolean;
  /** Called with the admin's reason. Throw to surface an error toast. */
  run: (reason: string) => Promise<unknown>;
  /** Toast message on success (already localized). */
  successToast: string;
}

/**
 * Bottom-of-drawer panel that exposes admin-only finance super-actions.
 * Only renders when actorRole === 'admin' (caller checks via useIsAdminActor).
 *
 * Each action opens an inline reason prompt (≥5 chars, matches backend
 * validation) and on confirm calls the action's `run(reason)` handler.
 * After success it fires `onAfter()` so the parent drawer can re-fetch
 * fresh data and reflect the change.
 */
export default function AdminOverridePanel({
  actions,
  onAfter,
}: {
  actions: AdminOverrideAction[];
  onAfter?: () => void;
}) {
  const t = useTranslations("financeDashboard.adminOverride");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);

  const active = actions.find((a) => a.key === activeKey) ?? null;

  const close = () => {
    setActiveKey(null);
    setReason("");
  };

  const run = async () => {
    if (!active || running) return;
    if (reason.trim().length < 5) {
      toast.error(t("reasonTooShort"));
      return;
    }
    setRunning(true);
    try {
      await active.run(reason.trim());
      toast.success(active.successToast);
      close();
      onAfter?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("genericError");
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  if (!actions.length) return null;

  return (
    <div className="border border-[#FECACA] bg-[#FEF2F2] rounded-lg p-4 mt-4">
      <div className="flex items-start gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-[#B91C1C] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-[#991B1B]">
            {t("title")}
          </h4>
          <p className="text-xs text-[#B91C1C] mt-0.5">{t("subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              setActiveKey(a.key);
              setReason("");
            }}
            disabled={running}
            title={a.description}
            className={`text-xs font-medium px-3 py-2 rounded-md border transition-colors text-left ${
              a.danger
                ? "border-[#B91C1C] bg-white text-[#B91C1C] hover:bg-[#FEE2E2]"
                : "border-[#B91C1C] bg-white text-[#7F1D1D] hover:bg-[#FEE2E2]"
            } disabled:opacity-50`}
          >
            <div className="font-semibold">{a.label}</div>
            {a.description && (
              <div className="text-[11px] text-[#9F1239] mt-0.5 line-clamp-2">
                {a.description}
              </div>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 bg-white border border-[#FECACA] rounded-md p-3">
          <label
            htmlFor="admin-override-reason"
            className="block text-xs font-medium text-[#991B1B] mb-1.5"
          >
            {t("reasonLabel", { action: active.label })}
          </label>
          <textarea
            id="admin-override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            disabled={running}
            placeholder={t("reasonPlaceholder")}
            className="w-full px-2.5 py-1.5 text-xs border border-[var(--color-input-border)] rounded-md focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            autoFocus
          />
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            {t("reasonHint")}
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={close}
              disabled={running}
              className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={run}
              disabled={running || reason.trim().length < 5}
              className={`text-xs px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5 ${
                active.danger ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-[#B91C1C] hover:bg-[#991B1B]"
              }`}
            >
              {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {running ? t("running") : t("confirmRun")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
