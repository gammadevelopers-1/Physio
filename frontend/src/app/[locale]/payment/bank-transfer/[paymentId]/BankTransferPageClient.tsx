"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Copy,
  Check,
  Upload,
  FileText,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronRight,
  ChevronLeft,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  bankTransferApi,
  type BankTransferDetails,
  type BankTransferPayment,
  ApiError,
} from "@/lib/api";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";

interface BankTransferPageClientProps {
  siteSettings: SiteSettings | null;
  navbarLinks: NavigationLink[];
  footerLinks: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

// Major KSA banks for the dropdown. "other" fallback lets the student type a
// free-text bank name if theirs isn't listed (recorded as-typed in DB).
const KSA_BANKS_EN = [
  "Al Rajhi Bank",
  "Saudi National Bank (SNB / Al-Ahli)",
  "Riyad Bank",
  "Banque Saudi Fransi",
  "SABB",
  "Arab National Bank",
  "Alinma Bank",
  "Bank Albilad",
  "Bank Aljazira",
  "Saudi Investment Bank",
  "Other",
];

const KSA_BANKS_AR = [
  "مصرف الراجحي",
  "البنك الأهلي السعودي",
  "بنك الرياض",
  "البنك السعودي الفرنسي",
  "البنك السعودي البريطاني (ساب)",
  "البنك العربي الوطني",
  "مصرف الإنماء",
  "بنك البلاد",
  "بنك الجزيرة",
  "البنك السعودي للاستثمار",
  "بنك آخر",
];

const MAX_BYTES = Math.floor(15.63 * 1024 * 1024);
const ACCEPT_EXT = ".pdf,.jpg,.jpeg,.png";
const ACCEPT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

export default function BankTransferPageClient({
  siteSettings,
  navbarLinks,
  footerLinks,
}: BankTransferPageClientProps) {
  const { paymentId } = useParams<{ paymentId: string }>();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("bankTransfer");
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankTransferDetails | null>(null);
  const [paymentData, setPaymentData] = useState<BankTransferPayment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [refundHolder, setRefundHolder] = useState("");
  const [refundIban, setRefundIban] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundBankOther, setRefundBankOther] = useState("");
  const [refundNationalId, setRefundNationalId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Load bank details + payment in parallel.
  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      bankTransferApi.getDetails(),
      bankTransferApi.getPayment(paymentId),
    ])
      .then(([details, payment]) => {
        if (cancelled) return;
        setBankDetails(details);
        setPaymentData(payment);

        // If the payment is already paid, send the buyer straight to success.
        if (payment.payment.status === "paid") {
          router.replace(`/${locale}/payment/success?paymentId=${paymentId}`);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : t("loadError");
        setLoadError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId, locale, router, t]);

  const amountDue = useMemo(() => {
    if (!paymentData) return null;
    return Number(paymentData.payment.amount);
  }, [paymentData]);

  const courseTitle = paymentData?.course?.title || t("course");

  // True when an active receipt is already under review by finance. In this
  // state we hide the upload + refund form + submit button to prevent
  // duplicate uploads. The student can still see the pending banner, bank
  // details, and the proforma download. Re-upload is only allowed after the
  // receipt is rejected.
  const isPendingReview =
    paymentData?.activeReceipt?.reviewStatus === "pending";

  // Download a branded proforma invoice (PDF) summarising what the student is
  // about to pay for. Useful for sending to a finance department / employer for
  // reimbursement before the actual payment is made.
  const [proformaLoading, setProformaLoading] = useState(false);
  const handleDownloadProforma = useCallback(async () => {
    if (!paymentId || proformaLoading) return;
    setProformaLoading(true);
    try {
      const blob = await bankTransferApi.downloadProforma(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proforma-${paymentId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("proforma.downloadFailed"),
      );
    } finally {
      setProformaLoading(false);
    }
  }, [paymentId, proformaLoading, t]);

  const handleFileSelect = useCallback(
    (file: File | null) => {
      setFileError(null);
      if (!file) {
        setSelectedFile(null);
        return;
      }
      if (!ACCEPT_MIME.includes(file.type)) {
        setFileError(t("file.invalidType"));
        return;
      }
      if (file.size > MAX_BYTES) {
        setFileError(t("file.tooLarge"));
        return;
      }
      setSelectedFile(file);
    },
    [t],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedFile) {
      setFormError(t("errors.fileRequired"));
      return;
    }
    if (refundHolder.trim().length < 2) {
      setFormError(t("errors.accountHolderRequired"));
      return;
    }
    // Normalize IBAN — strip spaces, uppercase. KSA: SA + 22 digits = 24 chars.
    const iban = refundIban.replace(/\s+/g, "").toUpperCase();
    if (!/^SA\d{22}$/.test(iban)) {
      setFormError(t("errors.ibanInvalid"));
      return;
    }
    const bankNameForSubmit =
      refundBank === "Other" || refundBank === "بنك آخر"
        ? refundBankOther.trim()
        : refundBank.trim();
    if (!bankNameForSubmit) {
      setFormError(t("errors.bankRequired"));
      return;
    }
    if (refundNationalId && !/^\d{10,15}$/.test(refundNationalId.trim())) {
      setFormError(t("errors.nationalIdInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      await bankTransferApi.uploadReceipt(paymentId, selectedFile, {
        refundAccountHolder: refundHolder.trim(),
        refundIban: iban,
        refundBankName: bankNameForSubmit,
        refundNationalId: refundNationalId.trim() || undefined,
      });
      toast.success(t("success.uploaded"));
      router.replace(`/${locale}/payment/success?paymentId=${paymentId}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("errors.uploadFailed");
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <Navbar
          siteSettings={siteSettings}
          navLinks={navbarLinks}
          footerLinks={footerLinks}
        />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--on-surface-variant)]" />
        </main>
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    );
  }

  if (loadError || !paymentData || !bankDetails) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <Navbar
          siteSettings={siteSettings}
          navLinks={navbarLinks}
          footerLinks={footerLinks}
        />
        <main
          className="flex-1 flex items-center justify-center px-4"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">{t("errorTitle")}</h1>
            <p className="text-[var(--on-surface-variant)] mb-6">
              {loadError || t("loadError")}
            </p>
            <Link
              href={`/${locale}/courses`}
              className="inline-flex items-center gap-2 btn-gold px-6 py-3 rounded-xl text-white font-medium focus-ring"
            >
              {t("backToCourses")}
            </Link>
          </div>
        </main>
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    );
  }

  const meta = paymentData.payment.metadata as
    | {
        subtotal?: number;
        discountAmount?: number;
        saleDiscountAmount?: number;
        taxAmount?: number;
        originalPrice?: number;
      }
    | null;

  const subtotal = Number(meta?.subtotal ?? amountDue ?? 0);
  const originalPrice = Number(meta?.originalPrice ?? subtotal);
  const saleDiscount = Number(meta?.saleDiscountAmount ?? 0);
  const discountAmount = Number(meta?.discountAmount ?? 0);
  const taxAmount = Number(meta?.taxAmount ?? 0);
  const total = Number(amountDue ?? 0);
  const currency = paymentData.payment.currency;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />

      <main
        id="main-content"
        className="flex-1 px-4 py-6 md:px-16 md:py-8"
        dir={isRTL ? "rtl" : "ltr"}
        aria-label={t("pageTitle")}
      >
        {/* Breadcrumb */}
        <nav
          aria-label={isRTL ? "مسار التنقل" : "Breadcrumb"}
          className="flex items-center gap-2 text-sm mb-6"
        >
          <Link
            href={`/${locale}`}
            className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded"
          >
            {isRTL ? "الرئيسية" : "Home"}
          </Link>
          {isRTL ? (
            <ChevronLeft size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
          )}
          <Link
            href={`/${locale}/courses`}
            className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded"
          >
            {isRTL ? "الدورات" : "Courses"}
          </Link>
          {isRTL ? (
            <ChevronLeft size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
          )}
          <span className="text-[var(--on-surface-default)] font-medium" aria-current="page">
            {t("breadcrumb")}
          </span>
        </nav>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col lg:flex-row gap-6 max-w-[1280px] mx-auto">
            {/* ─── LEFT: Application Summary ──────────────────────────── */}
            <aside className="w-full lg:w-[360px] lg:flex-shrink-0">
              <div className="bg-white rounded-2xl p-6 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-[#071437] mb-4">
                  {t("summary.title")}
                </h2>

                <div className="space-y-2 text-sm">
                  <Row label={courseTitle} value={fmt(originalPrice, currency)} />
                  {saleDiscount > 0 && (
                    <Row
                      label={t("summary.sale")}
                      value={`- ${fmt(saleDiscount, currency)}`}
                      tone="green"
                    />
                  )}
                  {discountAmount > 0 && (
                    <Row
                      label={t("summary.discount")}
                      value={`- ${fmt(discountAmount, currency)}`}
                      tone="green"
                    />
                  )}
                  <Row label={t("summary.beforeTax")} value={fmt(subtotal - discountAmount, currency)} />
                  <Row label={t("summary.vat")} value={fmt(taxAmount, currency)} />
                  <div className="border-t border-[#e5e5e5] my-2" />
                  <Row
                    label={t("summary.amountDue")}
                    value={fmt(total, currency)}
                    emphasis
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDownloadProforma}
                  disabled={proformaLoading}
                  className="mt-5 w-full h-10 rounded-lg border border-[#005bd3] text-[#005bd3] text-sm font-medium hover:bg-[#EFF6FF] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus-ring"
                >
                  {proformaLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{t("proforma.download")}</span>
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--on-surface-variant)]">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t("summary.secure")}</span>
                </div>
              </div>
            </aside>

            {/* ─── RIGHT: Payment ───────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
                <h1 className="text-xl font-semibold text-[#071437] mb-1">
                  {t("payment.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mb-6">
                  {t("payment.subtitle")}
                </p>

                {/* Method selector (Credit Card | Bank Transfer) */}
                <div role="radiogroup" aria-label={t("payment.method")} className="flex flex-col gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/checkout?expressCourseId=${paymentData.payment.courseId}`)}
                    className="border border-[#e5e5e5] rounded-xl p-4 flex items-center justify-between hover:border-[var(--on-surface-variant)] transition-colors text-start focus-ring"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[#d5d7da] bg-white" aria-hidden="true" />
                      <CreditCard className="w-5 h-5 text-[var(--on-surface-variant)]" aria-hidden="true" />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        {t("method.creditCard")}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {t("method.switchBack")}
                    </span>
                  </button>

                  <div className="border-2 border-[#005bd3] rounded-xl p-4 bg-[#F0F7FF]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-[18px] h-[18px] rounded-full bg-white border-[6px] border-[#005bd3]" aria-hidden="true" />
                        <Building2 className="w-5 h-5 text-[#005bd3]" aria-hidden="true" />
                        <span className="font-medium text-[#005bd3]">
                          {t("method.bankTransfer")}
                        </span>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-[#005bd3]" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                {/* Already-uploaded notice */}
                {paymentData.activeReceipt && (
                  <ActiveReceiptNotice
                    receipt={paymentData.activeReceipt}
                    t={t}
                    locale={locale}
                  />
                )}

                {/* Bank details */}
                <BankDetailsCard
                  details={bankDetails}
                  amountDue={total}
                  currency={currency}
                  isRTL={isRTL}
                  t={t}
                />

                {/* Receipt upload — hidden when a receipt is already under review
                    so the student can't accidentally upload a duplicate. They can
                    still re-upload after a rejection. */}
                {!isPendingReview && (
                  <section className="mt-6">
                    <h3 className="text-sm font-semibold text-[var(--on-surface-default)] mb-3">
                      {t("upload.title")}
                    </h3>
                    <ReceiptUploadDropzone
                      file={selectedFile}
                      onFileChange={handleFileSelect}
                      error={fileError}
                      isRTL={isRTL}
                      t={t}
                    />
                  </section>
                )}

                {/* Refund info — also hidden while a receipt is pending review. */}
                {!isPendingReview && (
                <section className="mt-6 pt-6 border-t border-[#e5e5e5]">
                  <h3 className="text-sm font-semibold text-[var(--on-surface-default)] mb-1">
                    {t("refund.title")}
                  </h3>
                  <p className="text-xs text-[var(--on-surface-variant)] mb-4">
                    {t("refund.subtitle")}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t("refund.accountHolder")} required>
                      <input
                        type="text"
                        value={refundHolder}
                        onChange={(e) => setRefundHolder(e.target.value)}
                        placeholder={isRTL ? "محمد عبدالله" : "Mohammed Abdullah"}
                        className="w-full h-11 px-3 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#005bd3]"
                        autoComplete="name"
                      />
                    </Field>

                    <Field label={t("refund.bank")} required>
                      <select
                        value={refundBank}
                        onChange={(e) => setRefundBank(e.target.value)}
                        className="w-full h-11 px-3 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#005bd3] bg-white"
                      >
                        <option value="">{t("refund.bankPlaceholder")}</option>
                        {(isRTL ? KSA_BANKS_AR : KSA_BANKS_EN).map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {(refundBank === "Other" || refundBank === "بنك آخر") && (
                      <Field label={t("refund.bankOther")} required>
                        <input
                          type="text"
                          value={refundBankOther}
                          onChange={(e) => setRefundBankOther(e.target.value)}
                          placeholder={t("refund.bankOtherPlaceholder")}
                          className="w-full h-11 px-3 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#005bd3]"
                        />
                      </Field>
                    )}

                    <Field
                      label={t("refund.iban")}
                      required
                      hint={t("refund.ibanHint")}
                      className={
                        refundBank === "Other" || refundBank === "بنك آخر"
                          ? "md:col-span-2"
                          : ""
                      }
                    >
                      <input
                        type="text"
                        value={refundIban}
                        onChange={(e) => setRefundIban(e.target.value.toUpperCase())}
                        placeholder="SA0000000000000000000000"
                        dir="ltr"
                        className="w-full h-11 px-3 border border-[#e5e5e5] rounded-lg text-sm font-mono focus:outline-none focus:border-[#005bd3]"
                        maxLength={29}
                      />
                    </Field>

                    <Field
                      label={t("refund.nationalId")}
                      hint={t("refund.nationalIdHint")}
                    >
                      <input
                        type="text"
                        value={refundNationalId}
                        onChange={(e) => setRefundNationalId(e.target.value.replace(/\D/g, ""))}
                        placeholder="1010101010"
                        dir="ltr"
                        className="w-full h-11 px-3 border border-[#e5e5e5] rounded-lg text-sm font-mono focus:outline-none focus:border-[#005bd3]"
                        maxLength={15}
                      />
                    </Field>
                  </div>
                </section>
                )}

                {/* Errors */}
                {formError && (
                  <div role="alert" className="mt-6 bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-[#DC2626] text-sm">{formError}</p>
                  </div>
                )}

                {/* Submit — hidden while a receipt is pending review. */}
                {!isPendingReview && (
                  <>
                    <button
                      type="submit"
                      disabled={submitting || !selectedFile}
                      aria-busy={submitting}
                      className="w-full mt-6 h-12 rounded-xl text-white font-medium btn-gold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span>{t("submitting")}</span>
                        </>
                      ) : (
                        <span>{t("submit")}</span>
                      )}
                    </button>

                    <p className="text-xs text-[var(--on-surface-variant)] mt-3 text-center">
                      {t.rich("terms", {
                        link: (chunks) => (
                          <Link
                            href={`/${locale}/legal/terms`}
                            className="text-[#005bd3] hover:underline"
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations<"bankTransfer">>;

function Row({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "green";
  emphasis?: boolean;
}) {
  const color = tone === "green" ? "text-green-600" : "text-[var(--on-surface-default)]";
  return (
    <div className="flex justify-between items-center">
      <span className={`${emphasis ? "font-semibold" : "text-[var(--on-surface-variant)]"} ${tone === "green" ? "text-green-600" : ""}`}>
        {label}
      </span>
      <span className={`${emphasis ? "font-semibold text-base" : "font-medium"} ${color}`}>
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[var(--on-surface-default)] mb-1.5">
        {label}
        {required && <span className="text-red-500 ms-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-[var(--on-surface-variant)] mt-1">{hint}</p>
      )}
    </div>
  );
}

function BankDetailsCard({
  details,
  amountDue,
  currency,
  isRTL,
  t,
}: {
  details: BankTransferDetails;
  amountDue: number;
  currency: string;
  isRTL: boolean;
  t: TFn;
}) {
  const bankName = isRTL ? details.bankNameAr || details.bankNameEn : details.bankNameEn || details.bankNameAr;
  const instructions = isRTL
    ? details.instructionsAr || details.instructionsEn
    : details.instructionsEn || details.instructionsAr;

  return (
    <section className="rounded-xl border border-[#E5E7EB] p-4 md:p-5 bg-[#FAFBFC]">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-5 h-5 text-[#005bd3]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[var(--on-surface-default)]">
          {t("bankDetails.title")}
        </h3>
      </div>

      {instructions && (
        <p className="text-sm text-[var(--on-surface-variant)] mb-4">
          {instructions}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {details.beneficiaryAr && (
          <CopyableField
            label={t("bankDetails.beneficiaryAr")}
            value={details.beneficiaryAr}
            dir="rtl"
          />
        )}
        <CopyableField
          label={t("bankDetails.amount")}
          value={`${currency} ${amountDue.toFixed(2)}`}
        />
        <CopyableField
          label={t("bankDetails.beneficiaryEn")}
          value={details.beneficiaryEn}
        />
        {details.accountNumber && (
          <CopyableField
            label={t("bankDetails.accountNumber")}
            value={details.accountNumber}
            mono
          />
        )}
        {bankName && (
          <CopyableField label={t("bankDetails.bankName")} value={bankName} />
        )}
        {details.iban && (
          <CopyableField
            label={t("bankDetails.iban")}
            value={details.iban}
            mono
            className="md:col-span-2"
          />
        )}
        {details.swiftCode && (
          <CopyableField
            label={t("bankDetails.swift")}
            value={details.swiftCode}
            mono
          />
        )}
      </div>
    </section>
  );
}

function CopyableField({
  label,
  value,
  mono,
  dir,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  dir?: "ltr" | "rtl";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--on-surface-variant)] mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-lg pe-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 p-2.5 text-[var(--on-surface-variant)] hover:text-[#005bd3] focus-ring rounded"
          aria-label={copied ? "Copied" : `Copy ${label}`}
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? (
            <Check className="w-4 h-4 text-[#22C55E]" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
        <span
          className={`flex-1 min-w-0 truncate text-sm text-[var(--on-surface-default)] py-2.5 ${mono ? "font-mono" : ""}`}
          dir={dir}
          title={value}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function ReceiptUploadDropzone({
  file,
  onFileChange,
  error,
  isRTL,
  t,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  error: string | null;
  isRTL: boolean;
  t: TFn;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileChange(f);
  };

  if (file) {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-6 h-6 text-[#005bd3]" aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--on-surface-default)] truncate">
              {file.name}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <div className="flex items-center gap-1">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-[var(--on-surface-variant)] hover:text-[#005bd3] focus-ring rounded"
                aria-label={t("file.preview")}
                title={t("file.preview")}
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="p-2 text-[var(--on-surface-variant)] hover:text-red-500 focus-ring rounded"
              aria-label={t("file.remove")}
              title={t("file.remove")}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-2" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`block rounded-xl border-2 border-dashed transition-colors cursor-pointer p-8 text-center ${
          dragOver
            ? "border-[#005bd3] bg-[#F0F7FF]"
            : "border-[#E5E7EB] bg-[#FAFBFC] hover:border-[#005bd3]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXT}
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center">
            <Upload className="w-5 h-5 text-[#005bd3]" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--on-surface-default)]">
            {t("upload.cta")}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("upload.limits")}
          </p>
        </div>
      </label>
      {error && (
        <p className="text-xs text-red-500 mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ActiveReceiptNotice({
  receipt,
  t,
  locale,
}: {
  receipt: NonNullable<BankTransferPayment["activeReceipt"]>;
  t: TFn;
  locale: string;
}) {
  if (receipt.reviewStatus === "rejected") {
    return (
      <div className="mb-6 bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#991B1B]">
              {t("activeReceipt.rejectedTitle")}
            </p>
            <p className="text-sm text-[#7F1D1D] mt-1">
              {receipt.reviewerNote || t("activeReceipt.rejectedFallback")}
            </p>
            <p className="text-xs text-[#7F1D1D] mt-2 opacity-80">
              {t("activeReceipt.uploadedAt", {
                when: new Date(receipt.uploadedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US"),
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#005bd3] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1E40AF]">
            {t("activeReceipt.pendingTitle")}
          </p>
          <p className="text-sm text-[#1E3A8A] mt-1">
            {t("activeReceipt.pendingBody")}
          </p>
          <p className="text-xs text-[#1E3A8A] mt-2 opacity-80">
            {t("activeReceipt.uploadedAt", {
              when: new Date(receipt.uploadedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US"),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number, currency: string): string {
  return `${currency} ${n.toFixed(2)}`;
}
