"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import ReCAPTCHA from "react-google-recaptcha";
import {
  X,
  Mail,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
  ChevronRight,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  trainerApplicationsPortalApi,
  type PortalApplicationStatus,
  type RoleRequestStatus,
  type RoleRequestEvent,
  type MissingRequirement,
} from "@/lib/api";
import SaudiPhoneInput from "../shared/SaudiPhoneInput";
import {
  localPartFromStored,
  normalizeSaudiMobile,
} from "@/lib/saudi-phone";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

const STATUS_ICONS: Record<RoleRequestStatus, LucideIcon> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  MORE_INFO: AlertTriangle,
};

const STATUS_TONES: Record<
  RoleRequestStatus,
  { color: string; bg: string; ring: string }
> = {
  PENDING: {
    color: "text-[#1D4ED8]",
    bg: "bg-[#DBEAFE]",
    ring: "ring-[#BFDBFE]",
  },
  APPROVED: {
    color: "text-[#16A34A]",
    bg: "bg-[#DCFCE7]",
    ring: "ring-[#BBF7D0]",
  },
  REJECTED: {
    color: "text-[#DC2626]",
    bg: "bg-[#FEE2E2]",
    ring: "ring-[#FCA5A5]",
  },
  MORE_INFO: {
    color: "text-[#B45309]",
    bg: "bg-[#FEF3C7]",
    ring: "ring-[#FDE68A]",
  },
};

type PortalStep = "idle" | "email" | "otp" | "status";

export default function BecomeTrainerPortal() {
  const t = useTranslations("trainerPortal");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // ── Flow state ──────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PortalStep>("idle");

  // ── OTP form state ──────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [otp, setOtp] = useState("");
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // ── Status state ─────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(null);
  const [application, setApplication] = useState<PortalApplicationStatus | null>(
    null,
  );

  const openPortal = () => {
    setOpen(true);
    setStep("email");
  };

  const closePortal = () => {
    setOpen(false);
    setStep("idle");
    setEmail("");
    setOtp("");
    setRecaptchaToken(null);
    recaptchaRef.current?.reset();
    setToken(null);
    setApplication(null);
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("errors.emailRequired"));
      return;
    }
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      toast.error(t("errors.captchaRequired"));
      return;
    }
    setRequestingOtp(true);
    try {
      await trainerApplicationsPortalApi.requestOtp({
        email: email.trim(),
        recaptchaToken: recaptchaToken ?? undefined,
        locale,
      });
      toast.success(t("toasts.otpSent"));
      setStep("otp");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errors.otpSendFailed"),
      );
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error(t("errors.otpInvalid"));
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await trainerApplicationsPortalApi.verifyOtp({
        email: email.trim(),
        code: otp,
      });
      setToken(res.token);
      setApplication(res.application);
      setStep("status");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errors.otpVerifyFailed"),
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const refreshStatus = async () => {
    if (!token) return;
    try {
      const next = await trainerApplicationsPortalApi.status(token);
      setApplication(next);
    } catch {
      // Token may have expired — bring them back to the email step.
      toast.error(t("errors.sessionExpired"));
      setStep("email");
      setToken(null);
    }
  };

  return (
    <>
      {/* Banner — sits at the top of the apply page. Tasteful, not loud. */}
      <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t("banner.alreadyApplied")}
            </span>
          </div>
          <button
            type="button"
            onClick={openPortal}
            className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-full bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            {t("banner.checkStatus")}
            <ChevronRight
              className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <PortalModal onClose={closePortal} title={t("modal.title")}>
          {step === "email" && (
            <EmailStep
              email={email}
              setEmail={setEmail}
              recaptchaRef={recaptchaRef}
              setRecaptchaToken={setRecaptchaToken}
              requestingOtp={requestingOtp}
              onSubmit={handleRequestOtp}
              t={t}
            />
          )}

          {step === "otp" && (
            <OtpStep
              email={email}
              otp={otp}
              setOtp={setOtp}
              verifyingOtp={verifyingOtp}
              onSubmit={handleVerifyOtp}
              onResend={() => setStep("email")}
              t={t}
            />
          )}

          {step === "status" && application && (
            <StatusPanel
              application={application}
              token={token}
              locale={locale}
              onRefresh={refreshStatus}
              t={t}
            />
          )}
        </PortalModal>
      )}
    </>
  );
}

