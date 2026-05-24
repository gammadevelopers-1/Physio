"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CreditCard,
  Building2,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import Select from "../Select";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";

type Gateway = "moyasar" | "tap" | "tamara" | "bank_transfer";

interface PaymentsSettings extends Record<string, unknown> {
  gateway: Gateway;
  testMode: boolean;
  currency: "SAR" | "USD" | "AED";
  moyasar: { publishableKey: string; secretKeyRef: string | null };
  tap: { publishableKey: string; secretKeyRef: string | null };
  tamara: { merchantToken: string; secretKeyRef: string | null };
  bankTransfer: {
    bankName: string;
    accountHolder: string;
    iban: string;
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
  tap: { publishableKey: "", secretKeyRef: null },
  tamara: { merchantToken: "", secretKeyRef: null },
  bankTransfer: {
    bankName: "",
    accountHolder: "",
    iban: "",
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
  { id: "tap", icon: CreditCard },
  { id: "tamara", icon: CreditCard },
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
      {/* Provider-not-wired banner */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-[#92400E] mb-0.5">
            {t("payments.providerNotConnected")}
          </p>
          <p className="text-[#B45309]">{t("payments.providerNotConnectedBody")}</p>
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

      {/* Test mode + currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("payments.currency")}
          </label>
          <Select
            value={draft.currency}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                currency: v as PaymentsSettings["currency"],
              }))
            }
            options={[
              { value: "SAR", label: "SAR — Saudi Riyal" },
              { value: "AED", label: "AED — UAE Dirham" },
              { value: "USD", label: "USD — US Dollar" },
            ]}
          />
        </div>
      </div>

      {/* Gateway-specific credentials */}
      {draft.gateway !== "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t(`payments.gateway.${draft.gateway}`)} {t("payments.credentialsTitle")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("payments.credentialsHelp")}
            </p>
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

          {draft.gateway === "tap" && (
            <>
              <CredField
                label={t("payments.publishableKey")}
                value={draft.tap.publishableKey}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tap: { ...d.tap, publishableKey: v } }))
                }
                helpText={t("payments.publishableKeyHelp")}
              />
              <SecretRefField
                label={t("payments.secretKey")}
                value={draft.tap.secretKeyRef}
                show={!!showSecretFields["tap"]}
                onToggle={() => setShowSecretFields((p) => ({ ...p, tap: !p.tap }))}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, tap: { ...d.tap, secretKeyRef: v } }))
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
        </div>
      )}

      {/* Bank transfer config */}
      {draft.gateway === "bank_transfer" && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("payments.bankTransferDetails")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.bankName")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.bankName}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    bankTransfer: { ...d.bankTransfer, bankName: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.accountHolder")}
              </label>
              <input
                type="text"
                value={draft.bankTransfer.accountHolder}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    bankTransfer: {
                      ...d.bankTransfer,
                      accountHolder: e.target.value,
                    },
                  }))
                }
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
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
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  bankTransfer: { ...d.bankTransfer, iban: e.target.value },
                }))
              }
              placeholder="SA00 0000 0000 0000 0000 0000"
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.instructions")} (EN)
              </label>
              <textarea
                value={draft.bankTransfer.instructionsEn}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    bankTransfer: {
                      ...d.bankTransfer,
                      instructionsEn: e.target.value,
                    },
                  }))
                }
                rows={4}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("payments.instructions")} (AR)
              </label>
              <textarea
                value={draft.bankTransfer.instructionsAr}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    bankTransfer: {
                      ...d.bankTransfer,
                      instructionsAr: e.target.value,
                    },
                  }))
                }
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
