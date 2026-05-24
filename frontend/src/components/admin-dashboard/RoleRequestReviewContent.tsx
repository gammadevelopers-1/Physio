"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  User,
  Phone,
  Mail,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  Hash,
  Building2,
  CreditCard,
  Twitter,
  Linkedin,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Calendar,
  Send,
  HelpCircle,
  History,
} from "lucide-react";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import { roleRequestsApi, type RoleRequest } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import ApplicantAvatar from "./role-requests/ApplicantAvatar";
import {
  getApplicantName,
  getApplicantNameAr,
  getApplicantSubtitle,
  formatFullDate,
  daysBetween,
  STATUS_CONFIG,
  type StatusKey,
} from "./role-requests/helpers";

const STATUS_ICONS = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  MORE_INFO: AlertCircle,
} as const;

interface Props {
  applicationId: string;
}

const RoleRequestReviewContent = ({ applicationId }: Props) => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard.roleRequestReviewPage");
  const tStatuses = useTranslations("adminDashboard.roleRequestsPage.statuses");
  const admin = useAdminProfile();
  const platformLocale = usePlatformLocale();
  const isRTL = locale === "ar";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [application, setApplication] = useState<RoleRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Action modal
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<"approve" | "reject" | "request-info" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Section refs for in-page nav scroll
  const refs = {
    profile: useRef<HTMLDivElement>(null),
    professional: useRef<HTMLDivElement>(null),
    documents: useRef<HTMLDivElement>(null),
    resume: useRef<HTMLDivElement>(null),
    bank: useRef<HTMLDivElement>(null),
    timeline: useRef<HTMLDivElement>(null),
  } as const;

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const data = await roleRequestsApi.getById(applicationId);
        setApplication(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplication();
  }, [applicationId, t]);

  const refresh = async () => {
    try {
      const data = await roleRequestsApi.getById(applicationId);
      setApplication(data);
    } catch {
      /* ignore */
    }
  };

  const handleAction = async (kind: "approve" | "reject" | "request-info") => {
    if (kind !== "approve" && !reviewNote.trim()) {
      setActionError(t("noteRequiredError"));
      return;
    }
    setActionLoading(kind);
    setActionError(null);
    try {
      if (kind === "approve") {
        await roleRequestsApi.approve(applicationId, reviewNote || undefined);
        toast.success(t("toasts.approved"));
      } else if (kind === "reject") {
        await roleRequestsApi.reject(applicationId, reviewNote);
        toast.success(t("toasts.rejected"));
      } else {
        await roleRequestsApi.requestInfo(applicationId, reviewNote);
        toast.success(t("toasts.infoRequested"));
      }
      await refresh();
      setShowModal(null);
      setReviewNote("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("toasts.actionFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  // Section refs typed loosely so the dynamic key access in the nav
  // doesn't trigger React.RefObject narrowing complaints.
  const scrollTo = (key: keyof typeof refs) => {
    const el = refs[key].current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (isLoading) {
    return (
      <>
        <AdminNavbar admin={admin} />
        <div className="flex flex-1 bg-[var(--color-surface-page)] min-h-screen">
          <div className="hidden lg:block">
            <AdminSidebar admin={admin} />
          </div>
          <AdminMobileSidebar admin={admin} />
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
          </div>
        </div>
      </>
    );
  }

  if (fetchError || !application) {
    return (
      <>
        <AdminNavbar admin={admin} />
        <div className="flex flex-1 bg-[var(--color-surface-page)] min-h-screen">
          <div className="hidden lg:block">
            <AdminSidebar admin={admin} />
          </div>
          <AdminMobileSidebar admin={admin} />
          <div className="flex-1 p-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {fetchError ?? t("notFound")}
            </div>
          </div>
        </div>
      </>
    );
  }

  const status = (application.status as StatusKey) ?? "PENDING";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = STATUS_ICONS[status] ?? Clock;
  const profile = (application.profileData || {}) as Record<string, string>;
  const bankData = (application.bankData || {}) as Record<string, string>;
  const structured = application.structuredResume || null;
  const rawResumeFiles = (application.resumeFiles || []) as Array<{
    type: string;
    url: string;
    filename: string;
  }>;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const resumeFiles = rawResumeFiles
    .filter((f) => f && typeof f === "object" && f.url)
    .map((f) => ({
      ...f,
      url: f.url.replace(/^http:\/\/localhost:\d+\/api/, apiUrl),
    }));

  const name = getApplicantName(application);
  const nameAr = getApplicantNameAr(application);
  const subtitle = getApplicantSubtitle(application);
  const daysOld = daysBetween(application.createdAt);
  const canAct = status === "PENDING" || status === "MORE_INFO";
  const hasBank =
    bankData.accountHolderName || bankData.bankName || bankData.iban;
  const hasStructured = !!(
    structured &&
    (structured.education?.length ||
      structured.professionalSkills?.length ||
      structured.scientificResearches?.length ||
      structured.trainingExperiences?.length)
  );

  return (
    <>
      <AdminNavbar admin={admin} />
      <div
        className="flex flex-1 bg-[var(--color-surface-page)] min-h-screen"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="hidden lg:block">
          <AdminSidebar admin={admin} />
        </div>
        <AdminMobileSidebar admin={admin} />

        <div className="flex-1 p-4 lg:p-8 min-w-0">
          {/* Back link */}
          <Link
            href={`/${locale}/dashboard/admin/role-requests`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors mb-5"
          >
            <BackIcon className="w-4 h-4" />
            {t("backToList")}
          </Link>

          {/* Hero header */}
          <div className="bg-gradient-to-br from-[var(--color-primary)] to-[#001d5a] rounded-2xl p-5 md:p-7 mb-5 text-white relative overflow-hidden">
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -top-10 -left-6 w-32 h-32 bg-white/5 rounded-full" />

            <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <ApplicantAvatar request={application} size="xl" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl md:text-2xl font-bold truncate">{name}</h1>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {tStatuses(status)}
                    </span>
                  </div>
                  {nameAr && (
                    <p className="text-sm text-white/80 mb-1" dir="rtl">
                      {nameAr}
                    </p>
                  )}
                  {subtitle && (
                    <p className="text-sm text-white/85 mb-2">{subtitle}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {profile.country && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full">
                        <MapPin className="w-3 h-3" />
                        {[profile.city, profile.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {profile.nationality && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full">
                        <Globe className="w-3 h-3" />
                        {profile.nationality}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full">
                      <Calendar className="w-3 h-3" />
                      {t("submittedDaysAgo", { count: daysOld })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Always-visible actions */}
              {canAct && (
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal("approve");
                      setReviewNote("");
                      setActionError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal("request-info");
                      setReviewNote("");
                      setActionError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    {t("requestInfo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal("reject");
                      setReviewNote("");
                      setActionError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    {t("reject")}
                  </button>
                </div>
              )}
            </div>

            {/* Pending overdue banner */}
            {status === "PENDING" && daysOld >= 7 && (
              <div className="relative mt-4 px-3 py-2 bg-[#DC2626]/30 border border-white/20 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{t("overdueBanner", { count: daysOld })}</span>
              </div>
            )}

            {/* Last admin note */}
            {application.reviewNote && (
              <div className="relative mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-white/70 mb-1">
                  {t("lastAdminNote")}
                </p>
                <p className="text-sm">{application.reviewNote}</p>
              </div>
            )}
          </div>

          {/* Section nav + content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
            {/* Sticky nav */}
            <nav className="hidden lg:block">
              <div className="sticky top-6 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-2 space-y-0.5">
                <SectionNavItem icon={User} label={t("nav.identity")} onClick={() => scrollTo("profile")} />
                <SectionNavItem icon={Briefcase} label={t("nav.professional")} onClick={() => scrollTo("professional")} />
                {resumeFiles.length > 0 && (
                  <SectionNavItem icon={FileText} label={t("nav.documents")} onClick={() => scrollTo("documents")} />
                )}
                {hasStructured && (
                  <SectionNavItem icon={GraduationCap} label={t("nav.resume")} onClick={() => scrollTo("resume")} />
                )}
                {hasBank && (
                  <SectionNavItem icon={CreditCard} label={t("nav.bank")} onClick={() => scrollTo("bank")} />
                )}
                <SectionNavItem icon={History} label={t("nav.timeline")} onClick={() => scrollTo("timeline")} />
              </div>
            </nav>

            {/* Content */}
            <div className="space-y-5 min-w-0">
              {/* Identity / Contact */}
              <section
                ref={refs.profile}
                className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
              >
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--color-primary)]" />
                  {t("sections.identity")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoField icon={Mail} iconColor="#0EA5E9" label={t("fields.email")} value={profile.email || application.user?.email} copyable />
                  <InfoField
                    icon={Phone}
                    iconColor="#16A34A"
                    label={t("fields.phone")}
                    value={
                      profile.mobileNumber || profile.phone
                        ? `${profile.countryCode ? `(${profile.countryCode}) ` : ""}${profile.mobileNumber || profile.phone}`
                        : undefined
                    }
                    copyable
                  />
                  <InfoField icon={Globe} iconColor="#A855F7" label={t("fields.nationality")} value={profile.nationality} />
                  <InfoField icon={MapPin} iconColor="#EC4899" label={t("fields.country")} value={profile.country} />
                  <InfoField icon={MapPin} iconColor="#F59E0B" label={t("fields.state")} value={profile.state} />
                  <InfoField icon={MapPin} iconColor="#F59E0B" label={t("fields.city")} value={profile.city} />
                  <InfoField icon={User} iconColor="#6366F1" label={t("fields.gender")} value={profile.gender} />
                  <InfoField
                    icon={Hash}
                    iconColor="#6B7280"
                    label={t("fields.nationalId")}
                    value={profile.nationalIqamaId || profile.nationalId}
                    mono
                    copyable
                  />
                </div>

                {(profile.twitter || profile.linkedIn || profile.linkedin) && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-2">
                      {t("fields.social")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.twitter && (
                        <a
                          href={profile.twitter.startsWith("http") ? profile.twitter : `https://twitter.com/${profile.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F9FF] text-[#0369A1] rounded-lg text-sm hover:bg-[#E0F2FE] transition-colors"
                        >
                          <Twitter className="w-4 h-4" />
                          {profile.twitter}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}
                      {(profile.linkedIn || profile.linkedin) && (
                        <a
                          href={
                            (profile.linkedIn || profile.linkedin)!.startsWith("http")
                              ? (profile.linkedIn || profile.linkedin)!
                              : `https://linkedin.com/in/${profile.linkedIn || profile.linkedin}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F9FF] text-[#0369A1] rounded-lg text-sm hover:bg-[#E0F2FE] transition-colors"
                        >
                          <Linkedin className="w-4 h-4" />
                          {profile.linkedIn || profile.linkedin}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Professional */}
              <section
                ref={refs.professional}
                className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
              >
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
                  {t("sections.professional")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoField icon={Briefcase} iconColor="#15803D" label={t("fields.profession")} value={profile.profession} />
                  <InfoField icon={GraduationCap} iconColor="#0E7490" label={t("fields.specialty")} value={profile.specialty} />
                  <InfoField icon={Award} iconColor="#D4A520" label={t("fields.qualification")} value={profile.qualification} />
                  <InfoField icon={Award} iconColor="#7C3AED" label={t("fields.rank")} value={profile.academicRank || profile.rank} />
                  <InfoField
                    icon={Hash}
                    iconColor="#0369A1"
                    label={t("fields.scfhs")}
                    value={
                      String(profile.hasScfhsNumber) === "true"
                        ? `${t("yes")}${profile.scfhsNumber ? ` — ${profile.scfhsNumber}` : ""}`
                        : String(profile.hasScfhsNumber) === "false"
                          ? t("no")
                          : profile.scfhsNumber || profile.hasScfhsNumber
                    }
                    mono={!!profile.scfhsNumber}
                    copyable={!!profile.scfhsNumber}
                  />
                </div>
              </section>

              {/* Documents */}
              {resumeFiles.length > 0 && (
                <section
                  ref={refs.documents}
                  className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
                >
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                    {t("sections.documents")}{" "}
                    <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                      ({resumeFiles.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resumeFiles.map((file, idx) => {
                      const ext = (file.filename || file.url).split(".").pop()?.toLowerCase() ?? "";
                      return (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-all"
                        >
                          <div className="w-11 h-11 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {file.filename || file.type}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] rounded font-semibold">
                                {ext || "FILE"}
                              </span>
                              <p className="text-xs text-[var(--color-text-secondary)] capitalize truncate">
                                {file.type.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Structured Resume */}
              {hasStructured && structured && (
                <section
                  ref={refs.resume}
                  className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 space-y-5"
                >
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[var(--color-primary)]" />
                    {t("sections.resume")}
                  </h2>

                  {!!structured.education?.length && (
                    <ResumeBlock
                      title={t("resume.education")}
                      accent="#0E7490"
                      items={structured.education.map((e) => ({
                        title: e.university,
                        subtitle: `${e.qualification} · ${e.graduationYear}`,
                        meta: [e.profession, e.specialty].filter(Boolean).join(" · "),
                      }))}
                    />
                  )}

                  {!!structured.professionalSkills?.length && (
                    <ResumeBlock
                      title={t("resume.experience")}
                      accent="#15803D"
                      items={structured.professionalSkills.map((s) => ({
                        title: s.placeOfWork,
                        subtitle:
                          s.type +
                          (s.type === "Academic" && s.academicRank
                            ? ` · ${s.academicRank}`
                            : s.type === "Practical Experience" && s.natureOfWork
                              ? ` · ${s.natureOfWork}`
                              : ""),
                        meta: t("resume.yearsExperience", { count: Number(s.yearsOfExperience) || 0 }),
                      }))}
                    />
                  )}

                  {!!structured.scientificResearches?.length && (
                    <ResumeBlock
                      title={t("resume.researches")}
                      accent="#7C3AED"
                      items={structured.scientificResearches.map((r) => ({
                        title: r.description,
                        subtitle: `${r.type} · ${r.role}`,
                      }))}
                    />
                  )}

                  {!!structured.trainingExperiences?.length && (
                    <ResumeBlock
                      title={t("resume.training")}
                      accent="#D4A520"
                      items={structured.trainingExperiences.map((tr) => ({
                        title: tr.eventName,
                        subtitle: tr.executingAgency,
                      }))}
                    />
                  )}
                </section>
              )}

              {/* Bank */}
              {hasBank && (
                <section
                  ref={refs.bank}
                  className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
                >
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
                    {t("sections.bank")}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoField
                      icon={User}
                      iconColor="#0369A1"
                      label={t("fields.accountHolder")}
                      value={bankData.accountHolderName}
                    />
                    <InfoField
                      icon={Building2}
                      iconColor="#16A34A"
                      label={t("fields.bankName")}
                      value={bankData.bankName}
                    />
                    <InfoField
                      icon={CreditCard}
                      iconColor="#D4A520"
                      label={t("fields.iban")}
                      value={bankData.iban}
                      className="sm:col-span-2"
                      mono
                      copyable
                    />
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section
                ref={refs.timeline}
                className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
              >
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--color-primary)]" />
                  {t("sections.timeline")}
                </h2>
                <ol className="relative ms-3 border-s-2 border-[var(--color-border)] space-y-5">
                  <TimelineItem
                    color="#64748B"
                    title={t("timeline.submitted")}
                    when={formatFullDate(application.createdAt, locale === "ar" ? "ar" : "en", platformLocale)}
                    body={t("timeline.submittedBy", {
                      name: application.user?.email ?? "—",
                    })}
                  />
                  {application.reviewedAt && (
                    <TimelineItem
                      color={cfg.dot}
                      title={t(`timeline.${status.toLowerCase()}`)}
                      when={formatFullDate(application.reviewedAt, locale, platformLocale)}
                      body={application.reviewNote ?? undefined}
                    />
                  )}
                </ol>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !actionLoading && setShowModal(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    showModal === "approve"
                      ? "bg-[#DCFCE7]"
                      : showModal === "reject"
                        ? "bg-[#FEE2E2]"
                        : "bg-[#FFEDD5]"
                  }`}
                >
                  {showModal === "approve" && (
                    <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                  )}
                  {showModal === "reject" && (
                    <XCircle className="w-5 h-5 text-[#991B1B]" />
                  )}
                  {showModal === "request-info" && (
                    <HelpCircle className="w-5 h-5 text-[#9A3412]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {t(`modals.${showModal}.title`)}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    {t(`modals.${showModal}.body`, { name })}
                  </p>
                </div>
              </div>

              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  showModal === "approve"
                    ? t("noteOptional")
                    : t("noteRequired")
                }
                rows={5}
                className="w-full p-3 border border-[var(--color-input-border)] rounded-lg text-sm resize-none outline-none focus:border-[var(--color-primary)]"
              />

              {actionError && (
                <p className="mt-2 text-sm text-[#DC2626]">{actionError}</p>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(showModal)}
                  disabled={!!actionLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                    showModal === "approve"
                      ? "bg-[#16A34A] hover:bg-[#15803D]"
                      : showModal === "reject"
                        ? "bg-[#DC2626] hover:bg-[#B91C1C]"
                        : "bg-[#EA580C] hover:bg-[#C2410C]"
                  }`}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {!actionLoading && showModal === "approve" && <CheckCircle2 className="w-4 h-4" />}
                  {!actionLoading && showModal === "reject" && <XCircle className="w-4 h-4" />}
                  {!actionLoading && showModal === "request-info" && <Send className="w-4 h-4" />}
                  {t(`modals.${showModal}.confirm`)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Subcomponents ──────────────────────────────────────────────

function SectionNavItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-start text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      <Icon className="w-4 h-4 text-[var(--color-primary)]" />
      {label}
    </button>
  );
}

function InfoField({
  icon: Icon,
  iconColor,
  label,
  value,
  className = "",
  mono,
  copyable,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value?: string | null;
  className?: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${iconColor}1A` }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <p
            className={`text-sm text-[var(--color-text-primary)] break-words flex-1 min-w-0 ${
              mono ? "font-mono" : ""
            } ${!value ? "text-[var(--color-text-secondary)]" : ""}`}
          >
            {value || "—"}
          </p>
          {copyable && value && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
              title="Copy"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResumeBlock({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: { title: string; subtitle?: string; meta?: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-1 h-4 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </h3>
      </div>
      <div className="space-y-2 ms-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-surface-page)]"
          >
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {item.subtitle}
              </p>
            )}
            {item.meta && (
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {item.meta}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineItem({
  color,
  title,
  when,
  body,
}: {
  color: string;
  title: string;
  when: string;
  body?: string;
}) {
  return (
    <li className="ms-4">
      <span
        className="absolute -start-[7px] w-3 h-3 rounded-full ring-2 ring-[var(--color-surface-card)]"
        style={{ backgroundColor: color }}
      />
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{when}</p>
      {body && (
        <p className="text-xs text-[var(--color-text-primary)] mt-1.5 p-2.5 bg-[var(--color-border-subtle)] rounded-lg">
          {body}
        </p>
      )}
    </li>
  );
}

export default RoleRequestReviewContent;
