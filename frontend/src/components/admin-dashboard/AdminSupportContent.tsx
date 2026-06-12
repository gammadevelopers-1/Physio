"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import Select from "./Select";
import HelpCenterManager from "@/components/support-dashboard/HelpCenterManager";
import SupportOverviewTab from "./SupportOverviewTab";
import AdminTicketsTab from "./AdminTicketsTab";
import AdminSupervisorsTab from "./AdminSupervisorsTab";
import {
  AutoAssignmentPanel,
  BusinessHoursPanel,
  SLAPoliciesPanel,
  TicketCategoriesPanel,
} from "@/components/support-dashboard/SupportSettingsContent";
import {
  Headphones,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  User as UserIcon,
  Phone,
  Clock,
  ShieldQuestion,
  Inbox,
  ArrowRight,
  BookOpen,
  Users as UsersIcon,
  Settings as SettingsIcon,
  LayoutDashboard,
} from "lucide-react";

type TeamRequest = Awaited<ReturnType<typeof supportApi.listTeamRequests>>[number];
type Tab =
  | "overview"
  | "tickets"
  | "supervisors"
  | "team-requests"
  | "help-center"
  | "settings";

const AdminSupportContent = () => {
  const t = useTranslations("adminDashboard.supportPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const admin = useAdminProfile();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Deep-link params drive the initial tab + auto-open behaviour:
  //   ?tab=<key>            → which tab to land on
  //   ?request=<requestId>  → open the team-request decision modal
  //                            for that request, in any state. Used
  //                            by the in-app notification when a
  //                            supervisor submits a request.
  const deepLinkTab = searchParams?.get("tab");
  const deepLinkRequestId = searchParams?.get("request");

  const initialTab: Tab =
    deepLinkTab === "tickets" ||
    deepLinkTab === "supervisors" ||
    deepLinkTab === "team-requests" ||
    deepLinkTab === "help-center" ||
    deepLinkTab === "settings" ||
    deepLinkTab === "overview"
      ? deepLinkTab
      : "overview";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Keep activeTab in sync with the ?tab= query param so that
  // deep-link pushes from SupportOverviewTab (KPI cards, priority bars,
  // agent workload, at-risk list) actually switch tabs. Without this
  // the tab state is frozen at the initial mount value.
  useEffect(() => {
    if (
      deepLinkTab === "overview" ||
      deepLinkTab === "tickets" ||
      deepLinkTab === "supervisors" ||
      deepLinkTab === "team-requests" ||
      deepLinkTab === "help-center" ||
      deepLinkTab === "settings"
    ) {
      if (deepLinkTab !== activeTab) {
        setActiveTab(deepLinkTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTab]);
  // If we're deep-linked into a specific request, fetch across ALL
  // statuses so an already-actioned request still appears in the list
  // and the modal can render its read-only audit view.
  const [statusFilter, setStatusFilter] = useState<string>(
    deepLinkRequestId ? "all" : "pending",
  );
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<TeamRequest | null>(null);
  // Track whether we've already consumed the deep-link request id, so
  // refreshing the page or switching tabs doesn't re-pop the modal.
  const deepLinkConsumedRef = useRef(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supportApi.listTeamRequests(statusFilter);
      setRequests(data || []);
    } catch {
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Once the list is loaded, surface the deep-linked request if any.
  // Handles three cases:
  //   - Pending → modal opens with action buttons
  //   - Approved / rejected → modal opens with read-only audit info
  //   - Not in list at all → friendly toast, no 404
  useEffect(() => {
    if (!deepLinkRequestId) return;
    if (deepLinkConsumedRef.current) return;
    if (isLoading) return;

    const match = requests.find((r) => r.id === deepLinkRequestId);
    if (match) {
      setSelected(match);
    } else {
      toast.error(t("teamRequests.notFoundFallback"));
    }
    deepLinkConsumedRef.current = true;

    // Strip the ?request param from the URL so a refresh doesn't
    // re-trigger the modal. Keep ?tab so the user stays on this tab.
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.delete("request");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname || "/admin/support");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, isLoading, deepLinkRequestId]);

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Headphones className="w-6 h-6 text-[var(--color-primary)]" />
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-5 border-b border-[var(--color-border)] overflow-x-auto scrollbar-hide">
                {[
                  {
                    key: "overview" as Tab,
                    label: t("tabs.overview"),
                    icon: LayoutDashboard,
                  },
                  {
                    key: "tickets" as Tab,
                    label: t("tabs.tickets"),
                    icon: Inbox,
                  },
                  {
                    key: "supervisors" as Tab,
                    label: t("tabs.supervisors"),
                    icon: ShieldQuestion,
                  },
                  {
                    key: "team-requests" as Tab,
                    label: t("tabs.teamRequests"),
                    icon: UsersIcon,
                  },
                  {
                    key: "help-center" as Tab,
                    label: t("tabs.helpCenter"),
                    icon: BookOpen,
                  },
                  {
                    key: "settings" as Tab,
                    label: t("tabs.settings"),
                    icon: SettingsIcon,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.key);
                        // Push the tab onto the URL so the active tab is
                        // shareable + back-button friendly. Strip filter
                        // params from the previous tab so a click on
                        // "Overview" doesn't carry over ?filter=overdue.
                        const next = new URLSearchParams();
                        next.set("tab", tab.key);
                        router.push(
                          `${pathname}?${next.toString()}`,
                          { scroll: false },
                        );
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] whitespace-nowrap ${
                        active
                          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Overview tab */}
              {activeTab === "overview" && <SupportOverviewTab />}

              {/* Tickets tab */}
              {activeTab === "tickets" && <AdminTicketsTab />}

              {/* Supervisors tab */}
              {activeTab === "supervisors" && <AdminSupervisorsTab />}

              {/* Help Center tab */}
              {activeTab === "help-center" && <HelpCenterManager />}

              {/* Settings tab — admin-level controls */}
              {activeTab === "settings" && <AdminSupportSettings />}

              {/* Section: Team Requests */}
              {activeTab === "team-requests" && (
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] mb-6">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <ShieldQuestion className="w-5 h-5 text-[var(--color-primary)]" />
                      {t("teamRequests.title")}
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {t("teamRequests.subtitle")}
                    </p>
                  </div>
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-full sm:w-44"
                    options={[
                      { value: "pending", label: t("teamRequests.statusFilters.pending") },
                      { value: "approved", label: t("teamRequests.statusFilters.approved") },
                      { value: "rejected", label: t("teamRequests.statusFilters.rejected") },
                      { value: "all", label: t("teamRequests.statusFilters.all") },
                    ]}
                  />
                </div>

                {isLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                    <Inbox className="w-8 h-8" />
                    <p className="text-sm">{t("teamRequests.empty")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-border-subtle)]">
                    {requests.map((r) => (
                      <RequestRow
                        key={r.id}
                        r={r}
                        onClick={() => setSelected(r)}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <RequestDecisionDialog
          request={selected}
          onClose={() => setSelected(null)}
          onDecided={() => {
            setSelected(null);
            fetchRequests();
          }}
        />
      )}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Row
// ──────────────────────────────────────────────────────────────────

function RequestRow({ r, onClick }: { r: TeamRequest; onClick: () => void }) {
  const t = useTranslations("adminDashboard.supportPage");
  const supervisorName =
    [r.supervisorFirstName, r.supervisorLastName].filter(Boolean).join(" ") ||
    r.supervisorEmail ||
    t("unknown");

  const candidateName =
    r.kind === "add_existing"
      ? [r.candidateExistingFirstName, r.candidateExistingLastName]
          .filter(Boolean)
          .join(" ") ||
        r.candidateExistingEmail ||
        t("unknown")
      : [r.candidateFirstName, r.candidateLastName].filter(Boolean).join(" ") ||
        r.candidateEmail ||
        t("unknown");

  const candidateEmail =
    r.kind === "add_existing" ? r.candidateExistingEmail : r.candidateEmail;

  const statusStyles: Record<string, string> = {
    pending: "bg-[#FEF9C3] text-[#A16207]",
    approved: "bg-[#DCFCE7] text-[#15803D]",
    rejected: "bg-[#FEE2E2] text-[#DC2626]",
  };
  const kindStyles: Record<string, string> = {
    add_existing: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    add_new: "bg-[#EDE9FE] text-[#8B5CF6]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 text-start hover:bg-[var(--color-border-subtle)] transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
        <UserIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {supervisorName}
          </p>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-primary)] truncate">
            {candidateName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${kindStyles[r.kind] || ""}`}
          >
            {t(`teamRequests.kind.${r.kind}`)}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[r.status] || ""}`}
          >
            {t(`teamRequests.status.${r.status}`)}
          </span>
          {candidateEmail && (
            <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
              {candidateEmail}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Decision dialog
// ──────────────────────────────────────────────────────────────────

function RequestDecisionDialog({
  request,
  onClose,
  onDecided,
}: {
  request: TeamRequest;
  onClose: () => void;
  onDecided: () => void;
}) {
  const t = useTranslations("adminDashboard.supportPage");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPending = request.status === "pending";
  const isAddNew = request.kind === "add_new";

  const supervisorName =
    [request.supervisorFirstName, request.supervisorLastName]
      .filter(Boolean)
      .join(" ") || request.supervisorEmail;
  const candidateName =
    request.kind === "add_existing"
      ? [request.candidateExistingFirstName, request.candidateExistingLastName]
          .filter(Boolean)
          .join(" ") || request.candidateExistingEmail
      : [request.candidateFirstName, request.candidateLastName]
          .filter(Boolean)
          .join(" ") || request.candidateEmail;
  const candidateEmail =
    request.kind === "add_existing"
      ? request.candidateExistingEmail
      : request.candidateEmail;

  async function submit() {
    if (!decision) return;
    if (decision === "approve" && isAddNew && tempPassword.length < 8) {
      toast.error(t("decision.passwordTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.decideTeamRequest(request.id, {
        decision,
        reason: reason.trim() || undefined,
        tempPassword: decision === "approve" && isAddNew ? tempPassword : undefined,
      });
      toast.success(
        decision === "approve"
          ? t("decision.approveSuccess")
          : t("decision.rejectSuccess"),
      );
      onDecided();
    } catch (err: any) {
      toast.error(err?.message || t("decision.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg p-6 pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("decision.title")}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
            >
              <XCircle className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Summary */}
          <div className="bg-[var(--color-border-subtle)] rounded-lg p-3 mb-4 space-y-1.5">
            <DetailRow
              label={t("decision.supervisor")}
              value={supervisorName || "—"}
            />
            <DetailRow
              label={t("decision.candidate")}
              value={candidateName || "—"}
            />
            {candidateEmail && (
              <DetailRow
                label={t("decision.email")}
                value={candidateEmail}
                icon={Mail}
              />
            )}
            {request.candidatePhone && (
              <DetailRow
                label={t("decision.phone")}
                value={request.candidatePhone}
                icon={Phone}
              />
            )}
            <DetailRow
              label={t("decision.kind")}
              value={t(`teamRequests.kind.${request.kind}`)}
            />
            <DetailRow
              label={t("decision.submitted")}
              value={new Date(request.createdAt).toLocaleString()}
            />
          </div>

          {request.reason && (
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("decision.supervisorReason")}
              </p>
              <p className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3">
                {request.reason}
              </p>
            </div>
          )}

          {!isPending ? (
            <div className="border border-[var(--color-border)] rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {t("decision.alreadyReviewed", {
                  status: t(`teamRequests.status.${request.status}`),
                })}
              </p>
              {request.decisionReason && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  {t("decision.decisionReasonLabel")}: {request.decisionReason}
                </p>
              )}
              {request.reviewerFirstName && (
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  {t("decision.reviewedBy")}: {request.reviewerFirstName}{" "}
                  {request.reviewerLastName}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Decision picker */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setDecision("approve")}
                  className={`h-10 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${
                    decision === "approve"
                      ? "border-[#15803D] bg-[#DCFCE7] text-[#15803D]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t("decision.approve")}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("reject")}
                  className={`h-10 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${
                    decision === "reject"
                      ? "border-[#DC2626] bg-[#FEE2E2] text-[#DC2626]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  {t("decision.reject")}
                </button>
              </div>

              {/* Temp password — only when approving an add_new */}
              {decision === "approve" && isAddNew && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {t("decision.tempPassword")}
                  </label>
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder={t("decision.tempPasswordPlaceholder")}
                    className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t("decision.tempPasswordHint")}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {decision === "reject"
                    ? t("decision.rejectReason")
                    : t("decision.approveNote")}
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    decision === "reject"
                      ? t("decision.rejectReasonPlaceholder")
                      : t("decision.approveNotePlaceholder")
                  }
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                >
                  {t("decision.cancel")}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!decision || submitting}
                  className={`flex-1 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2 ${
                    decision === "reject"
                      ? "bg-[#DC2626] hover:bg-[#B91C1C]"
                      : "bg-[var(--color-primary)] hover:bg-[#001d5e]"
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : decision === "reject" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {t("decision.submit")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--color-text-secondary)] flex items-center gap-1 flex-shrink-0">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      <span className="text-[var(--color-text-primary)] font-medium truncate text-right">
        {value}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// AdminSupportSettings — bundles the team-wide settings panels.
// Admin gets full edit access on all three; the BusinessHours panel
// already respects `canEdit` for the supervisor-side read-only flow.
// ──────────────────────────────────────────────────────────────────

function AdminSupportSettings() {
  const t = useTranslations("adminDashboard.supportPage");
  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-xl p-4 text-sm text-[var(--color-text-secondary)]">
        <p className="font-medium text-[var(--color-text-primary)] mb-0.5">
          {t("settings.adminHeadingTitle")}
        </p>
        <p>{t("settings.adminHeadingBody")}</p>
      </div>
      <BusinessHoursPanel canEdit={true} />
      <SLAPoliciesPanel canEdit={true} />
      <AutoAssignmentPanel canEdit={true} />
      <TicketCategoriesPanel />
    </div>
  );
}

export default AdminSupportContent;
