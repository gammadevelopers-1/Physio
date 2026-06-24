"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  CreditCard,
  Building2,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  AlertCircle,
  XCircle,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";
import {
  adminFinanceApi,
  type AdminGatewayName,
  type AdminGatewayTestResult,
  type GatewayRuntimeStatusResponse,
} from "@/lib/api";

type Gateway = "moyasar" | "tamara" | "tabby" | "bank_transfer";
type TamaraMode = "test" | "live";

interface PaymentsSettings extends Record<string, unknown> {
  // SAR is the only supported currency platform-wide. Kept on the type so
  // existing JSONB rows that have `currency: "SAR"` deserialize cleanly.
  currency: "SAR";
  moyasar: { publishableKey: string; secretKeyRef: string };
  tamara: { merchantToken: string; secretKeyRef: string; mode?: TamaraMode };
  tabby: { publicKey: string; secretKeyRef: string };
  bankTransfer: {
    // Legacy single-locale fields — kept for backward compat with prior data.
    bankName?: string;
    accountHolder?: string;
    // New bilingual fields (preferred — what the public checkout reads).
    bankNameEn: string;
    bankNameAr: string;
    beneficiaryEn: string;
    beneficiaryAr: string;
    accountNumber: string;
    iban: string;
    swiftCode: string;
    instructionsEn: string;
    instructionsAr: string;
  };
  webhookSecretRef: string;
  invoiceFooterEn: string;
  invoiceFooterAr: string;
  autoSendReceipt: boolean;
}

const FALLBACK: PaymentsSettings = {
  currency: "SAR",
  // Secret fields default to empty strings — the load endpoint strips
  // encrypted secret values, and empty-on-save means "preserve existing".
  moyasar: { publishableKey: "", secretKeyRef: "" },
  tamara: { merchantToken: "", secretKeyRef: "", mode: undefined },
  tabby: { publicKey: "", secretKeyRef: "" },
  bankTransfer: {
    bankNameEn: "",
    bankNameAr: "",
    beneficiaryEn: "",
    beneficiaryAr: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    instructionsEn: "",
    instructionsAr: "",
  },
  webhookSecretRef: "",
  invoiceFooterEn: "",
  invoiceFooterAr: "",
  autoSendReceipt: true,
};

const GATEWAYS: { id: Gateway; icon: React.ElementType }[] = [
  { id: "moyasar", icon: CreditCard },
  { id: "tamara", icon: CreditCard },
  { id: "tabby", icon: CreditCard },
  { id: "bank_transfer", icon: Building2 },
];

