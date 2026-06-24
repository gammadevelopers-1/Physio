"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CreditCard,
  Building2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";
import {
  adminFinanceApi,
  type AdminGatewayName,
  type AdminGatewayTestResult,
} from "@/lib/api";

type Gateway = "moyasar" | "tamara" | "tabby" | "bank_transfer";

interface PaymentsSettings extends Record<string, unknown> {
  gateway: Gateway;
  testMode: boolean;
  // SAR is the only supported currency platform-wide. Kept on the type so
  // existing JSONB rows that have `currency: "SAR"` deserialize cleanly.
  currency: "SAR";
  moyasar: { publishableKey: string; secretKeyRef: string | null };
  tamara: { merchantToken: string; secretKeyRef: string | null };
  tabby: { publicKey: string; secretKeyRef: string | null };
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
  webhookSecretRef: string | null;
  invoiceFooterEn: string;
  invoiceFooterAr: string;
  autoSendReceipt: boolean;
}

const FALLBACK: PaymentsSettings = {
  gateway: "bank_transfer",
  testMode: true,
  currency: "SAR",
  moyasar: { publishableKey: "", secretKeyRef: null },
  tamara: { merchantToken: "", secretKeyRef: null },
  tabby: { publicKey: "", secretKeyRef: null },
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
  webhookSecretRef: null,
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
  const [showSecretFields, setShowSecretFields] = useState<Record<string, boolean>>({});

  // Last test-connection result per gateway. Drives the status pill and
  // banner — null means "not tested in this session".
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
      onSave={save}
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

      {/* Gateway selector */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("payments.activeGateway")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("payments.activeGatewayHelp")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GATEWAYS.map((g) => {
            const Icon = g.icon;
            const active = draft.gateway === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, gateway: g.id }))}
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

      {/* Test mode — currency intentionally removed: SAR is the only
          supported currency end-to-end (ZATCA, gateways, invoices). */}
      <div className="flex items-center justify-between border border-[var(--color-border)] rounded-lg p-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {t("payments.testMode")}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("payments.testModeDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, testMode: !d.testMode }))}
          className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            draft.testMode ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
              draft.testMode ? "ms-auto" : ""
            }`}
          />
        </button>
      </div>

      {/* Gateway-specific credentials */}
      {draft.gateway !== "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t(`payments.gateway.${draft.gateway}`)} {t("payments.credentialsTitle")}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("payments.credentialsHelp")}
              </p>
            </div>
            <GatewayTestControl
              gateway={draft.gateway as AdminGatewayName}
              testing={testing === draft.gateway}
              dirty={dirty}
              result={testResults[draft.gateway as AdminGatewayName]}
              onTest={() => runConnectionTest(draft.gateway as AdminGatewayName)}
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

          {draft.gateway === "moyasar" && (
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
              <SecretRefField
                label={t("payments.secretKey")}
                value={draft.moyasar.secretKeyRef}
                show={!!showSecretFields["moyasar"]}
                onToggle={() =>
                  setShowSecretFields((p) => ({ ...p, moyasar: !p.moyasar }))
                }
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    moyasar: { ...d.moyasar, secretKeyRef: v },
                  }))
                }
                helpText={t("payments.secretKeyHelp")}
              />
            </>
          )}

          {draft.gateway === "tamara" && (
            <>
              <CredField
                label={t("payments.merchantToken")}
                value={draft.tamara.merchantToken}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    tamara: { ...d.tamara, merchantToken: v },
                  }))
                }
                helpText={t("payments.merchantTokenHelp")}
              />
              <SecretRefField
                label={t("payments.secretKey")}
                value={draft.tamara.secretKeyRef}
                show={!!showSecretFields["tamara"]}
                onToggle={() =>
                  setShowSecretFields((p) => ({ ...p, tamara: !p.tamara }))
                }
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    tamara: { ...d.tamara, secretKeyRef: v },
                  }))
                }
                helpText={t("payments.secretKeyHelp")}
              />
            </>
          )}

          {draft.gateway === "tabby" && (
            <>
              <CredField
                label={t("payments.publicKey")}
                value={draft.tabby.publicKey}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tabby: { ...d.tabby, publicKey: v } }))
                }
                helpText={t("payments.publicKeyHelp")}
              />
              <SecretRefField
                label={t("payments.secretKey")}
                value={draft.tabby.secretKeyRef}
                show={!!showSecretFields["tabby"]}
                onToggle={() => setShowSecretFields((p) => ({ ...p, tabby: !p.tabby }))}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tabby: { ...d.tabby, secretKeyRef: v } }))
                }
                helpText={t("payments.secretKeyHelp")}
              />
            </>
          )}
        </div>
      )}

      {/* Bank transfer config — shown to students on the public checkout page */}
      {draft.gateway === "bank_transfer" && (
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
      {draft.gateway !== "bank_transfer" && (
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
          <SecretRefField
            label={t("payments.webhookSecret")}
            value={draft.webhookSecretRef}
            show={!!showSecretFields["webhook"]}
            onToggle={() =>
              setShowSecretFields((p) => ({ ...p, webhook: !p.webhook }))
            }
            onChange={(v) =>
              setDraft((d) => ({ ...d, webhookSecretRef: v }))
            }
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

function SecretRefField({
  label,
  value,
  show,
  onToggle,
  onChange,
  helpText,
}: {
  label: string;
  value: string | null;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string | null) => void;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full h-10 px-3 pe-10 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {helpText && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {helpText}
        </p>
      )}
    </div>
  );
}
