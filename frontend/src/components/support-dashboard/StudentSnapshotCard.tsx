"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  BookOpen,
  Video,
  CalendarCheck,
  Award,
  BadgeCheck,
  CreditCard,
  Users,
  GraduationCap,
  ClipboardList,
  UserCheck,
  Ticket,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Props {
  ticketId: string;
  isGuestTicket: boolean;
}

type RequesterRole =
  | "student"
  | "instructor"
  | "manager"
  | "ta"
  | "finance"
  | "guest";

type StudentSnapshot = {
  courses: { total: number; active: number; completed: number };
  webinars: { total: number; attended: number; upcoming: number };
  attendance: { percent: number | null; sessionCount: number };
  certificates: { issued: number; pending: number; revoked: number };
  cme: { earned: number; pending: number };
  payments: {
    totalPaidSar: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    lastPaymentAt: string | null;
  };
};

type InstructorSnapshot = {
  courses: { teaching: number };
  students: { total: number };
  sessions: { total: number; thisMonth: number };
  interventions: { total: number; thisMonth: number };
};

type ManagerSnapshot = {
  courses: { managed: number };
  instructors: { count: number };
  students: { total: number };
};

type TaSnapshot = {
  courses: { assisting: number };
  sessions: { total: number; thisMonth: number };
};

type FinanceSnapshot = { tickets: { raised: number } };

type Snapshot =
  | StudentSnapshot
  | InstructorSnapshot
  | ManagerSnapshot
  | TaSnapshot
  | FinanceSnapshot;