export default function PaymentsTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<PaymentsSettings>("payments", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active gateway tab — purely a view-toggle, no longer saved to DB.
  // Customer picks gateway at checkout; this just decides which credentials
  // block the admin is editing right now.
  const [viewGateway, setViewGateway] = useState<Gateway>("moyasar");

  // Per-gateway runtime status (mode/source/lastFour) — populated from
  // /admin/finance/gateways/runtime-status. Drives the read-only pills.
  const [runtimeStatus, setRuntimeStatus] =
    useState<GatewayRuntimeStatusResponse | null>(null);

  const refreshRuntimeStatus = useCallback(async () => {
    try {
      const s = await adminFinanceApi.getGatewayRuntimeStatus();
      setRuntimeStatus(s);
    } catch {
      // Non-fatal — pills just won't render on this load.
    }
  }, []);

  useEffect(() => {
    refreshRuntimeStatus();
  }, [refreshRuntimeStatus]);

  // Last test-connection result per gateway. Drives the test-button status
  // pill — null means "not tested in this session".
  const [testResults, setTestResults] = useState<
    Partial<Record<AdminGatewayName, AdminGatewayTestResult>>
  >({});
  const [testing, setTesting] = useState<AdminGatewayName | null>(null);

  const runConnectionTest = async (gateway: AdminGatewayName) => {
    if (testing) return;
    setTesting(gateway);
    try {
      const result = await adminFinanceApi.testGatewayConnection(gateway);
      setTestResults((prev) => ({ ...prev, [gateway]: result }));
      // Include the actual error code in toasts for degraded/down so admin
      // doesn't have to open DevTools to see "HTTP 401". The pill below
      // the button keeps the same info visible.
      const errSuffix = result.error ? ` — ${result.error}` : "";
      if (result.status === "healthy") {
        toast.success(t("payments.testSuccess"));
      } else if (result.status === "degraded") {
        toast.warning(`${t("payments.testDegraded")}${errSuffix}`);
      } else {
        toast.error(`${t("payments.testFailed")}${errSuffix}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("payments.testFailed");
      toast.error(msg);
      setTestResults((prev) => ({
        ...prev,
        [gateway]: {
          gateway,
          status: "down",
          source: "empty",
          checkedAt: new Date().toISOString(),
          error: msg,
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin.replace(/physioguidance\.org/, "api.physioguidance.org") : "https://api.physioguidance.org"}/api/payments/webhook`;

  const copy = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
      toast.success(t("payments.copied"));
    } catch {
      toast.error(t("payments.copyFailed"));
    }
  };

  const updateBankField = (
    key: keyof PaymentsSettings["bankTransfer"],
    value: string,
  ) =>
    setDraft((d) => ({
      ...d,
      bankTransfer: { ...d.bankTransfer, [key]: value },
    }));

  return (
    <TabShell
      title={t("payments.title")}
      description={t("payments.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={async () => {
        await save();
        // Pull fresh runtime status so mode/source/lastFour pills reflect
        // any new keys the admin just rotated. Test results stale-reset
        // too — the previous result might have been against old keys.
        setTestResults({});
        await refreshRuntimeStatus();
      }}
    >
      {/* Live runtime info banner — DB changes go live immediately via the
          shared gateway-credentials cache (env vars stay as fallback). */}
      <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#059669] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-[#065F46] mb-0.5">
            {t("payments.liveRuntime")}
          </p>
          <p className="text-[#047857]">{t("payments.liveRuntimeBody")}</p>
        </div>
      </div>

      {/* Gateway tabs — view-only filter (NOT persisted). Picking one just
          decides which credentials section the admin is editing right now.
          Active gateway for customers is decided at checkout. */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("payments.editingGateway")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("payments.editingGatewayHelp")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GATEWAYS.map((g) => {
            const Icon = g.icon;
            const active = viewGateway === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setViewGateway(g.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)]"
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    active ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    active ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {t(`payments.gateway.${g.id}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gateway-specific credentials */}
      {viewGateway !== "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t(`payments.gateway.${viewGateway}`)} {t("payments.credentialsTitle")}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("payments.credentialsHelp")}
              </p>
            </div>
            <GatewayTestControl
              gateway={viewGateway as AdminGatewayName}
              testing={testing === viewGateway}
              dirty={dirty}
              result={testResults[viewGateway as AdminGatewayName]}
              onTest={() => runConnectionTest(viewGateway as AdminGatewayName)}
              labels={{
                test: t("payments.testConnection"),
                testing: t("payments.testing"),
                healthy: t("payments.statusHealthy"),
                degraded: t("payments.statusDegraded"),
                down: t("payments.statusDown"),
                sourceDb: t("payments.sourceDb"),
                sourceEnv: t("payments.sourceEnv"),
                sourceMixed: t("payments.sourceMixed"),
                saveFirst: t("payments.saveFirstHint"),
                hint401: t("payments.hint401"),
                hint403: t("payments.hint403"),
                hint429: t("payments.hint429"),
                hint5xx: t("payments.hint5xx"),
              }}
            />
          </div>

          {/* Runtime status pill — shows what's actually loaded RIGHT NOW
              (mode / source / last-4 of the key). Source-of-truth pulled
              from /admin/finance/gateways/runtime-status, not the form. */}
          <RuntimeStatusPill
            status={runtimeStatus?.[viewGateway as AdminGatewayName]}
            labels={{
              live: t("payments.modeLive"),
              test: t("payments.modeTest"),
              modeUnknown: t("payments.modeUnknown"),
              sourceDb: t("payments.sourceDb"),
              sourceEnv: t("payments.sourceEnv"),
              sourceMixed: t("payments.sourceMixed"),
              sourceEmpty: t("payments.sourceEmpty"),
              keyLabel: t("payments.currentKey"),
            }}
          />

          {viewGateway === "moyasar" && (
            <>
              <CredField
                label={t("payments.publishableKey")}
                value={draft.moyasar.publishableKey}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    moyasar: { ...d.moyasar, publishableKey: v },
                  }))
                }
                helpText={t("payments.publishableKeyHelp")}
              />
              <SecretRotationField
                label={t("payments.secretKey")}
                value={draft.moyasar.secretKeyRef}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    moyasar: { ...d.moyasar, secretKeyRef: v },
                  }))
                }
                lastFour={runtimeStatus?.moyasar.lastFour ?? null}
                labels={secretRotationLabels(t)}
              />
            </>
          )}

          {viewGateway === "tamara" && (
            <>
              {/* Tamara-specific Mode dropdown — drives BOTH the API URL
                  (sandbox vs prod) AND the key environment. Persisted to
                  system_settings.payments.tamara.mode. */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  {t("payments.tamaraMode")}
                </label>
                <select
                  value={draft.tamara.mode ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      tamara: {
                        ...d.tamara,
                        mode: (e.target.value || undefined) as TamaraMode | undefined,
                      },
                    }))
                  }
                  className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">{t("payments.tamaraModeAuto")}</option>
                  <option value="test">{t("payments.modeTest")}</option>
                  <option value="live">{t("payments.modeLive")}</option>
                </select>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {t("payments.tamaraModeHelp")}
                </p>
              </div>

              <SecretRotationField
                label={t("payments.merchantToken")}
                value={draft.tamara.merchantToken}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    tamara: { ...d.tamara, merchantToken: v },
                  }))
                }
                lastFour={runtimeStatus?.tamara.lastFour ?? null}
                labels={secretRotationLabels(t)}
                helpText={t("payments.merchantTokenHelp")}
              />
              <SecretRotationField
                label={t("payments.secretKey")}
                value={draft.tamara.secretKeyRef}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    tamara: { ...d.tamara, secretKeyRef: v },
                  }))
                }
                lastFour={null}
                labels={secretRotationLabels(t)}
              />
            </>
          )}

          {viewGateway === "tabby" && (
            <>
              <CredField
                label={t("payments.publicKey")}
                value={draft.tabby.publicKey}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tabby: { ...d.tabby, publicKey: v } }))
                }
                helpText={t("payments.publicKeyHelp")}
              />
              <SecretRotationField
                label={t("payments.secretKey")}
                value={draft.tabby.secretKeyRef}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tabby: { ...d.tabby, secretKeyRef: v } }))
                }
                lastFour={runtimeStatus?.tabby.lastFour ?? null}
                labels={secretRotationLabels(t)}
              />
            </>
          )}
        </div>
      )}

      {/* Bank transfer config — shown to students on the public checkout page */}
      {viewGateway === "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("payments.bankTransferDetails")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("payments.bankTransferHelp")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.bankNameEn")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.bankNameEn}
                onChange={(e) => updateBankField("bankNameEn", e.target.value)}
                placeholder="e.g. Al Rajhi Bank"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.bankNameAr")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.bankNameAr}
                onChange={(e) => updateBankField("bankNameAr", e.target.value)}
                placeholder="مثال: مصرف الراجحي"
                dir="rtl"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.beneficiaryEn")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.beneficiaryEn}
                onChange={(e) => updateBankField("beneficiaryEn", e.target.value)}
                placeholder="e.g. Qdrah Co"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.beneficiaryAr")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.beneficiaryAr}
                onChange={(e) => updateBankField("beneficiaryAr", e.target.value)}
                placeholder="مثال: شركة القدرة التقنية"
                dir="rtl"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.accountNumber")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.accountNumber}
                onChange={(e) => updateBankField("accountNumber", e.target.value)}
                placeholder="e.g. 362608011111129"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.swiftCode")}{" "}
                <span className="text-xs text-[var(--color-text-secondary)] font-normal">
                  ({t("payments.optional")})
                </span>
              </label>
              <input
                type="text"
                value={draft.bankTransfer.swiftCode}
                onChange={(e) => updateBankField("swiftCode", e.target.value)}
                placeholder="e.g. RJHISARI"
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("payments.iban")}
            </label>
            <input
              type="text"
              value={draft.bankTransfer.iban}
              onChange={(e) => updateBankField("iban", e.target.value)}
              placeholder="SA00 0000 0000 0000 0000 0000"
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("payments.ibanHelp")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.instructions")} (EN)
              </label>
              <textarea
                value={draft.bankTransfer.instructionsEn}
                onChange={(e) => updateBankField("instructionsEn", e.target.value)}
                rows={4}
                placeholder="e.g. After transferring, upload the receipt below. Approval typically takes 1 business day."
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.instructions")} (AR)
              </label>
              <textarea
                value={draft.bankTransfer.instructionsAr}
                onChange={(e) => updateBankField("instructionsAr", e.target.value)}
                rows={4}
                dir="rtl"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Webhook */}
      {viewGateway !== "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("payments.webhookTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("payments.webhookHelp")}
          </p>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("payments.webhookUrl")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] font-mono"
              />
              <button
                type="button"
                onClick={() => copy(webhookUrl, "webhookUrl")}
                className="inline-flex items-center gap-1.5 px-3 h-10 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
              >
                {copiedField === "webhookUrl" ? (
                  <Check className="w-4 h-4 text-[#22C55E]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedField === "webhookUrl"
                  ? t("payments.copiedShort")
                  : t("payments.copy")}
              </button>
            </div>
          </div>
          <SecretRotationField
            label={t("payments.webhookSecret")}
            value={draft.webhookSecretRef}
            onChange={(v) => setDraft((d) => ({ ...d, webhookSecretRef: v }))}
            lastFour={null}
            labels={secretRotationLabels(t)}
            helpText={t("payments.webhookSecretHelp")}
          />
        </div>
      )}

      {/* Invoice */}
      <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("payments.invoiceTitle")}
        </h3>

        <div className="flex items-center justify-between py-1.5">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("payments.autoSendReceipt")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("payments.autoSendReceiptDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({ ...d, autoSendReceipt: !d.autoSendReceipt }))
            }
            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
              draft.autoSendReceipt ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                draft.autoSendReceipt ? "ms-auto" : ""
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("payments.invoiceFooter")} (EN)
            </label>
            <textarea
              value={draft.invoiceFooterEn}
              onChange={(e) =>
                setDraft((d) => ({ ...d, invoiceFooterEn: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("payments.invoiceFooter")} (AR)
            </label>
            <textarea
              value={draft.invoiceFooterAr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, invoiceFooterAr: e.target.value }))
              }
              rows={3}
              dir="rtl"
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>
    </TabShell>
  );
}

// ─── Helper field components ────────────────────────────────────

function CredField({
  label,
  value,
  onChange,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
      />
      {helpText && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {helpText}
        </p>
      )}
    </div>
  );
}

// Decode common gateway HTTP error codes into actionable hints.
// "HTTP 401" → token rejected; "HTTP 429" → rate limited; etc. Falls
// through to a generic line for codes we don't recognize.
function decodeGatewayError(error: string | undefined, labels: GatewayTestLabels): string | null {
  if (!error) return null;
  const m = error.match(/HTTP\s+(\d{3})/i);
  const code = m ? parseInt(m[1], 10) : null;
  if (code === 401) return labels.hint401;
  if (code === 403) return labels.hint403;
  if (code === 429) return labels.hint429;
  if (code && code >= 500) return labels.hint5xx;
  return error; // unknown error — show it verbatim so the operator has a clue
}

interface GatewayTestLabels {
  test: string;
  testing: string;
  healthy: string;
  degraded: string;
  down: string;
  sourceDb: string;
  sourceEnv: string;
  sourceMixed: string;
  saveFirst: string;
  hint401: string;
  hint403: string;
  hint429: string;
  hint5xx: string;
}

function GatewayTestControl({
  gateway,
  testing,
  dirty,
  result,
  onTest,
  labels,
}: {
  gateway: AdminGatewayName;
  testing: boolean;
  dirty: boolean;
  result: AdminGatewayTestResult | undefined;
  onTest: () => void;
  labels: GatewayTestLabels;
}) {
  const StatusIcon =
    result?.status === "healthy" ? ShieldCheck
    : result?.status === "degraded" ? AlertCircle
    : result?.status === "down" ? XCircle
    : null;
  const statusBg =
    result?.status === "healthy" ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
    : result?.status === "degraded" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
    : result?.status === "down" ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
    : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
  const statusLabel =
    result?.status === "healthy" ? labels.healthy
    : result?.status === "degraded" ? labels.degraded
    : result?.status === "down" ? labels.down
    : null;
  const sourceLabel =
    result?.source === "db" ? labels.sourceDb
    : result?.source === "env" ? labels.sourceEnv
    : result?.source === "mixed" ? labels.sourceMixed
    : null;
  const errorHint = result && result.status !== "healthy" ? decodeGatewayError(result.error, labels) : null;

  return (
    <div className="flex flex-col items-end gap-2 max-w-[260px]">
      <button
        type="button"
        onClick={onTest}
        disabled={testing || dirty}
        title={dirty ? labels.saveFirst : undefined}
        className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)]"
      >
        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {testing ? labels.testing : labels.test}
      </button>
      {result && StatusIcon && (
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border ${statusBg}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusLabel}</span>
          {result.error && (
            <span className="font-mono opacity-80">· {result.error}</span>
          )}
          {sourceLabel && (
            <span className="opacity-70">· {sourceLabel}</span>
          )}
        </div>
      )}
      {errorHint && (
        <p className="text-[11px] text-[#B45309] text-right leading-relaxed">
          {errorHint}
        </p>
      )}
      {dirty && (
        <p className="text-[11px] text-[var(--color-text-secondary)] text-right">
          {labels.saveFirst}
        </p>
      )}
      <span className="sr-only">{gateway}</span>
    </div>
  );
}

// ─── Read-only runtime status pill ─────────────────────────────────
// Shows MODE (test / live) + SOURCE (admin / env / mixed) + last-4 chars
// of the loaded secret. Computed server-side — no secret ever reaches the
// browser. Used as a "what's actually live right now" indicator above each
// credentials block.
function RuntimeStatusPill({
  status,
  labels,
}: {
  status:
    | { mode: "test" | "live" | null; source: string; lastFour: string | null; hasCredentials: boolean }
    | undefined;
  labels: {
    live: string;
    test: string;
    modeUnknown: string;
    sourceDb: string;
    sourceEnv: string;
    sourceMixed: string;
    sourceEmpty: string;
    keyLabel: string;
  };
}) {
  if (!status) return null;
  const modeLabel =
    status.mode === "live" ? labels.live
    : status.mode === "test" ? labels.test
    : labels.modeUnknown;
  const modeBg =
    status.mode === "live" ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
    : status.mode === "test" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
    : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
  const sourceLabel =
    status.source === "db" ? labels.sourceDb
    : status.source === "env" ? labels.sourceEnv
    : status.source === "mixed" ? labels.sourceMixed
    : labels.sourceEmpty;
  return (
    <div className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wide ${modeBg}`}
      >
        {modeLabel}
      </span>
      <span className="text-[var(--color-text-secondary)]">·</span>
      <span className="text-[var(--color-text-secondary)]">{sourceLabel}</span>
      {status.lastFour && (
        <>
          <span className="text-[var(--color-text-secondary)]">·</span>
          <span className="text-[var(--color-text-secondary)]">{labels.keyLabel}:</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            ••••{status.lastFour}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Secret rotation field ─────────────────────────────────────────
// Empty by default. Admin types a new value to ROTATE; leaving it empty
// preserves whatever's already stored. No reveal button — the server
// never sends back the stored secret, so there's nothing to reveal.
function secretRotationLabels(
  t: ReturnType<typeof useTranslations<"adminDashboard.settingsPage">>,
) {
  return {
    leaveEmpty: t("payments.rotateLeaveEmpty"),
    rotatingPill: t("payments.rotatingPill"),
    typeToRotate: t("payments.typeToRotate"),
  };
}

function SecretRotationField({
  label,
  value,
  onChange,
  helpText,
  lastFour,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helpText?: string;
  lastFour: string | null;
  labels: {
    leaveEmpty: string;
    rotatingPill: string;
    typeToRotate: string;
  };
}) {
  const isRotating = value.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
        {isRotating && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
            <KeyRound className="w-3 h-3" />
            {labels.rotatingPill}
          </span>
        )}
      </div>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lastFour ? `••••${lastFour} — ${labels.leaveEmpty}` : labels.typeToRotate}
        className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
      />
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
        {helpText ? `${helpText} · ` : ""}
        {labels.leaveEmpty}
      </p>
    </div>
  );
}
