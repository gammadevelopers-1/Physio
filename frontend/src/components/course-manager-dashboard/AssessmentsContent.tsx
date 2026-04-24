"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi, instructorApi } from "@/lib/api";
import type { AssessmentResponse } from "@/types/instructor-dashboard";
import {
  Search,
  FileText,
  Settings,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Shield,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Flag,
  Users,
  Eye,
  BookOpen,
  MoreVertical,
  Lock,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import SkeletonTableRow from "@/components/shared/SkeletonTableRow";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/* ────────── Interfaces ────────── */

interface ProctoringRules {
  webcamRequired?: boolean;
  browserLockdown?: boolean;
  tabSwitchAlert?: boolean;
}

interface SettingsForm {
  proctoringEnabled: boolean;
  proctoringRules: ProctoringRules;
  timeLimitEnforced: boolean;
  maxRetakes: number;
  retakeCoolingHours: number;
  retakeScorePolicy: string;
  retakeScope: string;
}

interface CourseDefaults {
  assessmentProctoringEnabled: boolean;
  assessmentTimeLimitEnforced: boolean;
  assessmentMaxRetakes: number;
  assessmentRetakeCoolingHours: number;
  assessmentRetakeScorePolicy: string;
  assessmentRetakeScope: string;
}

interface CourseOption {
  id: string;
  title: string;
  status?: string;
}

/* ────────── Component ────────── */

const AssessmentsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const manager = useManagerProfile();

  // Course selector
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Course-level defaults
  const [courseDefaults, setCourseDefaults] = useState<CourseDefaults | null>(null);
  const [courseDefaultsForm, setCourseDefaultsForm] = useState<CourseDefaults | null>(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Assessments for selected course
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Tab state
  const [activeTab, setActiveTab] = useState<"assessments" | "submissions">("assessments");

  // Per-assessment settings panel
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Flag modal state
  const [flagModal, setFlagModal] = useState<{ assessmentId: string; title: string } | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{ assessmentId: string; title: string } | null>(null);
  const [overrideStudents, setOverrideStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [overrideForm, setOverrideForm] = useState({ studentId: "", overrideType: "time_extension", value: 30, reason: "" });
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Submissions tab state
  const [selectedSubmissionAssessment, setSelectedSubmissionAssessment] = useState<string>("");
  const [submissions, setSubmissions] = useState<Array<{
    id: string;
    studentId: string;
    studentFirstName: string;
    studentLastName: string;
    studentEmail: string;
    assessmentId: string;
    status: string;
    score: number | null;
    totalMarks: number | null;
    percentage: number | null;
    // Null for auto-graded "not submitted" rows (deadline missed)
    submittedAt: string | null;
    gradedAt?: string | null;
    answers?: Array<{ questionId: string; answer: string; isCorrect: boolean | null; marksAwarded: number | null }> | null;
    instructorComment?: string | null;
    // Retake annotations from backend
    attemptNumber?: number;
    totalAttempts?: number;
    isEffective?: boolean;
    hasUnusedRetakeGrant?: boolean;
  }>>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<typeof submissions[number] | null>(null);
  // Tracks which student groups are expanded to show retake rows
  const [expandedRetakeStudents, setExpandedRetakeStudents] = useState<Set<string>>(new Set());

  // Allow retake modal state
  const [retakeModal, setRetakeModal] = useState<{
    submissionId: string;
    assessmentId: string;
    studentId: string;
    studentName: string;
    assessmentTitle: string;
    isAssignment: boolean;
  } | null>(null);
  const [retakeForm, setRetakeForm] = useState({ reason: "", newDueDate: "" });
  const [retakeSubmitting, setRetakeSubmitting] = useState(false);

  // Assessment preview state
  const [previewAssessment, setPreviewAssessment] = useState<{ id: string; title: string } | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Array<{
    id: string;
    type: string;
    questionText: string;
    questionTextAr?: string;
    options?: Array<{ text: string; textAr?: string; isCorrect: boolean }>;
    correctAnswer?: string;
    marks: number;
    difficultyLevel?: string;
  }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Submission preview questions cache (per submission view)
  const [submissionQuestions, setSubmissionQuestions] = useState<typeof previewQuestions>([]);
  const [submissionQuestionsLoading, setSubmissionQuestionsLoading] = useState(false);

  // All-courses aggregate assessments (for overview when no course selected)
  const [allAssessments, setAllAssessments] = useState<AssessmentResponse[]>([]);
  const [allAssessmentsLoading, setAllAssessmentsLoading] = useState(true);

  /* ────────── Fetch courses + all assessments on mount ────────── */
  useEffect(() => {
    setCoursesLoading(true);
    setAllAssessmentsLoading(true);
    Promise.all([
      courseManagerApi.getCourses({ limit: 200 }),
      courseManagerApi.getAssessments({ limit: 200 }),
    ])
      .then(([coursesRes, assessmentsRes]) => {
        setCourses(coursesRes.data.map((c) => ({ id: c.id, title: c.title, status: c.status })));
        setAllAssessments(assessmentsRes.data);
      })
      .catch(() => {
        setCourses([]);
        setAllAssessments([]);
      })
      .finally(() => {
        setCoursesLoading(false);
        setAllAssessmentsLoading(false);
      });
  }, []);

  /* ────────── Fetch course defaults when course selected ────────── */
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseDefaults(null);
      setCourseDefaultsForm(null);
      setAssessments([]);
      return;
    }
    courseManagerApi
      .getCourseDetail(selectedCourseId)
      .then((res) => {
        const r = res as unknown as Partial<CourseDefaults>;
        const d: CourseDefaults = {
          assessmentProctoringEnabled: r.assessmentProctoringEnabled ?? false,
          assessmentTimeLimitEnforced: r.assessmentTimeLimitEnforced ?? true,
          assessmentMaxRetakes: r.assessmentMaxRetakes ?? 0,
          assessmentRetakeCoolingHours: r.assessmentRetakeCoolingHours ?? 24,
          assessmentRetakeScorePolicy: r.assessmentRetakeScorePolicy ?? "highest",
          assessmentRetakeScope: r.assessmentRetakeScope ?? "full",
        };
        setCourseDefaults(d);
        setCourseDefaultsForm({ ...d });
      })
      .catch(() => {
        setCourseDefaults(null);
        setCourseDefaultsForm(null);
      });
  }, [selectedCourseId]);

  /* ────────── Fetch assessments for selected course ────────── */
  const fetchAssessments = useCallback(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { courseId: selectedCourseId };
    if (typeFilter !== "all") params.type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    courseManagerApi
      .getAssessments(params)
      .then((res) => setAssessments(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load assessments")
      )
      .finally(() => setLoading(false));
  }, [selectedCourseId, typeFilter, statusFilter]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchAssessments();
      setExpandedId(null);
      setSettingsForm(null);
      setSelectedSubmissionAssessment("");
      setSubmissions([]);
    }
  }, [selectedCourseId, fetchAssessments]);

  /* ────────── Fetch submissions ────────── */
  useEffect(() => {
    if (!selectedSubmissionAssessment) {
      setSubmissions([]);
      return;
    }
    setSubmissionsLoading(true);
    courseManagerApi
      .getSubmissions(selectedSubmissionAssessment)
      .then((res) => {
        const arr = Array.isArray(res)
          ? res
          : ((res as unknown as { data?: typeof submissions })?.data ?? []);
        setSubmissions(arr);
      })
      .catch(() => setSubmissions([]))
      .finally(() => setSubmissionsLoading(false));
  }, [selectedSubmissionAssessment]);

  /* ────────── Flagged IDs from assessments ────────── */
  useEffect(() => {
    const flagged = new Set<string>();
    for (const a of assessments) {
      if (a.flaggedAt) flagged.add(a.id);
    }
    setFlaggedIds(flagged);
  }, [assessments]);

  /* ────────── Handlers ────────── */

  const handleSaveCourseDefaults = async () => {
    if (!selectedCourseId || !courseDefaultsForm) return;
    setSavingDefaults(true);
    try {
      await courseManagerApi.updateCourse(selectedCourseId, {
        assessmentProctoringEnabled: courseDefaultsForm.assessmentProctoringEnabled,
        assessmentTimeLimitEnforced: courseDefaultsForm.assessmentTimeLimitEnforced,
        assessmentMaxRetakes: courseDefaultsForm.assessmentMaxRetakes,
        assessmentRetakeCoolingHours: courseDefaultsForm.assessmentRetakeCoolingHours,
        assessmentRetakeScorePolicy: courseDefaultsForm.assessmentRetakeScorePolicy,
        assessmentRetakeScope: courseDefaultsForm.assessmentRetakeScope,
      });
      setCourseDefaults({ ...courseDefaultsForm });
      toast.success(t("assessmentsPage.settings.saved"));
    } catch {
      toast.error(t("assessmentsPage.settings.error"));
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleFlag = async () => {
    if (!flagModal || !flagReason.trim()) return;
    setFlagging(true);
    try {
      await courseManagerApi.flagAssessment(flagModal.assessmentId, flagReason.trim());
      setFlaggedIds((prev) => new Set(prev).add(flagModal.assessmentId));
      setFlagModal(null);
      setFlagReason("");
      toast.success(t("assessmentsPage.flag.success") || "Flagged successfully");
    } catch {
      toast.error(t("assessmentsPage.flag.error") || "Failed to flag");
    } finally {
      setFlagging(false);
    }
  };

  // Load questions when viewing a graded submission
  useEffect(() => {
    if (viewingSubmission && viewingSubmission.status === "graded") {
      setSubmissionQuestionsLoading(true);
      courseManagerApi.getAssessmentQuestions(viewingSubmission.assessmentId)
        .then((qs) => setSubmissionQuestions(qs))
        .catch(() => setSubmissionQuestions([]))
        .finally(() => setSubmissionQuestionsLoading(false));
    } else {
      setSubmissionQuestions([]);
    }
  }, [viewingSubmission]);

  const handlePreviewAssessment = async (assessmentId: string, title: string) => {
    setPreviewAssessment({ id: assessmentId, title });
    setPreviewLoading(true);
    try {
      const questions = await courseManagerApi.getAssessmentQuestions(assessmentId);
      setPreviewQuestions(questions);
    } catch {
      toast.error(t("assessmentsPage.preview.loadError") || "Failed to load questions");
      setPreviewQuestions([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAllowRetake = async () => {
    if (!retakeModal) return;
    setRetakeSubmitting(true);
    try {
      await courseManagerApi.allowRetake(retakeModal.assessmentId, {
        studentId: retakeModal.studentId,
        reason: retakeForm.reason.trim() || undefined,
        newDueDate:
          retakeModal.isAssignment && retakeForm.newDueDate
            ? retakeForm.newDueDate + ":00+03:00"
            : undefined,
      });
      toast.success(t("assessmentsPage.retakeModal.success") || "Retake granted");
      setRetakeModal(null);
      setRetakeForm({ reason: "", newDueDate: "" });
      // Refresh submissions so any new attempt shows up
      if (selectedSubmissionAssessment) {
        courseManagerApi
          .getSubmissions(selectedSubmissionAssessment)
          .then((res) => {
            const arr = Array.isArray(res)
              ? res
              : ((res as unknown as { data?: typeof submissions })?.data ?? []);
            setSubmissions(arr);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t("assessmentsPage.retakeModal.error") || "Failed to grant retake");
    } finally {
      setRetakeSubmitting(false);
    }
  };

  const openOverrideModal = (assessmentId: string, title: string, courseId: string) => {
    setOverrideModal({ assessmentId, title });
    setOverrideStudents([]);
    courseManagerApi
      .getEnrollments({ courseId })
      .then((res) => {
        // Backend returns array directly; defensively handle wrapped { data: [...] } too
        const list = Array.isArray(res)
          ? res
          : ((res as unknown as { data?: unknown[] })?.data ?? []);
        setOverrideStudents(
          (list as Array<Record<string, unknown>>).map((e) => ({
            id: String(e.studentId || e.userId || e.id || ""),
            name:
              `${(e.studentFirstName as string) || (e.firstName as string) || ""} ${(e.studentLastName as string) || (e.lastName as string) || ""}`.trim() ||
              (e.studentEmail as string) ||
              (e.email as string) ||
              "Unknown",
          })),
        );
      })
      .catch(() => setOverrideStudents([]));
  };

  const handleOverride = async () => {
    if (!overrideModal || !overrideForm.studentId || !overrideForm.reason.trim()) return;
    setOverrideSubmitting(true);
    try {
      await courseManagerApi.createOverride(overrideModal.assessmentId, {
        studentId: overrideForm.studentId,
        overrideType: overrideForm.overrideType,
        value: overrideForm.value,
        reason: overrideForm.reason.trim(),
      });
      setOverrideModal(null);
      setOverrideForm({ studentId: "", overrideType: "time_extension", value: 30, reason: "" });
      toast.success(t("assessmentsPage.override.success") || "Override granted");
    } catch {
      toast.error(t("assessmentsPage.override.error"));
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const toggleSettings = (assessment: AssessmentResponse) => {
    if (expandedId === assessment.id) {
      setExpandedId(null);
      setSettingsForm(null);
    } else {
      setExpandedId(assessment.id);
      setSettingsForm({
        proctoringEnabled: assessment.proctoringEnabled ?? false,
        proctoringRules: {
          webcamRequired: assessment.proctoringRules?.webcamRequired ?? false,
          browserLockdown: assessment.proctoringRules?.browserLockdown ?? false,
          tabSwitchAlert: assessment.proctoringRules?.tabSwitchAlert ?? false,
        },
        timeLimitEnforced: assessment.timeLimitEnforced ?? true,
        maxRetakes: assessment.maxRetakes ?? 0,
        retakeCoolingHours: assessment.retakeCoolingHours ?? 24,
        retakeScorePolicy: assessment.retakeScorePolicy ?? "highest",
        retakeScope: assessment.retakeScope ?? "full",
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!expandedId || !settingsForm) return;
    setSaving(true);
    try {
      await instructorApi.updateAssessment(expandedId, {
        proctoringEnabled: settingsForm.proctoringEnabled,
        proctoringRules: settingsForm.proctoringRules,
        timeLimitEnforced: settingsForm.timeLimitEnforced,
        maxRetakes: settingsForm.maxRetakes,
        retakeCoolingHours: settingsForm.retakeCoolingHours,
        retakeScorePolicy: settingsForm.retakeScorePolicy,
        retakeScope: settingsForm.retakeScope,
      });
      setAssessments((prev) =>
        prev.map((a) =>
          a.id === expandedId
            ? {
                ...a,
                proctoringEnabled: settingsForm.proctoringEnabled,
                proctoringRules: settingsForm.proctoringRules,
                timeLimitEnforced: settingsForm.timeLimitEnforced,
                maxRetakes: settingsForm.maxRetakes,
                retakeCoolingHours: settingsForm.retakeCoolingHours,
                retakeScorePolicy: settingsForm.retakeScorePolicy,
                retakeScope: settingsForm.retakeScope,
              }
            : a
        )
      );
      toast.success(t("assessmentsPage.settings.saved"));
    } catch {
      toast.error(t("assessmentsPage.settings.error"));
    } finally {
      setSaving(false);
    }
  };

  /* ────────── Helpers ────────── */

  // Selected course (used for permission checks)
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;
  // Only draft and active courses can be edited
  const canEdit = selectedCourse
    ? selectedCourse.status === "draft" || selectedCourse.status === "active"
    : false;

  const filteredAssessments = assessments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      quiz: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
      exam: "bg-[#FEE2E2] text-[#EF4444]",
      assignment: "bg-[#DCFCE7] text-[#22C55E]",
      practical: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
      published: "bg-[#DCFCE7] text-[#22C55E]",
      closed: "bg-[#FEF3C7] text-[#D4A520]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  };

  /** Check if an assessment overrides course defaults */
  const hasOverride = (a: AssessmentResponse): boolean => {
    if (!courseDefaults) return false;
    return (
      a.proctoringEnabled !== courseDefaults.assessmentProctoringEnabled ||
      a.timeLimitEnforced !== courseDefaults.assessmentTimeLimitEnforced ||
      a.maxRetakes !== courseDefaults.assessmentMaxRetakes ||
      a.retakeCoolingHours !== courseDefaults.assessmentRetakeCoolingHours ||
      a.retakeScorePolicy !== courseDefaults.assessmentRetakeScorePolicy ||
      a.retakeScope !== courseDefaults.assessmentRetakeScope
    );
  };

  /* ────────── Sub-components ────────── */

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-[var(--color-surface-card)] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );

  const renderProctoringIndicators = (assessment: AssessmentResponse) => {
    const indicators = [];
    if (flaggedIds.has(assessment.id)) {
      indicators.push(
        <span key="flagged" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FFF7ED] text-[#EA580C]">
          <Flag className="w-3 h-3" />
          {t("assessmentsPage.flaggedBadge")}
        </span>
      );
    }
    if (hasOverride(assessment)) {
      indicators.push(
        <span key="override" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FEF3C7] text-[#D97706]">
          <Settings className="w-3 h-3" />
          {t("assessmentsPage.overrideBadge") || "Override"}
        </span>
      );
    }
    if (assessment.proctoringEnabled) {
      indicators.push(
        <span key="proctor" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-primary)]">
          <Shield className="w-3 h-3" />
          {t("assessmentsPage.proctoring.enabled")}
        </span>
      );
    }
    return indicators.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-1">{indicators}</div>
    ) : null;
  };

  /** Shared settings panel used for both course defaults and per-assessment */
  const renderSettingsFields = (
    form: SettingsForm,
    setForm: (f: SettingsForm) => void,
    courseHint?: CourseDefaults | null
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Time Settings */}
      <div className="bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[var(--color-primary)]" />
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("assessmentsPage.proctoring.timeLimitEnforced")}
          </h4>
        </div>
        <div className="space-y-1">
          <Toggle
            checked={form.timeLimitEnforced}
            onChange={(v) => setForm({ ...form, timeLimitEnforced: v })}
            label={t("assessmentsPage.proctoring.timeLimitEnforced")}
          />
          {courseHint && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("assessmentsPage.settings.courseDefault") || "Course default"}: {courseHint.assessmentTimeLimitEnforced ? t("assessmentsPage.settings.on") || "On" : t("assessmentsPage.settings.off") || "Off"}
            </p>
          )}
        </div>
      </div>

      {/* Retake Score Policy */}
      <div className="bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-4 h-4 text-[#8B5CF6]" />
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("assessmentsPage.retake.title")}
          </h4>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("assessmentsPage.retake.scorePolicyDesc") ||
            "Retakes are granted per-student from the submissions list. This policy decides which attempt counts in the gradebook."}
        </p>
        <div>
          <label className="text-sm text-[var(--color-text-secondary)] block mb-1">
            {t("assessmentsPage.retake.scorePolicy")}
          </label>
          <select
            value={form.retakeScorePolicy}
            onChange={(e) =>
              setForm({ ...form, retakeScorePolicy: e.target.value })
            }
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="highest">{t("assessmentsPage.retake.policies.highest")}</option>
            <option value="latest">{t("assessmentsPage.retake.policies.latest")}</option>
            <option value="average">{t("assessmentsPage.retake.policies.average")}</option>
          </select>
          {courseHint && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("assessmentsPage.settings.courseDefault") || "Course default"}: {courseHint.assessmentRetakeScorePolicy}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderSettingsPanel = (assessmentId: string) => {
    if (expandedId !== assessmentId || !settingsForm) return null;

    return (
      <div className="bg-[var(--color-surface-page)] border-t border-[var(--color-border)] px-4 py-4">
        <fieldset disabled={!canEdit} className={!canEdit ? "opacity-60 pointer-events-none" : ""}>
          {renderSettingsFields(settingsForm, setSettingsForm, courseDefaults)}
        </fieldset>

        {/* Save Button */}
        <div className="flex items-center gap-3 mt-4">
          {canEdit && (
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? t("assessmentsPage.settings.saving") : t("assessmentsPage.settings.save")}
            </button>
          )}
          <button
            onClick={() => {
              setExpandedId(null);
              setSettingsForm(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  /* ────────── Render ────────── */

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("assessmentsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("assessmentsPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Course Selector */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-2">
                  {t("assessmentsPage.selectCourse") || "Select Course"}
                </label>
                {coursesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("dashboard.loading") || "Loading..."}
                  </div>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full sm:w-96 px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">{t("assessmentsPage.allCourses") || "All Courses"}</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Overview dashboard when no course selected */}
              {!selectedCourseId && (
                <>
                  {allAssessmentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                    </div>
                  ) : (
                    <>
                      {/* Stats Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
                              <ClipboardList className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{allAssessments.length}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.total") || "Total Assessments"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                              <Check className="w-5 h-5 text-[#22C55E]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                                {allAssessments.filter((a) => a.status === "published").length}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.active") || "Published"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
                              <Users className="w-5 h-5 text-[#7C3AED]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                                {allAssessments.reduce((sum, a) => sum + (a.submissionCount ?? 0), 0)}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.submissions") || "Submissions"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                              <BarChart3 className="w-5 h-5 text-[#D97706]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{courses.length}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.courses") || "Courses"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Assessments by Course */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {t("assessmentsPage.byCourse") || "Assessments by Course"}
                        </h3>
                        {courses.length === 0 ? (
                          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                            <BookOpen className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("assessmentsPage.noCourses") || "No courses found"}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {courses.map((course) => {
                              const courseAssessments = allAssessments.filter((a) => a.courseId === course.id);
                              const published = courseAssessments.filter((a) => a.status === "published").length;
                              const totalSubs = courseAssessments.reduce((s, a) => s + (a.submissionCount ?? 0), 0);
                              return (
                                <button
                                  key={course.id}
                                  onClick={() => setSelectedCourseId(course.id)}
                                  className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 text-start hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
                                >
                                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 truncate group-hover:text-[var(--color-primary)] transition-colors">
                                    {course.title}
                                  </h4>
                                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                                    <span className="flex items-center gap-1">
                                      <ClipboardList className="w-3.5 h-3.5" />
                                      {courseAssessments.length} {t("assessmentsPage.assessmentsLabel") || "assessments"}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                                      {published} {t("assessmentsPage.stats.active") || "published"}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
                                      {totalSubs}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Course selected: show content */}
              {selectedCourseId && (
                <>
                  {/* Read-only banner for completed/archived courses */}
                  {!canEdit && selectedCourse && (
                    <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 mb-6 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-[#92400E]">
                          {t("assessmentsPage.readOnly.title") || "Read-only mode"}
                        </p>
                        <p className="text-xs text-[#B45309] mt-0.5">
                          {t("assessmentsPage.readOnly.desc") ||
                            `This course is ${selectedCourse.status}. Settings, assessments and per-student grants cannot be modified.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Course Assessment Defaults (collapsible) */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] mb-6 overflow-hidden">
                    <button
                      onClick={() => setDefaultsOpen(!defaultsOpen)}
                      className="w-full flex items-center justify-between px-4 py-4 hover:bg-[var(--color-surface-page)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                          <Settings className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div className="text-start">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {t("assessmentsPage.courseDefaults.title") || "Course Assessment Defaults"}
                          </h3>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("assessmentsPage.courseDefaults.subtitle") || "Default settings applied to all assessments in this course"}
                          </p>
                        </div>
                      </div>
                      {defaultsOpen ? (
                        <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                      )}
                    </button>

                    {defaultsOpen && courseDefaultsForm && (
                      <div className="border-t border-[var(--color-border)] px-4 py-4 bg-[var(--color-surface-page)]">
                        <fieldset disabled={!canEdit} className={!canEdit ? "opacity-60 pointer-events-none" : ""}>
                        {renderSettingsFields(
                          {
                            proctoringEnabled: courseDefaultsForm.assessmentProctoringEnabled,
                            proctoringRules: { webcamRequired: false, browserLockdown: false, tabSwitchAlert: false },
                            timeLimitEnforced: courseDefaultsForm.assessmentTimeLimitEnforced,
                            maxRetakes: courseDefaultsForm.assessmentMaxRetakes,
                            retakeCoolingHours: courseDefaultsForm.assessmentRetakeCoolingHours,
                            retakeScorePolicy: courseDefaultsForm.assessmentRetakeScorePolicy,
                            retakeScope: courseDefaultsForm.assessmentRetakeScope,
                          },
                          (f) =>
                            setCourseDefaultsForm({
                              assessmentProctoringEnabled: f.proctoringEnabled,
                              assessmentTimeLimitEnforced: f.timeLimitEnforced,
                              assessmentMaxRetakes: f.maxRetakes,
                              assessmentRetakeCoolingHours: f.retakeCoolingHours,
                              assessmentRetakeScorePolicy: f.retakeScorePolicy,
                              assessmentRetakeScope: f.retakeScope,
                            }),
                          null
                        )}
                        </fieldset>
                        {canEdit && (
                          <div className="flex items-center gap-3 mt-4">
                            <button
                              onClick={handleSaveCourseDefaults}
                              disabled={savingDefaults}
                              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {savingDefaults ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {savingDefaults
                                ? t("assessmentsPage.settings.saving")
                                : t("assessmentsPage.courseDefaults.save") || "Save Defaults"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tabs: Assessments | Submissions */}
                  <div className="flex gap-1 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-1 mb-6">
                    <button
                      onClick={() => setActiveTab("assessments")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "assessments"
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      {t("assessmentsPage.tabs.assessments")}
                    </button>
                    <button
                      onClick={() => setActiveTab("submissions")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "submissions"
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      {t("assessmentsPage.submissions.tab")}
                    </button>
                  </div>

                  {/* ═══════════ Assessments Tab ═══════════ */}
                  {activeTab === "assessments" && (
                    <>
                      {/* Stats Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.total")}</p>
                          <p className="text-2xl font-bold text-[var(--color-text-secondary)] mt-1">{assessments.length}</p>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.active")}</p>
                          <p className="text-2xl font-bold text-[#22C55E] mt-1">
                            {assessments.filter((a) => a.status === "published" || a.status === "active").length}
                          </p>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-[var(--color-primary)]" />
                            <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.submissions") || "Submissions"}</p>
                          </div>
                          <p className="text-2xl font-bold text-[var(--color-primary)] mt-1">
                            {assessments.reduce((sum, a) => sum + (a.submissionCount ?? 0), 0)}
                          </p>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-1">
                            <Flag className="w-3 h-3 text-[#EA580C]" />
                            <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.stats.flagged")}</p>
                          </div>
                          <p className="text-2xl font-bold text-[#EA580C] mt-1">
                            {flaggedIds.size}
                          </p>
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 relative">
                            <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
                            <input
                              type="text"
                              placeholder={t("assessmentsPage.searchPlaceholder")}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent`}
                            />
                          </div>
                          <div className="flex gap-3">
                            <select
                              value={typeFilter}
                              onChange={(e) => setTypeFilter(e.target.value)}
                              className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                              <option value="all">{t("assessmentsPage.filters.allTypes")}</option>
                              <option value="quiz">{t("assessmentsPage.filters.quiz")}</option>
                              <option value="exam">{t("assessmentsPage.filters.exam")}</option>
                              <option value="assignment">{t("assessmentsPage.filters.assignment")}</option>
                            </select>
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                              <option value="all">{t("assessmentsPage.filters.allStatus")}</option>
                              <option value="draft">{t("assessmentsPage.filters.draft")}</option>
                              <option value="published">Published</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Loading */}
                      {loading && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                          <table className="w-full">
                            <tbody>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonTableRow key={i} cols={6} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Error */}
                      {error && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                          <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
                          <button
                            onClick={fetchAssessments}
                            className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {t("dashboard.retry")}
                          </button>
                        </div>
                      )}

                      {/* Assessments table */}
                      {!loading && !error && filteredAssessments.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full table-fixed">
                              <colgroup>
                                <col className="w-[35%]" />
                                <col className="w-[12%]" />
                                <col className="w-[12%]" />
                                <col className="w-[13%]" />
                                <col className="w-[13%]" />
                                <col className="w-[15%]" />
                              </colgroup>
                              <thead>
                                <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.assessment")}</th>
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.type")}</th>
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.totalMarks")}</th>
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.passingMarks")}</th>
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.status")}</th>
                                  <th className="text-start text-xs font-medium text-[var(--color-text-secondary)] px-4 py-3">{t("assessmentsPage.table.actions")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-border)]">
                                {filteredAssessments.map((assessment) => {
                                  const badge = getStatusBadge(assessment.status);
                                  return (
                                    <tr key={assessment.id} className="group">
                                      <td colSpan={6} className="p-0">
                                        <table className="w-full table-fixed">
                                          <colgroup>
                                            <col className="w-[35%]" />
                                            <col className="w-[12%]" />
                                            <col className="w-[12%]" />
                                            <col className="w-[13%]" />
                                            <col className="w-[13%]" />
                                            <col className="w-[15%]" />
                                          </colgroup>
                                          <tbody>
                                            <tr
                                              className={`hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer ${
                                                expandedId === assessment.id ? "bg-[var(--color-surface-page)]" : ""
                                              }`}
                                              onClick={() => toggleSettings(assessment)}
                                            >
                                              <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{assessment.title}</p>
                                                {assessment.durationMinutes && (
                                                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                                    {assessment.durationMinutes} min
                                                  </p>
                                                )}
                                                {renderProctoringIndicators(assessment)}
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadge(assessment.type)}`}>
                                                  {t(`assessmentsPage.type.${assessment.type}`)}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="text-sm text-[var(--color-text-primary)]">{assessment.totalMarks}</span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="text-sm text-[var(--color-text-primary)]">{assessment.passingMarks}</span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${badge}`}>
                                                  {t(`assessmentsPage.status.${assessment.status}`)}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button
                                                      className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                                      title={t("assessmentsPage.table.actions")}
                                                    >
                                                      <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                                    <DropdownMenuItem onSelect={() => handlePreviewAssessment(assessment.id, assessment.title)}>
                                                      <Eye className="w-4 h-4" />
                                                      {t("assessmentsPage.preview.title") || "Preview"}
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                      <>
                                                        <DropdownMenuItem onSelect={() => toggleSettings(assessment)}>
                                                          <Settings className="w-4 h-4" />
                                                          {t("assessmentsPage.actions.configure")}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => openOverrideModal(assessment.id, assessment.title, assessment.courseId)}>
                                                          <Shield className="w-4 h-4" />
                                                          {t("assessmentsPage.override.title")}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                          danger
                                                          onSelect={() => setFlagModal({ assessmentId: assessment.id, title: assessment.title })}
                                                        >
                                                          <Flag className="w-4 h-4" />
                                                          {t("assessmentsPage.flagForReview")}
                                                        </DropdownMenuItem>
                                                      </>
                                                    )}
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </td>
                                            </tr>
                                            {expandedId === assessment.id && (
                                              <tr>
                                                <td colSpan={6} className="p-0">
                                                  {renderSettingsPanel(assessment.id)}
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Cards */}
                          <div className="md:hidden divide-y divide-[var(--color-border)]">
                            {filteredAssessments.map((assessment) => (
                              <div key={assessment.id}>
                                <div className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{assessment.title}</h3>
                                      {assessment.durationMinutes && (
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{assessment.durationMinutes} min</p>
                                      )}
                                      {renderProctoringIndicators(assessment)}
                                    </div>
                                    <button
                                      onClick={() => toggleSettings(assessment)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        expandedId === assessment.id
                                          ? "bg-[var(--color-primary)] text-white"
                                          : "hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                                      }`}
                                    >
                                      {expandedId === assessment.id ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(assessment.type)}`}>
                                      {t(`assessmentsPage.type.${assessment.type}`)}
                                    </span>
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(assessment.status)}`}>
                                      {t(`assessmentsPage.status.${assessment.status}`)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                                    <span>{t("assessmentsPage.table.totalMarks")}: {assessment.totalMarks}</span>
                                    <span>{t("assessmentsPage.table.passingMarks")}: {assessment.passingMarks}</span>
                                  </div>
                                  {/* Mobile actions */}
                                  <div className="flex items-center mt-3">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                          title={t("assessmentsPage.table.actions")}
                                        >
                                          <MoreVertical className="w-4 h-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                        <DropdownMenuItem onSelect={() => handlePreviewAssessment(assessment.id, assessment.title)}>
                                          <Eye className="w-4 h-4" />
                                          {t("assessmentsPage.preview.title") || "Preview"}
                                        </DropdownMenuItem>
                                        {canEdit && (
                                          <>
                                            <DropdownMenuItem onSelect={() => toggleSettings(assessment)}>
                                              <Settings className="w-4 h-4" />
                                              {t("assessmentsPage.actions.configure")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => openOverrideModal(assessment.id, assessment.title, assessment.courseId)}>
                                              <Shield className="w-4 h-4" />
                                              {t("assessmentsPage.override.title")}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              danger
                                              onSelect={() => setFlagModal({ assessmentId: assessment.id, title: assessment.title })}
                                            >
                                              <Flag className="w-4 h-4" />
                                              {t("assessmentsPage.flagForReview")}
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                                {renderSettingsPanel(assessment.id)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && !error && filteredAssessments.length === 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                          <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-[var(--color-text-secondary)]" />
                          </div>
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            {t("assessmentsPage.noAssessments")}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {t("assessmentsPage.noAssessmentsDesc")}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ═══════════ Submissions Tab ═══════════ */}
                  {activeTab === "submissions" && (
                    <div className="space-y-6">
                      {/* Assessment Selector */}
                      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                        <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-2">
                          {t("assessmentsPage.submissions.selectAssessment")}
                        </label>
                        <select
                          value={selectedSubmissionAssessment}
                          onChange={(e) => setSelectedSubmissionAssessment(e.target.value)}
                          className="w-full sm:w-80 px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          <option value="">{t("assessmentsPage.submissions.selectPlaceholder")}</option>
                          {assessments.map((a) => (
                            <option key={a.id} value={a.id}>{a.title}</option>
                          ))}
                        </select>
                      </div>

                      {!selectedSubmissionAssessment && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                          <Users className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.emptyDesc")}</p>
                        </div>
                      )}

                      {submissionsLoading && (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                        </div>
                      )}

                      {selectedSubmissionAssessment && !submissionsLoading && submissions.length === 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                          <Users className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.noSubmissions") || "No submissions yet for this assessment"}</p>
                        </div>
                      )}

                      {selectedSubmissionAssessment && !submissionsLoading && submissions.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                                  <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">{t("assessmentsPage.submissions.student")}</th>
                                  <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">{t("assessmentsPage.submissions.score")}</th>
                                  <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">{t("assessmentsPage.submissions.status")}</th>
                                  <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">{t("assessmentsPage.submissions.submitted")}</th>
                                  <th className="px-4 py-3 text-end text-xs font-semibold text-[var(--color-text-secondary)] uppercase">{t("assessmentsPage.submissions.actions")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-border)]">
                                {(() => {
                                  // Group submissions by student — show ONE primary row per student,
                                  // with retake versions nested/collapsible below.
                                  const grouped = new Map<string, typeof submissions>();
                                  for (const sub of submissions) {
                                    const list = grouped.get(sub.studentId);
                                    if (list) list.push(sub);
                                    else grouped.set(sub.studentId, [sub]);
                                  }

                                  const renderSubRow = (sub: typeof submissions[number], isNested: boolean) => {
                                    const subAssessment = assessments.find((a) => a.id === sub.assessmentId);
                                    const passingMarks = subAssessment?.passingMarks ?? 0;
                                    const totalMarks = sub.totalMarks ?? subAssessment?.totalMarks ?? 0;
                                    const isNotSubmitted = sub.submittedAt === null && sub.status === "graded";
                                    const isPassed = !isNotSubmitted && sub.score !== null && passingMarks > 0 && sub.score >= passingMarks;
                                    const isGraded = sub.status === "graded";
                                    return (
                                      <tr
                                        key={sub.id}
                                        className={`hover:bg-[var(--color-surface-page)] transition-colors ${isNested ? "bg-[#FAFAFA]" : ""}`}
                                      >
                                        <td className={`px-4 py-3 ${isNested ? "ps-10" : ""}`}>
                                          {isNested ? (
                                            <div className="flex items-center gap-2">
                                              <span className="inline-flex items-center gap-1 text-xs text-[#7C3AED]">
                                                <RotateCcw className="w-3 h-3" />
                                                {t("assessmentsPage.submissions.retakeLabel", { n: (sub.attemptNumber ?? 1) - 1 }) ||
                                                  `Retake ${(sub.attemptNumber ?? 1) - 1}`}
                                              </span>
                                              {sub.isEffective && (
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                                  {t("assessmentsPage.submissions.effective") || "Effective"}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <>
                                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                {sub.studentFirstName} {sub.studentLastName}
                                              </p>
                                              <p className="text-xs text-[var(--color-text-secondary)]">{sub.studentEmail}</p>
                                            </>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {isNotSubmitted ? (
                                            <span className="text-sm font-semibold text-[#EF4444]">0 / {totalMarks}</span>
                                          ) : sub.score !== null ? (
                                            <span className={`text-sm font-semibold ${isPassed ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                                              {sub.score} / {totalMarks}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-[var(--color-text-secondary)]">--</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                            isNotSubmitted ? "bg-[#FEE2E2] text-[#DC2626]"
                                              : isGraded ? "bg-[#DCFCE7] text-[#22C55E]"
                                              : "bg-[#FEF3C7] text-[#D97706]"
                                          }`}>
                                            {isNotSubmitted
                                              ? (t("assessmentsPage.submissions.notSubmitted") || "Not submitted")
                                              : isGraded ? t("assessmentsPage.submissions.graded") : t("assessmentsPage.submissions.pending")}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {sub.submittedAt ? (
                                            <p className="text-sm text-[var(--color-text-secondary)]">
                                              {formatDateHijri(sub.submittedAt, calendarFormat, { locale })}
                                            </p>
                                          ) : (
                                            <p className="text-sm text-[var(--color-text-secondary)]">—</p>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-end">
                                          <button
                                            onClick={() => setViewingSubmission(sub)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-border-subtle)] rounded-md hover:bg-[var(--color-border-subtle)] transition-colors"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            {t("assessmentsPage.actions.view")}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  };

                                  return Array.from(grouped.entries()).map(([studentId, attempts]) => {
                                    // Sort chronologically
                                    const sorted = [...attempts].sort(
                                      (a, b) => (a.attemptNumber ?? 1) - (b.attemptNumber ?? 1),
                                    );
                                    // The primary row is the effective attempt, or the latest
                                    const effectiveRow = sorted.find((s) => s.isEffective) || sorted[sorted.length - 1];
                                    const retakeRows = sorted.filter((s) => s.id !== effectiveRow.id);
                                    const hasRetakes = retakeRows.length > 0;
                                    const isExpanded = expandedRetakeStudents.has(studentId);
                                    const subAssessment = assessments.find((a) => a.id === effectiveRow.assessmentId);
                                    const passingMarks = subAssessment?.passingMarks ?? 0;
                                    const totalMarks = effectiveRow.totalMarks ?? subAssessment?.totalMarks ?? 0;
                                    const isNotSubmitted = effectiveRow.submittedAt === null && effectiveRow.status === "graded";
                                    const isPassed = !isNotSubmitted && effectiveRow.score !== null && passingMarks > 0 && effectiveRow.score >= passingMarks;
                                    const isGraded = effectiveRow.status === "graded";
                                    const anyGraded = sorted.some((s) => s.status === "graded");

                                    return (
                                      <React.Fragment key={studentId}>
                                        {/* Primary row */}
                                        <tr className="hover:bg-[var(--color-surface-page)] transition-colors">
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                              {hasRetakes && (
                                                <button
                                                  onClick={() => {
                                                    setExpandedRetakeStudents((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(studentId)) next.delete(studentId);
                                                      else next.add(studentId);
                                                      return next;
                                                    });
                                                  }}
                                                  className="p-0.5 hover:bg-[var(--color-border-subtle)] rounded"
                                                >
                                                  {isExpanded ? (
                                                    <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                                                  ) : (
                                                    <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                                                  )}
                                                </button>
                                              )}
                                              <div>
                                                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                  {effectiveRow.studentFirstName} {effectiveRow.studentLastName}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-secondary)]">{effectiveRow.studentEmail}</p>
                                                {hasRetakes && (
                                                  <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F3E8FF] text-[#7C3AED]">
                                                      <RotateCcw className="w-2.5 h-2.5" />
                                                      {sorted.length} {t("assessmentsPage.submissions.attempts") || "attempts"}
                                                    </span>
                                                    {effectiveRow.isEffective && (
                                                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                                        {t("assessmentsPage.submissions.effective") || "Effective"}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            {isNotSubmitted ? (
                                              <span className="text-sm font-semibold text-[#EF4444]">0 / {totalMarks}</span>
                                            ) : effectiveRow.score !== null ? (
                                              <span className={`text-sm font-semibold ${isPassed ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                                                {effectiveRow.score} / {totalMarks}
                                              </span>
                                            ) : (
                                              <span className="text-sm text-[var(--color-text-secondary)]">--</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                              isNotSubmitted ? "bg-[#FEE2E2] text-[#DC2626]"
                                                : isGraded ? "bg-[#DCFCE7] text-[#22C55E]"
                                                : "bg-[#FEF3C7] text-[#D97706]"
                                            }`}>
                                              {isNotSubmitted
                                                ? (t("assessmentsPage.submissions.notSubmitted") || "Not submitted")
                                                : isGraded ? t("assessmentsPage.submissions.graded") : t("assessmentsPage.submissions.pending")}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            {effectiveRow.submittedAt ? (
                                              <p className="text-sm text-[var(--color-text-secondary)]">
                                                {formatDateHijri(effectiveRow.submittedAt, calendarFormat, { locale })}
                                              </p>
                                            ) : (
                                              <p className="text-sm text-[var(--color-text-secondary)]">—</p>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-end">
                                            <div className="inline-flex items-center gap-1.5">
                                              <button
                                                onClick={() => setViewingSubmission(effectiveRow)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-border-subtle)] rounded-md hover:bg-[var(--color-border-subtle)] transition-colors"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                                {t("assessmentsPage.actions.view")}
                                              </button>
                                              {canEdit && anyGraded && subAssessment && (
                                                effectiveRow.hasUnusedRetakeGrant ? (
                                                  <span
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] rounded-md cursor-not-allowed"
                                                    title={t("assessmentsPage.retakeModal.pendingTooltip") || "Retake already granted — waiting for the student to submit"}
                                                  >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    {t("assessmentsPage.retakeModal.pending") || "Retake pending"}
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => {
                                                      setRetakeModal({
                                                        submissionId: effectiveRow.id,
                                                        assessmentId: effectiveRow.assessmentId,
                                                        studentId: effectiveRow.studentId,
                                                        studentName: `${effectiveRow.studentFirstName} ${effectiveRow.studentLastName}`.trim(),
                                                        assessmentTitle: subAssessment.title,
                                                        isAssignment: subAssessment.type === "assignment",
                                                      });
                                                      setRetakeForm({ reason: "", newDueDate: "" });
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7C3AED] bg-[#F3E8FF] rounded-md hover:bg-[#E9D5FF] transition-colors"
                                                    title={t("assessmentsPage.retakeModal.title") || "Allow retake"}
                                                  >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    {t("assessmentsPage.retakeModal.button") || "Allow Retake"}
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                        {/* Nested retake rows (expanded) */}
                                        {isExpanded && retakeRows.map((sub) => renderSubRow(sub, true))}
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submission Detail Modal */}
      {viewingSubmission && (() => {
        const sub = viewingSubmission;
        const assessment = assessments.find((a) => a.id === sub.assessmentId);
        const passingMarks = assessment?.passingMarks ?? 0;
        const totalMarks = sub.totalMarks ?? assessment?.totalMarks ?? 0;
        const isNotSubmitted = sub.submittedAt === null && sub.status === "graded";
        const isPassed = !isNotSubmitted && sub.score !== null && passingMarks > 0 && sub.score >= passingMarks;
        const isGraded = sub.status === "graded";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("assessmentsPage.submissions.details") || "Submission Details"}</h3>
                <button onClick={() => setViewingSubmission(null)} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg">
                  <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {sub.studentFirstName} {sub.studentLastName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{sub.studentEmail}</p>
                  </div>
                </div>
                {assessment && (
                  <div className="p-3 bg-[var(--color-surface-page)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.table.assessment")}</p>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">{assessment.title}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[var(--color-surface-page)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.score")}</p>
                    {isNotSubmitted ? (
                      <p className="text-lg font-bold text-[#EF4444]">
                        0 / {totalMarks}
                      </p>
                    ) : sub.score !== null ? (
                      <p className={`text-lg font-bold ${isPassed ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                        {sub.score} / {totalMarks}
                      </p>
                    ) : (
                      <p className="text-lg font-bold text-[var(--color-text-secondary)]">--</p>
                    )}
                  </div>
                  <div className="p-3 bg-[var(--color-surface-page)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.status")}</p>
                    {isNotSubmitted ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 bg-[#FEE2E2] text-[#DC2626]">
                        {t("assessmentsPage.submissions.notSubmitted") || "Not submitted"}
                      </span>
                    ) : (
                      <>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          isGraded ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEF3C7] text-[#D97706]"
                        }`}>
                          {isGraded ? t("assessmentsPage.submissions.graded") : t("assessmentsPage.submissions.pending")}
                        </span>
                        {isPassed && sub.score !== null && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ms-1 bg-[#DCFCE7] text-[#22C55E]">
                            {t("assessmentsPage.submissions.pass") || "Pass"}
                          </span>
                        )}
                        {sub.score !== null && !isPassed && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ms-1 bg-[#FEE2E2] text-[#EF4444]">
                            {t("assessmentsPage.submissions.fail") || "Fail"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[var(--color-surface-page)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.submitted")}</p>
                    {sub.submittedAt ? (
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {new Date(sub.submittedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-text-secondary)]">—</p>
                    )}
                  </div>
                  {sub.gradedAt && (
                    <div className="p-3 bg-[var(--color-surface-page)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("assessmentsPage.submissions.graded")}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {new Date(sub.gradedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Not-submitted notice — replaces the answers section for auto-zero rows */}
                {isNotSubmitted && (
                  <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                    <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#991B1B]">
                        {t("assessmentsPage.submissions.notSubmittedNotice") ||
                          "This student did not submit before the deadline and was auto-graded as 0."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Student answers — only available after instructor grades, and skip for not-submitted */}
                {isGraded && !isNotSubmitted && (
                  <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[var(--color-primary)]" />
                      {t("assessmentsPage.submissions.studentAnswers") || "Student Answers"}
                    </h4>
                    {submissionQuestionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                      </div>
                    ) : submissionQuestions.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
                        {t("assessmentsPage.submissions.noAnswers") || "No answers available"}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {submissionQuestions.map((q, idx) => {
                          const answerObj = sub.answers?.find((a) => a.questionId === q.id);
                          const studentAnswer = answerObj?.answer || "";
                          const marksAwarded = answerObj?.marksAwarded;
                          const isCorrect = answerObj?.isCorrect;
                          return (
                            <div key={q.id} className="border border-[var(--color-border)] rounded-lg p-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex-shrink-0">
                                    {idx + 1}
                                  </span>
                                  <p className="text-sm text-[var(--color-text-secondary)] font-medium">
                                    {isRTL && q.questionTextAr ? q.questionTextAr : q.questionText}
                                  </p>
                                </div>
                                {marksAwarded != null && (
                                  <span className={`text-xs font-semibold whitespace-nowrap ${isCorrect ? "text-[#22C55E]" : marksAwarded > 0 ? "text-[#D97706]" : "text-[#EF4444]"}`}>
                                    {marksAwarded}/{q.marks}
                                  </span>
                                )}
                              </div>
                              <div className="ms-7 space-y-2">
                                <div className={`p-2 rounded-md text-sm ${
                                  isCorrect === true ? "bg-[#DCFCE7] text-[#065F46]" :
                                  isCorrect === false ? "bg-[#FEE2E2] text-[#991B1B]" :
                                  "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                                }`}>
                                  <p className="text-[10px] uppercase font-semibold mb-1 opacity-70">
                                    {t("assessmentsPage.submissions.studentAnswer") || "Student Answer"}
                                  </p>
                                  <p>{studentAnswer || (t("assessmentsPage.submissions.noAnswer") || "(no answer)")}</p>
                                </div>
                                {/* Show correct answer for comparison */}
                                {q.options && q.options.length > 0 && (
                                  <div className="p-2 rounded-md bg-[var(--color-border-subtle)] text-[#1E40AF] text-sm">
                                    <p className="text-[10px] uppercase font-semibold mb-1 opacity-70">
                                      {t("assessmentsPage.preview.correctAnswer") || "Correct Answer"}
                                    </p>
                                    <p>{q.options.filter((o) => o.isCorrect).map((o) => isRTL && o.textAr ? o.textAr : o.text).join(", ")}</p>
                                  </div>
                                )}
                                {q.correctAnswer && (!q.options || q.options.length === 0) && (
                                  <div className="p-2 rounded-md bg-[var(--color-border-subtle)] text-[#1E40AF] text-sm">
                                    <p className="text-[10px] uppercase font-semibold mb-1 opacity-70">
                                      {t("assessmentsPage.preview.correctAnswer") || "Correct Answer"}
                                    </p>
                                    <p>{q.correctAnswer}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {sub.instructorComment && (
                      <div className="mt-4 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                        <p className="text-[10px] uppercase font-semibold text-[#92400E] mb-1">
                          {t("assessmentsPage.submissions.instructorComment") || "Instructor Comment"}
                        </p>
                        <p className="text-sm text-[#78350F]">{sub.instructorComment}</p>
                      </div>
                    )}
                  </div>
                )}

                {!isGraded && (
                  <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                    <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#92400E]">
                        {t("assessmentsPage.submissions.gradePending") || "Student answers will be available after the instructor grades this submission."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end p-6 border-t border-[var(--color-border)]">
                <button
                  onClick={() => setViewingSubmission(null)}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                >
                  {t("assessmentsPage.submissions.close") || "Close"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Emergency Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("assessmentsPage.override.title")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{overrideModal.title}</p>
              </div>
            </div>
            <div className="space-y-4">
              {/* Student Select */}
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                  {t("assessmentsPage.override.selectStudent")}
                </label>
                <select
                  value={overrideForm.studentId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{t("assessmentsPage.override.selectStudent")}</option>
                  {overrideStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {/* Helper text — extra attempts are handled by Allow Retake now */}
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("assessmentsPage.override.timeExtensionHint") ||
                  "Grants extra minutes on the timer (or extends the assignment deadline by the same minutes). For an extra attempt, use \"Allow Retake\" instead."}
              </p>
              {/* Value */}
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                  {t("assessmentsPage.override.minutes")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={overrideForm.value}
                  onChange={(e) => setOverrideForm({ ...overrideForm, value: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                  {t("assessmentsPage.override.reason")}
                </label>
                <textarea
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  rows={3}
                  placeholder={t("assessmentsPage.override.reasonPlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-6">
              <button
                onClick={() => { setOverrideModal(null); setOverrideForm({ studentId: "", overrideType: "time_extension", value: 30, reason: "" }); }}
                className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                {t("assessmentsPage.override.cancel")}
              </button>
              <button
                onClick={handleOverride}
                disabled={overrideSubmitting || !overrideForm.studentId || !overrideForm.reason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {t("assessmentsPage.override.grant")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Preview Modal — shows questions + correct answers for manager */}
      {previewAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("assessmentsPage.preview.title") || "Assessment Preview"}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">{previewAssessment.title}</p>
                </div>
              </div>
              <button onClick={() => { setPreviewAssessment(null); setPreviewQuestions([]); }} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                </div>
              ) : previewQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-[var(--color-border)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("assessmentsPage.preview.noQuestions") || "No questions added to this assessment yet"}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {previewQuestions.map((q, idx) => (
                    <div key={q.id} className="border border-[var(--color-border)] rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded">
                              {q.type.replace(/_/g, " ")}
                            </span>
                            {q.difficultyLevel && (
                              <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                                q.difficultyLevel === "easy" ? "bg-[#DCFCE7] text-[#22C55E]" :
                                q.difficultyLevel === "medium" ? "bg-[#FEF3C7] text-[#D97706]" :
                                "bg-[#FEE2E2] text-[#EF4444]"
                              }`}>
                                {q.difficultyLevel}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] font-medium">{isRTL && q.questionTextAr ? q.questionTextAr : q.questionText}</p>
                        </div>
                        <span className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{q.marks} {t("assessmentsPage.table.marks") || "marks"}</span>
                      </div>

                      {/* Multiple choice / single choice options */}
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                                opt.isCorrect ? "bg-[#DCFCE7] border-[#22C55E]" : "bg-[var(--color-surface-page)] border-[var(--color-border)]"
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                opt.isCorrect ? "bg-[#22C55E]" : "bg-[var(--color-border)]"
                              }`}>
                                {opt.isCorrect && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className={`text-sm ${opt.isCorrect ? "text-[#065F46] font-medium" : "text-[var(--color-text-secondary)]"}`}>
                                {isRTL && opt.textAr ? opt.textAr : opt.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* True/false or short answer */}
                      {q.correctAnswer && (!q.options || q.options.length === 0) && (
                        <div className="mt-3 p-3 bg-[#DCFCE7] border border-[#22C55E] rounded-lg">
                          <p className="text-[10px] uppercase font-semibold text-[#22C55E] mb-1">{t("assessmentsPage.preview.correctAnswer") || "Correct Answer"}</p>
                          <p className="text-sm text-[#065F46] font-medium">{q.correctAnswer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Allow Retake Modal */}
      {retakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F3E8FF] flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("assessmentsPage.retakeModal.title") || "Allow retake"}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {retakeModal.studentName} · {retakeModal.assessmentTitle}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("assessmentsPage.retakeModal.desc") ||
                  "Grant this student one extra attempt at this assessment. The student and the instructor will be notified."}
              </p>
              {retakeModal.isAssignment && (
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                    {t("assessmentsPage.retakeModal.newDeadline") || "New deadline"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <DateTimePicker
                    value={retakeForm.newDueDate}
                    onChange={(v) => setRetakeForm({ ...retakeForm, newDueDate: v })}
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                  {t("assessmentsPage.retakeModal.reason") || "Reason (optional)"}
                </label>
                <textarea
                  value={retakeForm.reason}
                  onChange={(e) => setRetakeForm({ ...retakeForm, reason: e.target.value })}
                  rows={3}
                  placeholder={
                    t("assessmentsPage.retakeModal.reasonPlaceholder") ||
                    "e.g. Student requested another attempt after low score"
                  }
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setRetakeModal(null);
                  setRetakeForm({ reason: "", newDueDate: "" });
                }}
                className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                {t("assessmentsPage.retakeModal.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleAllowRetake}
                disabled={
                  retakeSubmitting || (retakeModal.isAssignment && !retakeForm.newDueDate)
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-[#C4B5FD] text-white text-sm font-medium rounded-lg transition-colors"
              >
                {retakeSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {t("assessmentsPage.retakeModal.confirm") || "Allow Retake"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Confirmation Modal */}
      {flagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF7ED] flex items-center justify-center">
                <Flag className="w-5 h-5 text-[#EA580C]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("assessmentsPage.flag.title")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{flagModal.title}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1">
                {t("assessmentsPage.flag.reason")}
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={3}
                placeholder={t("assessmentsPage.flag.reasonPlaceholder")}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:border-transparent resize-none"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setFlagModal(null); setFlagReason(""); }}
                className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                {t("assessmentsPage.flag.cancel")}
              </button>
              <button
                onClick={handleFlag}
                disabled={flagging || !flagReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] disabled:bg-[#FDBA74] text-white text-sm font-medium rounded-lg transition-colors"
              >
                {flagging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                {t("assessmentsPage.flag.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssessmentsContent;