// ─── Modal frame ────────────────────────────────────────────

function PortalModal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  // Close on ESC for keyboard users.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 bg-white border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)]"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Step 1: enter email ───────────────────────────────────

function EmailStep({
  email,
  setEmail,
  recaptchaRef,
  setRecaptchaToken,
  requestingOtp,
  onSubmit,
  t,
}: {
  email: string;
  setEmail: (v: string) => void;
  recaptchaRef: React.RefObject<ReCAPTCHA | null>;
  setRecaptchaToken: (v: string | null) => void;
  requestingOtp: boolean;
  onSubmit: (e: FormEvent) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("emailStep.intro")}
      </p>
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
          {t("emailStep.label")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailStep.placeholder")}
          required
          autoFocus
          className="w-full h-11 px-3 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
        />
      </div>
      {RECAPTCHA_SITE_KEY && (
        <div className="flex justify-center">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            onChange={(token) => setRecaptchaToken(token)}
            onExpired={() => setRecaptchaToken(null)}
          />
        </div>
      )}
      <button
        type="submit"
        disabled={requestingOtp}
        className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {requestingOtp ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {t("emailStep.submit")}
      </button>
    </form>
  );
}

// ─── Step 2: enter OTP ───────────────────────────────────

function OtpStep({
  email,
  otp,
  setOtp,
  verifyingOtp,
  onSubmit,
  onResend,
  t,
}: {
  email: string;
  otp: string;
  setOtp: (v: string) => void;
  verifyingOtp: boolean;
  onSubmit: (e: FormEvent) => void;
  onResend: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("otpStep.intro", { email })}
      </p>
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
          {t("otpStep.label")}
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]{6}"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
          required
          className="w-full h-11 px-3 text-lg tracking-[0.6em] text-center font-mono border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
        />
      </div>
      <button
        type="submit"
        disabled={verifyingOtp || otp.length !== 6}
        className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t("otpStep.verify")}
      </button>
      <button
        type="button"
        onClick={onResend}
        className="block w-full text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
      >
        {t("otpStep.resend")}
      </button>
    </form>
  );
}

// ─── Step 3: status display + (optional) resubmit form ─

function StatusPanel({
  application,
  token,
  locale,
  onRefresh,
  t,
}: {
  application: PortalApplicationStatus;
  token: string | null;
  locale: string;
  onRefresh: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!application.found) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#FEF3C7] flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5 text-[#B45309]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          {t("status.notFound.title")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("status.notFound.body")}
        </p>
      </div>
    );
  }

  const { request, events, isPlaceholder } = application;
  const tone = STATUS_TONES[request.status];
  const Icon = STATUS_ICONS[request.status];

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className={`rounded-2xl p-5 ring-1 ${tone.bg} ${tone.ring}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">

            <Icon className={`w-6 h-6 ${tone.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-bold ${tone.color} mb-1`}>
              {t(`status.${request.status}.title`)}
            </h3>
            <p className="text-sm text-[var(--color-text-primary)] opacity-80 leading-relaxed">
              {t(`status.${request.status}.body`)}
            </p>
            <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
              {t("status.submittedOn")}: {formatDate(request.submittedAt, locale)}
            </div>
          </div>
        </div>

        {request.status === "APPROVED" && (
          <div className="mt-4 pt-4 border-t border-current opacity-20" />
        )}
        {request.status === "APPROVED" && (
          <div className="mt-4">
            {isPlaceholder ? (
              <p className="text-sm text-[var(--color-text-primary)]">
                {t("status.APPROVED.checkEmail")}
              </p>
            ) : (
              <a
                href={`/${locale}/signin`}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 ${tone.color} bg-white text-sm font-semibold rounded-lg hover:shadow-md transition-shadow`}
              >
                {t("status.APPROVED.loginCta")}
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Reviewer note (latest) */}
      {request.reviewNote && (
        <div className="bg-[var(--color-surface-page)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
            {t("status.reviewerNote")}
          </div>
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
            {request.reviewNote}
          </p>
        </div>
      )}

      {/* Missing requirements (MORE_INFO) */}
      {request.status === "MORE_INFO" &&
        request.missingRequirements &&
        request.missingRequirements.length > 0 && (
          <MissingReqsList items={request.missingRequirements} t={t} />
        )}

      {/* Activity timeline */}
      {events.length > 0 && <Timeline events={events} locale={locale} t={t} />}

      {/* Support link — always available */}
      <div className="text-center">
        <a
          href={`/${locale}/support`}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
        >
          {t("status.contactSupport")}
        </a>
      </div>

      {/* Resubmit form — only for MORE_INFO */}
      {request.status === "MORE_INFO" && token && request.prefill && (
        <ResubmitForm
          token={token}
          roleRequestId={request.id}
          prefill={request.prefill}
          missing={request.missingRequirements ?? null}
          locale={locale}
          onSuccess={onRefresh}
          t={t}
        />
      )}
    </div>
  );
}

