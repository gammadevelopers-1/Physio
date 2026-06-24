"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";
import {
  ProfileSection,
  SecuritySection,
  MasterNotificationToggles,
} from "@/components/settings";
import ScrollableTabBar from "./shared/ScrollableTabBar";
import { useActorRole } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import {
  financeApi,
  type GatewaySettingsView,
  type RefundPolicy,
  type RefundPolicyResponse,
  type RefundGatewayKey,
  type TaxSettings,
  type TaxSettingsResponse,
  type VatTreatmentValue,
} from "@/lib/api";
import Link from "next/link";
import {
  CreditCard,
  FileText,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Save,
  User as UserIcon,
  Lock,
  Bell,
  Building2,
  Copy,
  Check,
  Star,
  Loader2,
  Info,
  ExternalLink,
  Percent,
} from "lucide-react";

const FinanceSettingsContent = () => {
  const t = useTranslations("financeDashboard");
  const profile = useFinanceProfile();

  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { key: "profile",       label: t("settingsPage.tabs.profile"),       icon: UserIcon },
    { key: "security",      label: t("settingsPage.tabs.security"),      icon: Lock },
    { key: "notifications", label: t("settingsPage.tabs.notifications"), icon: Bell },
    { key: "gateways",      label: t("settingsPage.tabs.gateways"),      icon: CreditCard },
    { key: "tax",           label: t("settingsPage.tabs.tax"),           icon: FileText },
    { key: "refundPolicy",  label: t("settingsPage.tabs.refundPolicy"),  icon: Shield },
  ];

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
              </div>

              {/* Settings Card */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {/* Tabs — scroll indicators appear when the strip overflows. */}
                <div className="px-5 border-b border-[var(--color-border)]">
                  <ScrollableTabBar className="flex">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-2.5 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1 ${
                            activeTab === tab.key
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {tab.label}
                          {activeTab === tab.key && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                          )}
                        </button>
                      );
                    })}
                  </ScrollableTabBar>
                </div>

                {/* Tab Content */}
                <div className="p-5">
                  {activeTab === "profile" && (
                    <ProfileSection idPrefix="finance" />
                  )}

                  {activeTab === "security" && (
                    <SecuritySection idPrefix="finance" />
                  )}

                  {activeTab === "notifications" && (
                    <MasterNotificationToggles />
                  )}

                  {activeTab === "gateways" && <GatewaysReadOnlyView />}
                  {activeTab === "tax" && <TaxView />}
                  {activeTab === "refundPolicy" && <RefundPolicyView />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FinanceSettingsContent;

// ─── Gateways: read-only mirror of admin's payments settings ─────────
// Reads `system_settings.payments` via /finance/settings/gateways.
// The backend returns a sanitized projection — never the raw secret
// values — so this component renders presence indicators ("configured")
// alongside the public-by-design fields (publishable keys, bank info).

const GATEWAY_META: Record<
  NonNullable<GatewaySettingsView["activeGateway"]>,
  { color: string; icon: typeof CreditCard }
> = {
  moyasar:       { color: "bg-[#0891B2]", icon: CreditCard },
  tamara:        { color: "bg-[#8B5CF6]", icon: CreditCard },
  tabby:         { color: "bg-[#D97706]", icon: CreditCard },
  bank_transfer: { color: "bg-[#4338CA]", icon: Building2 },
};

export const GatewaysReadOnlyView = () => {
  const t = useTranslations("financeDashboard.settingsPage.gateways");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [data, setData] = useState<GatewaySettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Single-shot fetch on mount. Initial loading=true / error=false from
    // useState; we only flip those once the request resolves.
    let cancelled = false;
    financeApi
      .getGatewaySettings()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be unavailable in some embeddings */
    }
  };

  const webhookUrl = (() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin.replace(
      /physioguidance\.org/,
      "api.physioguidance.org",
    )}/api/payments/webhook`;
  })();

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-[var(--color-surface-page)] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {t("loadError")}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {t("loadErrorHint")}
        </p>
      </div>
    );
  }

  const gatewayCards: Array<{
    key: NonNullable<GatewaySettingsView["activeGateway"]>;
    label: string;
    keyLabel: string;
    keyValue: string | null;
    hasSecret: boolean;
  }> = [
    {
      key: "moyasar",
      label: t("moyasar"),
      keyLabel: t("publishableKey"),
      keyValue: data.moyasar.publishableKey,
      hasSecret: data.moyasar.hasSecret,
    },
    {
      key: "tamara",
      label: t("tamara"),
      keyLabel: t("merchantToken"),
      keyValue: data.tamara.merchantTokenMasked,
      hasSecret: data.tamara.hasSecret,
    },
    {
      key: "tabby",
      label: t("tabby"),
      keyLabel: t("publicKey"),
      keyValue: data.tabby.publicKey,
      hasSecret: data.tabby.hasSecret,
    },
  ];

  const isBankTransferConfigured =
    !!data.bankTransfer.bankNameEn?.trim() ||
    !!data.bankTransfer.bankNameAr?.trim() ||
    !!data.bankTransfer.iban?.trim();

  return (
    <div className="space-y-6">
      {/* Banner — read-only notice */}
      <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-[12px] text-[#1E40AF]">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-[1px]" />
        <span>{t("readOnlyNotice")}</span>
      </div>

      {/* Active gateway summary */}
      <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                data.activeGateway ? GATEWAY_META[data.activeGateway].color : "bg-[var(--color-border)]"
              }`}
            >
              {data.activeGateway ? (
                (() => {
                  const Icon = GATEWAY_META[data.activeGateway].icon;
                  return <Icon className="w-6 h-6 text-white" />;
                })()
              ) : (
                <AlertCircle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
                {t("activeGateway")}
              </p>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">
                {data.activeGateway ? t(data.activeGateway === "bank_transfer" ? "bankTransfer" : data.activeGateway) : t("notSet")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                data.testMode
                  ? "bg-[#FEF9C3] text-[#CA8A04]"
                  : "bg-[#DCFCE7] text-[#15803D]"
              }`}
            >
              {data.testMode ? t("modeTest") : t("modeLive")}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-surface-card)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
              {data.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Per-gateway status grid */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wide">
          {t("gatewaysHeader")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gatewayCards.map((gw) => {
            const meta = GATEWAY_META[gw.key];
            const Icon = meta.icon;
            const isActive = data.activeGateway === gw.key;
            const configured = !!gw.keyValue && gw.hasSecret;
            return (
              <div
                key={gw.key}
                className={`p-4 bg-[var(--color-surface-page)] rounded-xl border ${
                  isActive ? "border-[var(--color-primary)]" : "border-[var(--color-border-subtle)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${meta.color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {gw.label}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <Star className="w-2.5 h-2.5" />
                        {t("active")}
                      </span>
                    )}
                  </div>
                  {configured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                      <CheckCircle className="w-3 h-3" />
                      {t("configured")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#CA8A04]">
                      <AlertCircle className="w-3 h-3" />
                      {t("notConfigured")}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--color-text-secondary)]">{gw.keyLabel}</span>
                    <span className="font-mono text-[var(--color-text-primary)] truncate max-w-[60%]" title={gw.keyValue ?? "—"}>
                      {gw.keyValue ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--color-text-secondary)]">{t("secretKey")}</span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {gw.hasSecret ? `✓ ${t("configured")}` : `— ${t("notConfigured")}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bank Transfer summary card */}
          <div
            className={`p-4 bg-[var(--color-surface-page)] rounded-xl border ${
              data.activeGateway === "bank_transfer" ? "border-[var(--color-primary)]" : "border-[var(--color-border-subtle)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${GATEWAY_META.bank_transfer.color} flex items-center justify-center`}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t("bankTransfer")}
                </span>
                {data.activeGateway === "bank_transfer" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Star className="w-2.5 h-2.5" />
                    {t("active")}
                  </span>
                )}
              </div>
              {isBankTransferConfigured ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                  <CheckCircle className="w-3 h-3" />
                  {t("configured")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#CA8A04]">
                  <AlertCircle className="w-3 h-3" />
                  {t("notConfigured")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-text-secondary)]">{t("bankName")}</span>
                <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[60%]">
                  {(isRTL ? data.bankTransfer.bankNameAr : data.bankTransfer.bankNameEn) || data.bankTransfer.bankNameEn || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-text-secondary)]">{t("iban")}</span>
                <span className="font-mono text-[var(--color-text-primary)] truncate max-w-[60%]">
                  {data.bankTransfer.iban || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank transfer full details */}
      {isBankTransferConfigured && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wide">
            {t("bankDetailsHeader")}
          </h3>
          <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <DetailRow label={t("bankName")} value={data.bankTransfer.bankNameEn} dir="ltr" />
              <DetailRow label={t("bankName")} value={data.bankTransfer.bankNameAr} dir="rtl" />
              <DetailRow label={t("beneficiary")} value={data.bankTransfer.beneficiaryEn} dir="ltr" />
              <DetailRow label={t("beneficiary")} value={data.bankTransfer.beneficiaryAr} dir="rtl" />
              <DetailRow
                label={t("accountNumber")}
                value={data.bankTransfer.accountNumber}
                mono
                copyKey="accountNumber"
                onCopy={copy}
                copied={copied}
              />
              <DetailRow
                label={t("iban")}
                value={data.bankTransfer.iban}
                mono
                copyKey="iban"
                onCopy={copy}
                copied={copied}
              />
              <DetailRow
                label={t("swiftCode")}
                value={data.bankTransfer.swiftCode}
                mono
                copyKey="swiftCode"
                onCopy={copy}
                copied={copied}
              />
            </div>
            {(data.bankTransfer.instructionsEn || data.bankTransfer.instructionsAr) && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {data.bankTransfer.instructionsEn && (
                  <div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                      {t("instructions")} (EN)
                    </p>
                    <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap" dir="ltr">
                      {data.bankTransfer.instructionsEn}
                    </p>
                  </div>
                )}
                {data.bankTransfer.instructionsAr && (
                  <div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                      {t("instructions")} (AR)
                    </p>
                    <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap" dir="rtl">
                      {data.bankTransfer.instructionsAr}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Webhook + Receipts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
              {t("webhook")}
            </p>
            {data.hasWebhookSecret ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                <CheckCircle className="w-3 h-3" />
                {t("secretConfigured")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#CA8A04]">
                <AlertCircle className="w-3 h-3" />
                {t("secretMissing")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono text-[var(--color-text-primary)] bg-[var(--color-surface-card)] rounded px-2 py-1.5 border border-[var(--color-border)] truncate" title={webhookUrl}>
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => copy(webhookUrl, "webhook")}
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-primary)] transition-colors"
              aria-label={t("copy")}
            >
              {copied === "webhook" ? (
                <Check className="w-4 h-4 text-[#16A34A]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
            {t("autoSendReceipt")}
          </p>
          {data.autoSendReceipt ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[#15803D]">
              <CheckCircle className="w-4 h-4" />
              {t("enabled")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <AlertCircle className="w-4 h-4" />
              {t("disabled")}
            </span>
          )}
        </div>
      </div>

      {/* Invoice footer */}
      {(data.invoiceFooterEn || data.invoiceFooterAr) && (
        <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
            {t("invoiceFooter")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.invoiceFooterEn && (
              <div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-1">English</p>
                <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap" dir="ltr">
                  {data.invoiceFooterEn}
                </p>
              </div>
            )}
            {data.invoiceFooterAr && (
              <div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-1">العربية</p>
                <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap" dir="rtl">
                  {data.invoiceFooterAr}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last updated footer */}
      {data.updatedAt && (
        <p className="text-[11px] text-[var(--color-text-secondary)] text-center pt-2 border-t border-[var(--color-border-subtle)]">
          {t("lastUpdatedBy", {
            who: data.updatedBy?.name || t("unknown"),
            when: new Date(data.updatedAt).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
          })}
        </p>
      )}
    </div>
  );
};

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  dir?: "ltr" | "rtl";
  copyKey?: string;
  onCopy?: (text: string, key: string) => void;
  copied?: string | null;
}

const DetailRow = ({ label, value, mono, dir, copyKey, onCopy, copied }: DetailRowProps) => {
  if (!value) return null;
  const showCopy = !!copyKey && !!onCopy;
  return (
    <div>
      <p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span
          className={`flex-1 text-[13px] text-[var(--color-text-primary)] ${mono ? "font-mono" : ""} truncate`}
          dir={dir}
          title={value}
        >
          {value}
        </span>
        {showCopy && (
          <button
            type="button"
            onClick={() => onCopy!(value, copyKey!)}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-primary)] transition-colors"
            aria-label="Copy"
          >
            {copied === copyKey ? (
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Refund Policy: full editor backed by system_settings.refund_policy ───
// Eligibility rules + auto-approve + per-gateway BNPL deduction. Saves
// hit the audit log on the backend; the UI tracks dirty state to keep
// the user from saving accidentally and shows a live policy summary.

const REFUND_GATEWAYS: Array<{
  key: RefundGatewayKey;
  labelKey: string;
  color: string;
  icon: typeof CreditCard;
}> = [
  { key: "moyasar",       labelKey: "moyasar",      color: "bg-[#0891B2]", icon: CreditCard },
  { key: "tamara",        labelKey: "tamara",       color: "bg-[#8B5CF6]", icon: CreditCard },
  { key: "tabby",         labelKey: "tabby",        color: "bg-[#D97706]", icon: CreditCard },
  { key: "bank_transfer", labelKey: "bankTransfer", color: "bg-[#4338CA]", icon: Building2 },
];

const RULE_KEYS = [
  "blockAfterCourseStart",
  "blockAfterAttendance",
  "blockAfterCertificate",
  "blockAfterCmeGranted",
] as const;

export const RefundPolicyView = () => {
  const t = useTranslations("financeDashboard.settingsPage.refundPolicy");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [original, setOriginal] = useState<RefundPolicy | null>(null);
  const [draft, setDraft] = useState<RefundPolicy | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: RefundPolicyResponse["updatedBy"] }>({
    updatedAt: null,
    updatedBy: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .getRefundPolicy()
      .then((res) => {
        if (cancelled) return;
        setOriginal(res.policy);
        setDraft(res.policy);
        setMeta({ updatedAt: res.updatedAt, updatedBy: res.updatedBy });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);

  const setRule = (key: (typeof RULE_KEYS)[number], value: boolean) => {
    setDraft((d) => (d ? { ...d, rules: { ...d.rules, [key]: value } } : d));
  };

  const setGatewayField = (
    gw: RefundGatewayKey,
    field: "deductionPercent" | "partialRefundCapable",
    value: number | boolean,
  ) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            perGateway: {
              ...d.perGateway,
              [gw]: { ...d.perGateway[gw], [field]: value },
            },
          }
        : d,
    );
  };

  const handleSave = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    try {
      const res = await financeApi.updateRefundPolicy(draft);
      setOriginal(res.policy);
      setDraft(res.policy);
      // Refresh meta — server returns who/when via getRefundPolicy
      try {
        const updated = await financeApi.getRefundPolicy();
        setMeta({ updatedAt: updated.updatedAt, updatedBy: updated.updatedBy });
      } catch {
        /* meta refresh is non-fatal */
      }
      toast.success(t("toastSaved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toastSaveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--color-surface-page)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("loadError")}</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("loadErrorHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-[12px] text-[#1E40AF]">
        <Info className="w-4 h-4 flex-shrink-0 mt-[1px]" />
        <span>{t("notice")}</span>
      </div>

      {/* Eligibility rules */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-3">
          {t("rulesHeader")}
        </h3>
        <div className="space-y-3">
          {RULE_KEYS.map((key) => (
            <RuleRow
              key={key}
              label={t(`rules.${key}.label`)}
              description={t(`rules.${key}.description`)}
              note={key === "blockAfterCmeGranted" ? t("rules.blockAfterCmeGranted.note") : undefined}
              enabled={draft.rules[key]}
              onToggle={(v) => setRule(key, v)}
            />
          ))}
        </div>
      </section>

      {/* Auto-approval */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-3">
          {t("autoApproveHeader")}
        </h3>
        <RuleRow
          label={t("autoApprove.label")}
          description={t("autoApprove.description")}
          enabled={draft.autoApproveEligible}
          onToggle={(v) => setDraft((d) => (d ? { ...d, autoApproveEligible: v } : d))}
        />
      </section>

      {/* Gateway deductions */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-1">
          {t("gatewaysHeader")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t("gatewaysHelp")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REFUND_GATEWAYS.map((gw) => {
            const Icon = gw.icon;
            const cfg = draft.perGateway[gw.key];
            return (
              <div key={gw.key} className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${gw.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t(gw.labelKey)}
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                      {t("deductionPercent")}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={cfg.deductionPercent}
                        onChange={(e) =>
                          setGatewayField(
                            gw.key,
                            "deductionPercent",
                            Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          )
                        }
                        className="w-full px-3 py-2 pr-8 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                      />
                      <span className="absolute top-1/2 -translate-y-1/2 right-3 text-xs text-[var(--color-text-secondary)]">%</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.partialRefundCapable}
                      onChange={(e) => setGatewayField(gw.key, "partialRefundCapable", e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-primary)]"
                    />
                    <span className="text-[12px] text-[var(--color-text-primary)]">
                      {t("allowPartial")}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live summary */}
      <section className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-2">
          {t("summaryHeader")}
        </h3>
        <p className="text-[13px] text-[var(--color-text-primary)] mb-2">
          {t("summaryDeniedHeader")}
        </p>
        <ul className="space-y-1 text-[13px] text-[var(--color-text-secondary)] mb-3 ms-4 list-disc">
          {draft.rules.blockAfterCourseStart && <li>{t("summary.courseStart")}</li>}
          {draft.rules.blockAfterAttendance && <li>{t("summary.attendance")}</li>}
          {(draft.rules.blockAfterCertificate || draft.rules.blockAfterCmeGranted) && (
            <li>{t("summary.certificate")}</li>
          )}
          {!draft.rules.blockAfterCourseStart &&
            !draft.rules.blockAfterAttendance &&
            !draft.rules.blockAfterCertificate &&
            !draft.rules.blockAfterCmeGranted && (
              <li className="italic">{t("summary.noRules")}</li>
            )}
        </ul>
        <p className="text-[13px] text-[var(--color-text-primary)] mb-2">{t("summaryReceiveHeader")}</p>
        <ul className="space-y-1 text-[13px] text-[var(--color-text-secondary)] ms-4 list-disc">
          {REFUND_GATEWAYS.map((gw) => {
            const cfg = draft.perGateway[gw.key];
            const pct = 100 - cfg.deductionPercent;
            const tail = cfg.deductionPercent > 0
              ? ` (${cfg.deductionPercent}% ${t("summaryGatewayFee")})`
              : "";
            return (
              <li key={gw.key}>
                <span className="font-medium text-[var(--color-text-primary)]">{t(gw.labelKey)}:</span>{" "}
                {pct}% {t("summaryOfPayment")}{tail}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="text-[11px] text-[var(--color-text-secondary)]">
          {meta.updatedAt
            ? t("lastUpdatedBy", {
                who: meta.updatedBy?.name || t("unknown"),
                when: new Date(meta.updatedAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
              })
            : t("neverSaved")}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
};

const RuleRow = ({
  label,
  description,
  note,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  note?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 p-4 bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-xl">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{description}</p>
      {note && (
        <p className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] mt-1.5">
          <Info className="w-3 h-3" />
          {note}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onToggle(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-[var(--color-primary)]" : "bg-[#D1D5DB]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

// ─── Tax / VAT settings — global config + link to per-product page ─────
// Edits the `system_settings.tax` row. The rate captured here is what
// new invoices will lock in; existing invoices keep their original rate
// via the metadata snapshot taken at payment time.

export const TaxView = () => {
  const t = useTranslations("financeDashboard.settingsPage.tax");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const actorRole = useActorRole();

  const [original, setOriginal] = useState<TaxSettings | null>(null);
  const [draft, setDraft] = useState<TaxSettings | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: TaxSettingsResponse["updatedBy"] }>({
    updatedAt: null,
    updatedBy: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .getTaxSettings()
      .then((res) => {
        if (cancelled) return;
        setOriginal(res.settings);
        setDraft(res.settings);
        setMeta({ updatedAt: res.updatedAt, updatedBy: res.updatedBy });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);

  const handleSave = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    try {
      const res = await financeApi.updateTaxSettings(draft);
      setOriginal(res.settings);
      setDraft(res.settings);
      try {
        const updated = await financeApi.getTaxSettings();
        setMeta({ updatedAt: updated.updatedAt, updatedBy: updated.updatedBy });
      } catch {
        /* non-fatal */
      }
      toast.success(t("toastSaved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toastSaveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Live preview math — never let AR locale rewrite numbers (project rule).
  const preview = useMemo(() => {
    if (!draft) return null;
    const base = 100;
    if (!draft.vatEnabled || draft.defaultVatTreatment === "exempt") {
      return { base, rate: 0, vat: 0, total: base, treatmentLabel: t(`treatments.${draft?.defaultVatTreatment || "exempt"}`) };
    }
    if (draft.defaultVatTreatment === "zero_rated") {
      return { base, rate: 0, vat: 0, total: base, treatmentLabel: t("treatments.zero_rated") };
    }
    const vat = Number((base * (draft.vatRate / 100)).toFixed(2));
    return { base, rate: draft.vatRate, vat, total: Number((base + vat).toFixed(2)), treatmentLabel: t("treatments.standard") };
  }, [draft, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--color-surface-page)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !draft || !preview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("loadError")}</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("loadErrorHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-[12px] text-[#1E40AF]">
        <Info className="w-4 h-4 flex-shrink-0 mt-[1px]" />
        <span>{t("notice")}</span>
      </div>

      {/* Global tax settings */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-3">
          {t("globalHeader")}
        </h3>
        <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("vatEnabled")}</p>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t("vatEnabledHelp")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.vatEnabled}
              onClick={() => setDraft((d) => (d ? { ...d, vatEnabled: !d.vatEnabled } : d))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                draft.vatEnabled ? "bg-[var(--color-primary)]" : "bg-[#D1D5DB]"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${draft.vatEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                {t("vatRate")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft.vatRate}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            vatRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          }
                        : d,
                    )
                  }
                  disabled={!draft.vatEnabled}
                  className="w-full px-3 py-2 pr-8 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                />
                <Percent className="absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                {t("taxNumber")}
              </label>
              <input
                type="text"
                maxLength={50}
                value={draft.taxNumber}
                onChange={(e) => setDraft((d) => (d ? { ...d, taxNumber: e.target.value } : d))}
                placeholder="3xxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                {t("companyNameEn")}
              </label>
              <input
                type="text"
                maxLength={255}
                value={draft.companyNameEn}
                onChange={(e) => setDraft((d) => (d ? { ...d, companyNameEn: e.target.value } : d))}
                dir="ltr"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">
                {t("companyNameAr")}
              </label>
              <input
                type="text"
                maxLength={255}
                value={draft.companyNameAr}
                onChange={(e) => setDraft((d) => (d ? { ...d, companyNameAr: e.target.value } : d))}
                dir="rtl"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
              {t("defaultTreatment")}
            </label>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-2">{t("defaultTreatmentHelp")}</p>
            <div className="flex flex-wrap gap-2">
              {(["standard", "exempt", "zero_rated"] as VatTreatmentValue[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft((d) => (d ? { ...d, defaultVatTreatment: v } : d))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    draft.defaultVatTreatment === v
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-text-secondary)]"
                  }`}
                >
                  {t(`treatments.${v}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-3">
          {t("previewHeader")}
        </h3>
        <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
          {t("previewSubtitle", { treatment: preview.treatmentLabel })}
        </p>
        <div className="bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] p-4 max-w-sm space-y-1.5">
          <PreviewLine label={t("previewSubtotal")} value={`SAR ${preview.base.toFixed(2)}`} />
          <PreviewLine label={`${t("previewVat")} (${preview.rate}%)`} value={`SAR ${preview.vat.toFixed(2)}`} />
          <div className="border-t border-[var(--color-border-subtle)] my-2" />
          <PreviewLine label={t("previewTotal")} value={`SAR ${preview.total.toFixed(2)}`} bold />
        </div>
      </section>

      {/* Per-product treatment link */}
      <section className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("perProductHeader")}</h3>
          <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t("perProductHelp")}</p>
        </div>
        <Link
          href={financePath(actorRole, locale, "settings/tax-treatments")}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 rounded-lg transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("perProductCta")}
        </Link>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="text-[11px] text-[var(--color-text-secondary)]">
          {meta.updatedAt
            ? t("lastUpdatedBy", {
                who: meta.updatedBy?.name || t("unknown"),
                when: new Date(meta.updatedAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
              })
            : t("neverSaved")}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
};

const PreviewLine = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex items-center justify-between text-sm ${bold ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
    <span>{label}</span>
    <span className="font-mono" dir="ltr">{value}</span>
  </div>
);

