"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  GraduationCap,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Briefcase,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  roleRequestsApi,
  type RoleRequest,
  type RoleRequestEvent,
  type RoleRequestStatus,
  type MissingRequirement,
} from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";

const STATUS_ICONS: Record<RoleRequestStatus, LucideIcon> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  MORE_INFO: AlertTriangle,
};

const STATUS_TONES: Record<RoleRequestStatus, { color: string; bg: string }> = {
  PENDING: { color: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]" },
  APPROVED: { color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  REJECTED: { color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  MORE_INFO: { color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
};

const EVENT_DOT_COLOR: Record<string, string> = {
  submitted: "#1D4ED8",
  approved: "#16A34A",
  rejected: "#DC2626",
  requested_info: "#B45309",
  resubmitted: "#7C3AED",
};

interface Props {
  applicationId: string;
}

export default function TrainerApplicationDetailContent({
  applicationId,
}: Props) {
  const t = useTranslations("supportDashboard.trainerApplication");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const profile = useSupportProfile();

  const [request, setRequest] = useState<RoleRequest | null>(null);
  const [events, setEvents] = useState<RoleRequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    roleRequestsApi.support
      .getById(applicationId)
      .then((res) => {
        if (cancelled) return;
        setRequest(res.request);
        setEvents(res.events ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("detail.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, t]);

  const profileData = (request?.profileData ?? {}) as Record<string, string>;
  const applicantName = `${request?.user?.firstName ?? ""} ${request?.user?.lastName ?? ""}`.trim() ||
    profileData.fullNameEnglish ||
    profileData.fullNameArabic ||
    request?.user?.email ||
    "";
  const status = request?.status;
  const tone = status ? STATUS_TONES[status] : null;
  const Icon = status ? STATUS_ICONS[status] : null;
  const missing = (request?.missingRequirements ?? []) as MissingRequirement[];

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole={user?.supportSubRole}
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              {/* Back link */}
              <Link
                href={`/${locale}/dashboard/support/trainer-applications`}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
                {t("detail.back")}
              </Link>

              {loading && (
                <div className="flex items-center justify-center py-20 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-5 h-5 animate-spin me-2" />
                  {t("detail.loading")}
                </div>
              )}

              {!loading && error && (
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-secondary)]">
                  {error}
                </div>
              )}

              {!loading && !error && request && status && tone && Icon && (
                <>
                  {/* Header card */}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-6 h-6 text-[#7C3AED]" />
                        </div>
                        <div className="min-w-0">
                          <h1 className="text-xl font-bold text-[var(--color-text-primary)] truncate">
                            {applicantName}
                          </h1>
                          <p className="text-xs text-[var(--color-text-secondary)] truncate">
                            {request.user?.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${tone.color} ${tone.bg}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {t(`status.${status}`)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <InfoCell
                        label={t("detail.submittedOn")}
                        value={formatDate(request.createdAt, locale)}
                      />
                      <InfoCell
                        label={t("detail.lastUpdated")}
                        value={formatDate(request.updatedAt, locale)}
                      />
                      <InfoCell
                        label={t("detail.requestedRole")}
                        value={request.requestedRole}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                      {/* Missing requirements (when MORE_INFO) */}
                      {status === "MORE_INFO" && missing.length > 0 && (
                        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FDE68A] p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-[#B45309]" />
                            <h2 className="text-sm font-semibold text-[#7C2D12]">
                              {t("missingReqsTitle")}
                            </h2>
                          </div>
                          <ul className="space-y-2">
                            {missing.map((item, idx) => (
                              <li
                                key={idx}
                                className="border border-[#FDE68A] bg-white rounded-lg p-3"
                              >
                                <div className="text-sm font-medium text-[#7C2D12]">
                                  {missingReqLabel(item, t)}
                                </div>
                                {item.note && (
                                  <p className="text-xs text-[#92400E] mt-1 italic">
                                    {item.note}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Latest review note */}
                      {request.reviewNote && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                            {t("detail.latestReviewerNote")}
                          </h2>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                            {request.reviewNote}
                          </p>
                        </div>
                      )}

                      {/* Profile data */}
                      <ProfileCard profileData={profileData} t={t} />

                      {/* Resume files */}
                      {request.resumeFiles && request.resumeFiles.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                            {t("detail.documents")}
                          </h2>
                          <ul className="space-y-2">
                            {request.resumeFiles.map((file, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between gap-3 border border-[var(--color-border)] rounded-lg p-2.5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                      {file.filename || file.type}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide">
                                      {file.type}
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--color-primary)] hover:underline flex-shrink-0"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {t("detail.open")}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Right rail — event timeline */}
                    <div className="space-y-4">
                      <EventsTimeline events={events} locale={locale} t={t} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface-page)] rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
        {value || "—"}
      </div>
    </div>
  );
}

function ProfileCard({
  profileData,
  t,
}: {
  profileData: Record<string, string>;
  t: T;
}) {
  const fields: Array<{ key: string; icon: LucideIcon; label: string }> = [
    { key: "specialty", icon: Briefcase, label: t("profile.specialty") },
    { key: "profession", icon: Briefcase, label: t("profile.profession") },
    { key: "qualification", icon: Briefcase, label: t("profile.qualification") },
    { key: "scfhsNumber", icon: FileText, label: t("profile.scfhsNumber") },
    { key: "nationalIqamaId", icon: FileText, label: t("profile.nationalId") },
    { key: "mobileNumber", icon: Phone, label: t("profile.phone") },
    { key: "phoneE164", icon: Phone, label: t("profile.phone") },
    { key: "city", icon: Mail, label: t("profile.city") },
    { key: "country", icon: Mail, label: t("profile.country") },
  ];

  const visible = fields.filter((f) => profileData[f.key]?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        {t("detail.profile")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((f) => {
          const FieldIcon = f.icon;
          return (
            <div key={f.key} className="flex items-start gap-2">
              <FieldIcon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {f.label}
                </div>
                <div className="text-sm text-[var(--color-text-primary)] truncate">
                  {profileData[f.key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventsTimeline({
  events,
  locale,
  t,
}: {
  events: RoleRequestEvent[];
  locale: string;
  t: T;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        {t("detail.activity")}
      </h2>
      {events.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("detail.noActivity")}
        </p>
      ) : (
        <ol className="relative border-s border-[var(--color-border)] ps-3 space-y-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span
                className="absolute -start-[7px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--color-surface-card)]"
                style={{
                  backgroundColor: EVENT_DOT_COLOR[event.action] ?? "#9CA3AF",
                }}
              />
              <div className="ms-3">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t(`events.${event.action}`)}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  {formatReviewerName(event) ?? t("eventByApplicant")}
                  {" · "}
                  {formatDate(event.createdAt, locale)}
                </div>
                {event.note && (
                  <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {event.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function missingReqLabel(item: MissingRequirement, t: T): string {
  if (item.code === "OTHER") return item.label?.trim() || "—";
  if (item.label?.trim()) return item.label.trim();
  return t(`missingReqs.${item.code}`);
}

function formatReviewerName(event: RoleRequestEvent): string | null {
  const first = event.performedByFirstName?.trim() ?? "";
  const last = event.performedByLastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (event.performedByEmail) return event.performedByEmail;
  return null;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