export default function StudentSnapshotCard({ ticketId, isGuestTicket }: Props) {
  const t = useTranslations("supportDashboard.ticketDetail");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [role, setRole] = useState<RequesterRole>("student");

  useEffect(() => {
    if (isGuestTicket) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    supportApi
      .getTicketStudentContext(ticketId)
      .then((res) => {
        if (cancelled) return;
        if (res.isGuest || !res.snapshot) {
          setData(null);
        } else {
          setData(res.snapshot);
        }
        setRole(res.role);
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

  const titleKey =
    role === "instructor"
      ? "snapshot.titleInstructor"
      : role === "manager"
        ? "snapshot.titleManager"
        : role === "ta"
          ? "snapshot.titleTa"
          : role === "finance"
            ? "snapshot.titleFinance"
            : "snapshot.title";

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        {t(titleKey)}
      </h3>

      {loading && <SnapshotSkeleton />}

      {!loading && error && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
          <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
          {t("snapshot.loadError")}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-2.5">
          {role === "instructor" && (
            <InstructorRows data={data as InstructorSnapshot} t={t} />
          )}
          {role === "manager" && (
            <ManagerRows data={data as ManagerSnapshot} t={t} />
          )}
          {role === "ta" && <TaRows data={data as TaSnapshot} t={t} />}
          {role === "finance" && (
            <FinanceRows data={data as FinanceSnapshot} t={t} />
          )}
          {role === "student" && (
            <StudentRows data={data as StudentSnapshot} t={t} locale={locale} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Per-role row layouts ──────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function StudentRows({
  data,
  t,
  locale,
}: {
  data: StudentSnapshot;
  t: T;
  locale: string;
}) {
  return (
    <>
      <Row
        icon={BookOpen}
        label={t("snapshot.courses")}
        value={formatCourses(data.courses, t)}
        muted={data.courses.total === 0}
      />
      <Row
        icon={Video}
        label={t("snapshot.webinars")}
        value={formatWebinars(data.webinars, t)}
        muted={data.webinars.total === 0}
      />
      <Row
        icon={CalendarCheck}
        label={t("snapshot.attendance")}
        value={formatAttendance(data.attendance, t)}
        muted={data.attendance.sessionCount === 0}
        tone={attendanceTone(data.attendance.percent)}
      />
      <Row
        icon={Award}
        label={t("snapshot.certificates")}
        value={formatCertificates(data.certificates, t)}
        muted={data.certificates.issued === 0 && data.certificates.pending === 0}
      />
      <Row
        icon={BadgeCheck}
        label={t("snapshot.cme")}
        value={formatCme(data.cme, t)}
        muted={data.cme.earned === 0 && data.cme.pending === 0}
      />
      <Row
        icon={CreditCard}
        label={t("snapshot.payments")}
        value={formatPayments(data.payments, t, locale)}
        muted={
          data.payments.completedCount === 0 &&
          data.payments.pendingCount === 0 &&
          data.payments.failedCount === 0
        }
        tone={paymentsTone(data.payments)}
      />
    </>
  );
}

function InstructorRows({ data, t }: { data: InstructorSnapshot; t: T }) {
  return (
    <>
      <Row
        icon={BookOpen}
        label={t("snapshot.coursesTeaching")}
        value={t("snapshot.coursesTeachingValue", { count: data.courses.teaching })}
        muted={data.courses.teaching === 0}
      />
      <Row
        icon={Users}
        label={t("snapshot.studentsTotal")}
        value={t("snapshot.studentsValue", { count: data.students.total })}
        muted={data.students.total === 0}
      />
      <Row
        icon={CalendarCheck}
        label={t("snapshot.sessionsConducted")}
        value={`${t("snapshot.sessionsValue", { count: data.sessions.total })} · ${t("snapshot.thisMonth", { count: data.sessions.thisMonth })}`}
        muted={data.sessions.total === 0}
      />
      <Row
        icon={ClipboardList}
        label={t("snapshot.interventionsFiled")}
        value={`${t("snapshot.interventionsValue", { count: data.interventions.total })} · ${t("snapshot.thisMonth", { count: data.interventions.thisMonth })}`}
        muted={data.interventions.total === 0}
      />
    </>
  );
}

function ManagerRows({ data, t }: { data: ManagerSnapshot; t: T }) {
  return (
    <>
      <Row
        icon={BookOpen}
        label={t("snapshot.coursesManaged")}
        value={t("snapshot.coursesManagedValue", { count: data.courses.managed })}
        muted={data.courses.managed === 0}
      />
      <Row
        icon={GraduationCap}
        label={t("snapshot.instructorsUnder")}
        value={t("snapshot.instructorsValue", { count: data.instructors.count })}
        muted={data.instructors.count === 0}
      />
      <Row
        icon={Users}
        label={t("snapshot.studentsAcross")}
        value={t("snapshot.studentsValue", { count: data.students.total })}
        muted={data.students.total === 0}
      />
    </>
  );
}

function TaRows({ data, t }: { data: TaSnapshot; t: T }) {
  return (
    <>
      <Row
        icon={UserCheck}
        label={t("snapshot.coursesAssisting")}
        value={t("snapshot.coursesAssistingValue", { count: data.courses.assisting })}
        muted={data.courses.assisting === 0}
      />
      <Row
        icon={CalendarCheck}
        label={t("snapshot.sessionsScope")}
        value={`${t("snapshot.sessionsValue", { count: data.sessions.total })} · ${t("snapshot.thisMonth", { count: data.sessions.thisMonth })}`}
        muted={data.sessions.total === 0}
      />
    </>
  );
}

function FinanceRows({ data, t }: { data: FinanceSnapshot; t: T }) {
  return (
    <Row
      icon={Ticket}
      label={t("snapshot.ticketsRaised")}
      value={t("snapshot.ticketsValue", { count: data.tickets.raised })}
      muted={data.tickets.raised === 0}
    />
  );
}

function Row({
  icon: Icon,
  label,
  value,
  muted,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
  tone?: "warning" | "danger";
}) {
  const valueColor =
    tone === "danger"
      ? "text-[#DC2626]"
      : tone === "warning"
        ? "text-[#B45309]"
        : muted
          ? "text-[var(--color-text-secondary)]"
          : "text-[var(--color-text-primary)]";
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] flex-shrink-0">
          {label}
        </span>
        <span className={`text-xs font-medium text-right truncate ${valueColor}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded bg-[var(--color-surface-page)]" />
          <div className="flex-1 flex items-center justify-between gap-2">
            <div className="h-3 w-16 rounded bg-[var(--color-surface-page)]" />
            <div className="h-3 w-20 rounded bg-[var(--color-surface-page)]" />
          </div>
        </div>
      ))}
      <div className="pt-1 flex items-center justify-center">
        <Loader2 className="w-3 h-3 text-[var(--color-text-secondary)] animate-spin" />
      </div>
    </div>
  );
}

// ─── Student formatters (unchanged) ─────────────────────────

function formatCourses(c: StudentSnapshot["courses"], t: T): string {
  if (c.total === 0) return t("snapshot.none");
  const parts: string[] = [t("snapshot.coursesEnrolled", { count: c.total })];
  if (c.active > 0 && c.completed > 0) {
    parts.push(
      `${t("snapshot.activeShort", { count: c.active })} · ${t("snapshot.completedShort", { count: c.completed })}`,
    );
  } else if (c.completed > 0) {
    parts.push(t("snapshot.completedShort", { count: c.completed }));
  } else if (c.active > 0 && c.total !== c.active) {
    parts.push(t("snapshot.activeShort", { count: c.active }));
  }
  return parts.join(" · ");
}

function formatWebinars(w: StudentSnapshot["webinars"], t: T): string {
  if (w.total === 0) return t("snapshot.none");
  const parts: string[] = [t("snapshot.webinarsRegistered", { count: w.total })];
  if (w.attended > 0) {
    parts.push(t("snapshot.attendedShort", { count: w.attended }));
  }
  if (w.upcoming > 0) {
    parts.push(t("snapshot.upcomingShort", { count: w.upcoming }));
  }
  return parts.join(" · ");
}

function formatAttendance(a: StudentSnapshot["attendance"], t: T): string {
  if (a.sessionCount === 0) return t("snapshot.noSessions");
  if (a.percent === null) return t("snapshot.noSessions");
  return `${a.percent}% · ${t("snapshot.sessions", { count: a.sessionCount })}`;
}

function attendanceTone(percent: number | null): "warning" | "danger" | undefined {
  if (percent === null) return undefined;
  if (percent < 50) return "danger";
  if (percent < 75) return "warning";
  return undefined;
}

function formatCertificates(c: StudentSnapshot["certificates"], t: T): string {
  if (c.issued === 0 && c.pending === 0 && c.revoked === 0) return t("snapshot.none");
  const parts: string[] = [];
  if (c.issued > 0) parts.push(t("snapshot.certIssued", { count: c.issued }));
  if (c.pending > 0) parts.push(t("snapshot.certPending", { count: c.pending }));
  if (c.revoked > 0) parts.push(t("snapshot.certRevoked", { count: c.revoked }));
  return parts.join(" · ");
}

function formatCme(c: StudentSnapshot["cme"], t: T): string {
  if (c.earned === 0 && c.pending === 0) return t("snapshot.noCredits");
  const parts: string[] = [];
  if (c.earned > 0) parts.push(t("snapshot.cmeEarned", { count: c.earned }));
  if (c.pending > 0) parts.push(t("snapshot.cmePending", { count: c.pending }));
  return parts.join(" · ");
}

function formatPayments(
  p: StudentSnapshot["payments"],
  t: T,
  locale: string,
): string {
  if (
    p.completedCount === 0 &&
    p.pendingCount === 0 &&
    p.failedCount === 0 &&
    p.refundedCount === 0
  ) {
    return t("snapshot.noPayments");
  }
  const parts: string[] = [];
  if (p.completedCount > 0) {
    const amount = formatSar(p.totalPaidSar, locale);
    parts.push(t("snapshot.paid", { amount }));
  }
  if (p.pendingCount > 0) {
    parts.push(t("snapshot.paymentPending", { count: p.pendingCount }));
  }
  if (p.failedCount > 0) {
    parts.push(t("snapshot.paymentFailed", { count: p.failedCount }));
  }
  return parts.join(" · ");
}

function paymentsTone(
  p: StudentSnapshot["payments"],
): "warning" | "danger" | undefined {
  if (p.failedCount > 0) return "danger";
  if (p.pendingCount > 0) return "warning";
  return undefined;
}

function formatSar(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}