function MissingReqsList({
  items,
  t,
}: {
  items: MissingRequirement[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="border border-[#FDE68A] bg-[#FFFBEB] rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
        <span className="text-[11px] uppercase tracking-wide font-semibold text-[#92400E]">
          {t("status.missingReqsTitle")}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-[#7C2D12]">
            <div className="font-medium">{missingReqLabel(item, t)}</div>
            {item.note && (
              <div className="text-[11px] italic mt-0.5">{item.note}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timeline({
  events,
  locale,
  t,
}: {
  events: RoleRequestEvent[];
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mb-2">
        {t("status.activity")}
      </div>
      <ol className="relative ps-3 space-y-3">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          return (
            <li key={event.id} className="relative">
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute -start-[2px] top-[14px] -bottom-3 w-px bg-[var(--color-border)]"
                />
              )}
              <span
                className="absolute -start-[7px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] ring-2 ring-white"
              />
              <div className="ms-3">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {t(`events.${event.action}`)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">
                  {formatDate(event.createdAt, locale)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Inline resubmit (focused fields + file uploads) ────

type Prefill = {
  profileData: Record<string, unknown>;
  bankData: Record<string, unknown> | null;
  resumeFiles: Array<{ type: string; url: string; filename: string }> | null;
  structuredResume: Record<string, unknown> | null;
};

function ResubmitForm({
  token,
  roleRequestId,
  prefill,
  missing,
  locale,
  onSuccess,
  t,
}: {
  token: string;
  roleRequestId: string;
  prefill: Prefill;
  missing: MissingRequirement[] | null;
  locale: string;
  onSuccess: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  // Mirror the original form's profileData into local editable state.
  // Only the most-edited fields are exposed inline — admins typically
  // ask for specific docs or contact-info updates; everything else
  // keeps the original value via the prefill spread on submit.
  const profile = prefill.profileData as Record<string, string>;
  const [profileEdits, setProfileEdits] = useState({
    fullNameEnglish: profile.fullNameEnglish ?? "",
    fullNameArabic: profile.fullNameArabic ?? "",
    // Always edit the 9-digit local part. Stored value may be in any of
    // E.164 / national-number / legacy free-text shapes; decode if possible.
    mobileNumber: localPartFromStored(
      profile.mobileNumber || profile.phoneE164 || profile.phone,
    ),
    specialty: profile.specialty ?? "",
    qualification: profile.qualification ?? "",
    scfhsNumber: profile.scfhsNumber ?? "",
    nationalIqamaId: profile.nationalIqamaId ?? "",
  });
  const [resumeFiles, setResumeFiles] = useState(prefill.resumeFiles ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onProfileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProfileEdits((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesAdded = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API_URL}/storage/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message || `${file.name}`);
        }
        const json = (await res.json()) as { url: string; filename: string };
        setResumeFiles((prev) => [
          ...prev,
          { type: "document", url: json.url, filename: json.filename },
        ]);
      }
      toast.success(t("resubmit.fileUploaded"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errors.uploadFailed"),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (url: string) => {
    setResumeFiles((prev) => prev.filter((f) => f.url !== url));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Validate phone if present — admin enforces KSA-only.
    let mobileNumberPayload = "";
    let phoneE164Payload = "";
    if (profileEdits.mobileNumber) {
      const normalized = normalizeSaudiMobile(profileEdits.mobileNumber);
      if (!normalized) {
        toast.error(
          locale === "ar"
            ? "أدخل رقم جوال سعودي صحيح"
            : "Please enter a valid Saudi mobile number",
        );
        return;
      }
      mobileNumberPayload = normalized.slice(-9);
      phoneE164Payload = normalized;
    }
    setSubmitting(true);
    try {
      // Merge: start with the original profileData, overlay just the
      // fields the inline form lets them edit. Keeps everything else
      // (address, gender, nationality, etc.) as previously submitted.
      const mergedProfile = {
        ...profile,
        ...profileEdits,
        mobileNumber: mobileNumberPayload,
        phoneE164: phoneE164Payload,
        phone: phoneE164Payload,
        countryCode: phoneE164Payload ? "SA" : "",
      };

      await trainerApplicationsPortalApi.resubmit(token, {
        roleRequestId,
        profileData: mergedProfile,
        bankData: prefill.bankData ?? undefined,
        resumeFiles,
        structuredResume: prefill.structuredResume ?? undefined,
      });

      toast.success(t("resubmit.success"));
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errors.resubmitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-[var(--color-border)] pt-5 mt-5 space-y-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          {t("resubmit.title")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("resubmit.intro")}
        </p>
      </div>

      {/* Profile fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label={t("resubmit.fields.fullNameEnglish")}
          name="fullNameEnglish"
          value={profileEdits.fullNameEnglish}
          onChange={onProfileChange}
        />
        <Field
          label={t("resubmit.fields.fullNameArabic")}
          name="fullNameArabic"
          value={profileEdits.fullNameArabic}
          onChange={onProfileChange}
        />
        <SaudiPhoneInput
          label={t("resubmit.fields.mobileNumber")}
          value={profileEdits.mobileNumber}
          onChange={(v) =>
            setProfileEdits((prev) => ({ ...prev, mobileNumber: v }))
          }
        />
        <Field
          label={t("resubmit.fields.specialty")}
          name="specialty"
          value={profileEdits.specialty}
          onChange={onProfileChange}
        />
        <Field
          label={t("resubmit.fields.qualification")}
          name="qualification"
          value={profileEdits.qualification}
          onChange={onProfileChange}
        />
        <Field
          label={t("resubmit.fields.scfhsNumber")}
          name="scfhsNumber"
          value={profileEdits.scfhsNumber}
          onChange={onProfileChange}
        />
        <Field
          label={t("resubmit.fields.nationalId")}
          name="nationalIqamaId"
          value={profileEdits.nationalIqamaId}
          onChange={onProfileChange}
        />
      </div>

      {/* Documents */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
          {t("resubmit.documents")}
        </label>
        <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">
          {t("resubmit.documentsHint")}
        </p>

        {resumeFiles.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {resumeFiles.map((file) => (
              <li
                key={file.url}
                className="flex items-center gap-2 px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg bg-white"
              >
                <FileText className="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-shrink-0" />
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-xs text-[var(--color-text-primary)] truncate hover:underline"
                >
                  {file.filename}
                </a>
                <button
                  type="button"
                  onClick={() => removeFile(file.url)}
                  className="p-1 text-[var(--color-text-secondary)] hover:text-[#DC2626]"
                  aria-label={t("resubmit.removeFile")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onPickFiles}
          disabled={uploading}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 border border-dashed border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {t("resubmit.uploadCta")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onFilesAdded}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {t("resubmit.submit")}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">
        {label}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full h-10 px-3 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)]"
      />
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────

function missingReqLabel(
  item: MissingRequirement,
  t: ReturnType<typeof useTranslations>,
): string {
  if (item.code === "OTHER") return item.label?.trim() || "—";
  if (item.label?.trim()) return item.label.trim();
  return t(`status.missingReqs.${item.code}`);
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
