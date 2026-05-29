"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Crown,
  Users,
  Save,
  Plug,
  AlertCircle,
  UserCircle,
} from "lucide-react";
import {
  zoomAdminApi,
  type ZoomAccountInfo,
  type ZoomConnectionStatus,
} from "@/lib/api";

/**
 * Zoom host management — embedded inside the Integrations tab (not a
 * separate section). Lets a super-admin pick the fallback host seat,
 * view the connected account, and test the connection. Credentials are
 * NOT editable here — same Zoom account, we only manage which seat hosts.
 */
export default function ZoomIntegrationPanel() {
  const t = useTranslations("adminDashboard.settingsPage.zoomHost");

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ZoomAccountInfo | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [defaultHost, setDefaultHost] = useState("");
  const [savedHost, setSavedHost] = useState("");
  const [saving, setSaving] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ZoomConnectionStatus | null>(
    null,
  );

  const dirty = defaultHost.trim() !== savedHost.trim();

  const load = async () => {
    setLoading(true);
    setAccountError(null);
    try {
      const cfg = await zoomAdminApi.getConfig();
      const host = cfg.defaultHostEmail ?? "";
      setDefaultHost(host);
      setSavedHost(host);
    } catch {
      // config read failure is non-fatal — leave the field empty
    }
    // Account info is a separate, best-effort call: if Zoom is down or
    // credentials are wrong we still want the host field usable.
    try {
      const info = await zoomAdminApi.getAccountInfo();
      setAccount(info);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : t("accountError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await zoomAdminApi.testConnection(
        defaultHost.trim() || undefined,
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({
        connected: false,
        error: err instanceof Error ? err.message : t("testFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = await zoomAdminApi.updateConfig(defaultHost.trim() || null);
      const host = cfg.defaultHostEmail ?? "";
      setSavedHost(host);
      setDefaultHost(host);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Connected account card — only when we could actually read the
          owner. Otherwise show a soft note; host management still works. */}
      {account?.ownerEmail ? (
        <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("connectedAs")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoLine icon={Crown} label={t("owner")} value={account.ownerName || account.ownerEmail} />
            <InfoLine label={t("ownerEmail")} value={account.ownerEmail} mono />
            <InfoLine
              icon={Users}
              label={t("licensedSeats")}
              value={String(account.licensedSeats.length)}
            />
            <InfoLine label={t("accountId")} value={account.accountId} mono />
          </div>

          {/* The actual licensed seats — click one to set it as default host. */}
          {account.licensedSeats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
                {t("seatsListTitle")}
              </p>
              <div className="space-y-1.5">
                {account.licensedSeats.map((seat) => {
                  // "Current host" reflects the SAVED default host, not the
                  // unsaved input — so the badge only appears once Save lands.
                  const isCurrent =
                    !!savedHost &&
                    seat.email.toLowerCase() === savedHost.trim().toLowerCase();
                  return (
                    <div
                      key={seat.email}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-surface-card)] border border-[var(--color-border)]"
                    >
                      <div className="w-7 h-7 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                        <UserCircle className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--color-text-primary)] truncate">
                          {seat.name || seat.email}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                          {seat.email}
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[#15803D] bg-[#DCFCE7] rounded-full flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("currentHost")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDefaultHost(seat.email)}
                          className="text-xs font-medium text-[var(--color-primary)] hover:underline flex-shrink-0"
                        >
                          {t("useAsHost")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--color-text-secondary)]">
            {accountError || t("accountUnavailable")}
          </p>
        </div>
      )}

      {/* Default host email */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {t("defaultHostLabel")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-2">
          {t("defaultHostHelp")}
        </p>
        <input
          type="email"
          list="zoom-licensed-seats"
          value={defaultHost}
          onChange={(e) => setDefaultHost(e.target.value)}
          placeholder={account?.ownerEmail || "host@example.com"}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        {account && account.licensedSeats.length > 0 && (
          <datalist id="zoom-licensed-seats">
            {account.licensedSeats.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name}
              </option>
            ))}
          </datalist>
        )}
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
          {t("emptyHint")}
        </p>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`rounded-lg p-3 text-sm border ${
            testResult.connected
              ? "bg-[#F0FDF4] border-[#BBF7D0]"
              : "bg-[#FEF2F2] border-[#FECACA]"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {testResult.connected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span className="text-[#15803D]">{t("connectionOk")}</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-[#DC2626]" />
                <span className="text-[#991B1B]">{t("connectionFail")}</span>
              </>
            )}
          </div>
          {testResult.error && (
            <p className="text-xs text-[#991B1B] mt-1">{testResult.error}</p>
          )}
          {testResult.host && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]">
              <SeatCheck ok={testResult.host.userExists} label={t("seatExists")} />
              <SeatCheck
                ok={testResult.host.userType === 2}
                label={t("seatLicensed")}
              />
              <SeatCheck
                ok={testResult.host.hasWebinarLicense}
                label={t("seatWebinar")}
                unknownHint={t("seatWebinarUnknown")}
              />
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plug className="w-4 h-4" />
          )}
          {t("testButton")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-button-text)] btn-gold rounded-lg disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t("saveButton")}
        </button>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t("refresh")}
        </button>
      </div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && (
        <Icon className="w-4 h-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </p>
        <p
          className={`text-sm text-[var(--color-text-primary)] truncate ${mono ? "font-mono" : ""}`}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function SeatCheck({
  ok,
  label,
  unknownHint,
}: {
  ok: boolean | null;
  label: string;
  unknownHint?: string;
}) {
  // null = couldn't determine (e.g. missing per-user scope) — show a
  // neutral "unknown" marker, not a false red ✗.
  if (ok === null) {
    return (
      <li className="flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
        <span>
          {label}
          {unknownHint ? ` — ${unknownHint}` : ""}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />
      )}
      <span>{label}</span>
    </li>
  );
}
