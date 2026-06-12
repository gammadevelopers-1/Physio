"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Props {
  ticketId: string;
  ticketCategory: string;
  isGuestTicket: boolean;
}

type CertDetail = {
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  deliveryType: string;
  isCmeAccredited: boolean;
  cmeHours: number;
  enrollmentStatus: string;
  eligibility:
    | "eligible"
    | "partial"
    | "ineligible"
    | "revoked"
    | "not_requested";
  attendancePercent: number | null;
  attendanceThreshold: number;
  attendanceApplicable: boolean;
  assessmentStatus: "passed" | "failed" | "not_attempted";
  certificate: {
    id: string;
    status: string;
    issuedAt: string | null;
    revokedAt: string | null;
    rejectedAt: string | null;
    verificationCode: string;
    certificateUrl: string | null;
  } | null;
};

const AUTO_EXPAND_CATEGORIES = new Set(["certificate", "cme"]);

export default function CertificateDetailsCard({
  ticketId,
  ticketCategory,
  isGuestTicket,
}: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.certDetails");
  const locale = useLocale();

  // Default open for cert/CME tickets — the agent's first instinct on
  // those is "show me what's blocking the cert", so don't hide it.
  const [expanded, setExpanded] = useState(
    AUTO_EXPAND_CATEGORIES.has(ticketCategory),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [details, setDetails] = useState<CertDetail[] | null>(null);

  useEffect(() => {
    if (isGuestTicket) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    supportApi
      .getTicketCertificateDetails(ticketId)
      .then((res) => {
        if (cancelled) return;
        if (res.isGuest || !res.details) {
          setDetails(null);
        } else {
          setDetails(res.details);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, isGuestTicket]);

  if (isGuestTicket) return null;

  const summary = buildSummary(details);
  const isEmpty = !loading && !error && (!details || details.length === 0);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-5 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Award className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
          <h3
            className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
            title={t("title")}
          >
            {t("title")}
          </h3>
          {!loading && !error && details && details.length > 0 && (
            <span
              className="text-[11px] text-[var(--color-text-secondary)] truncate"
              title={summary}
            >
              {summary}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {loading && <LoadingSkeleton />}
          {!loading && error && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
              {t("loadError")}
            </div>
          )}
          {isEmpty && (
            <div className="text-xs text-[var(--color-text-secondary)] py-3">
              {t("noCourses")}
            </div>
          )}
          {!loading && !error && details && details.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto pe-1">
              {details.map((d) => (
                <CourseRow key={d.courseId} detail={d} locale={locale} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildSummary(details: CertDetail[] | null): string {
  if (!details || details.length === 0) return "";
  const issued = details.filter((d) => d.certificate?.status === "approved")
    .length;
  const pending = details.filter(
    (d) =>
      d.certificate?.status === "pending" || d.certificate?.status === "held",
  ).length;
  const parts = [`${details.length} courses`];
  if (issued > 0) parts.push(`${issued} issued`);
  if (pending > 0) parts.push(`${pending} pending`);
  return parts.join(" · ");
}

function CourseRow({
  detail,
  locale,
}: {
  detail: CertDetail;
  locale: string;
}) {
  const t = useTranslations("supportDashboard.ticketDetail.certDetails");
  const courseTitle =
    locale === "ar" && detail.courseTitleAr
      ? detail.courseTitleAr
      : detail.courseTitle;

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--color-text-primary)] min-w-0 truncate">
          {courseTitle}
        </div>
        <EligibilityBadge eligibility={detail.eligibility} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <StatLine
          label={t("attendance")}
          value={formatAttendance(detail, t)}
          tone={attendanceTone(detail)}
        />
        <StatLine
          label={t("assessment")}
          value={t(`assessmentStatus.${detail.assessmentStatus}`)}
          tone={assessmentTone(detail.assessmentStatus)}
        />
        {detail.isCmeAccredited && (
          <StatLine
            label={t("cmeHours")}
            value={formatCmeHours(detail, t)}
            tone={
              detail.certificate?.status === "approved" ? undefined : "muted"
            }
          />
        )}
        <StatLine
          label={t("certStatus")}
          value={formatCertStatus(detail, t)}
        />
      </div>

      {detail.certificate?.status === "approved" && (
        <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5">
          {detail.certificate.issuedAt && (
            <StatLine
              label={t("issuedAt")}
              value={formatDate(detail.certificate.issuedAt, locale)}
            />
          )}
          <VerificationLine
            code={detail.certificate.verificationCode}
            certId={detail.certificate.id}
            certificateUrl={detail.certificate.certificateUrl}
            locale={locale}
          />
        </div>
      )}

      {detail.certificate?.status === "revoked" &&
        detail.certificate.revokedAt && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <StatLine
              label={t("revokedAt")}
              value={formatDate(detail.certificate.revokedAt, locale)}
              tone="danger"
            />
          </div>
        )}
    </div>
  );
}

function EligibilityBadge({
  eligibility,
}: {
  eligibility: CertDetail["eligibility"];
}) {
  const t = useTranslations("supportDashboard.ticketDetail.certDetails");
  const config: Record<
    CertDetail["eligibility"],
    {
      label: string;
      icon: typeof CheckCircle2;
      color: string;
      bg: string;
    }
  > = {
    eligible: {
      label: t("eligibility.eligible"),
      icon: CheckCircle2,
      color: "text-[#16A34A]",
      bg: "bg-[#DCFCE7]",
    },
    partial: {
      label: t("eligibility.partial"),
      icon: Clock,
      color: "text-[#B45309]",
      bg: "bg-[#FEF3C7]",
    },
    ineligible: {
      label: t("eligibility.ineligible"),
      icon: XCircle,
      color: "text-[#DC2626]",
      bg: "bg-[#FEE2E2]",
    },
    revoked: {
      label: t("eligibility.revoked"),
      icon: Ban,
      color: "text-[#DC2626]",
      bg: "bg-[#FEE2E2]",
    },
    not_requested: {
      label: t("eligibility.notRequested"),
      icon: Clock,
      color: "text-[var(--color-text-secondary)]",
      bg: "bg-[var(--color-surface-page)]",
    },
  };
  const c = config[eligibility];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${c.color} ${c.bg}`}
    >
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function StatLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger" | "muted";
}) {
  const color =
    tone === "danger"
      ? "text-[#DC2626]"
      : tone === "warning"
        ? "text-[#B45309]"
        : tone === "muted"
          ? "text-[var(--color-text-secondary)]"
          : "text-[var(--color-text-primary)]";
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span className={`text-xs font-medium truncate ${color}`}>{value}</span>
    </div>
  );
}

function VerificationLine({
  code,
  certId,
  certificateUrl,
  locale,
}: {
  code: string;
  certId: string;
  certificateUrl: string | null;
  locale: string;
}) {
  const t = useTranslations("supportDashboard.ticketDetail.certDetails");
  const [copied, setCopied] = useState(false);
  const verifyUrl = `/${locale}/verify/${certId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silent — clipboard write can fail in non-secure contexts.
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {t("verificationCode")}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs font-mono bg-[var(--color-surface-page)] px-1.5 py-0.5 rounded">
          {code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label={t("copyCode")}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              {t("copied")}
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              {t("copyCode")}
            </>
          )}
        </button>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-[var(--color-brand-primary)] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {t("openVerify")}
        </a>
        {certificateUrl && (
          <a
            href={certificateUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[var(--color-brand-primary)] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            {t("openPdf")}
          </a>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="border border-[var(--color-border)] rounded-lg p-3 space-y-2 animate-pulse"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-32 rounded bg-[var(--color-surface-page)]" />
            <div className="h-4 w-16 rounded-full bg-[var(--color-surface-page)]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-7 rounded bg-[var(--color-surface-page)]"
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-center">
        <Loader2 className="w-3 h-3 text-[var(--color-text-secondary)] animate-spin" />
      </div>
    </div>
  );
}

// ─── Formatters ────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function formatAttendance(detail: CertDetail, t: T): string {
  if (!detail.attendanceApplicable) return t("attendanceNA");
  if (detail.attendancePercent === null) return t("attendanceNoData");
  return `${detail.attendancePercent.toFixed(0)}% / ${detail.attendanceThreshold}%`;
}

function attendanceTone(
  detail: CertDetail,
): "warning" | "danger" | undefined {
  if (!detail.attendanceApplicable || detail.attendancePercent === null) {
    return undefined;
  }
  const diff = detail.attendancePercent - detail.attendanceThreshold;
  if (diff < -10) return "danger";
  if (diff < 0) return "warning";
  return undefined;
}

function assessmentTone(
  status: CertDetail["assessmentStatus"],
): "danger" | "warning" | "muted" | undefined {
  if (status === "failed") return "danger";
  if (status === "not_attempted") return "muted";
  return undefined;
}

function formatCmeHours(detail: CertDetail, t: T): string {
  if (!detail.isCmeAccredited) return t("notCmeAccredited");
  if (detail.certificate?.status === "approved") {
    return t("cmeEarnedHours", { hours: detail.cmeHours });
  }
  return t("cmePendingHours", { hours: detail.cmeHours });
}

function formatCertStatus(detail: CertDetail, t: T): string {
  const status = detail.certificate?.status;
  if (!status) return t("certNotRequested");
  return t(`certStatusValue.${status}`);
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
