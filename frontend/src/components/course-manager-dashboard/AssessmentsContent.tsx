"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
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
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Flag,
} from "lucide-react";
import SkeletonTableRow from "@/components/shared/SkeletonTableRow";
import ExportButton from "@/components/shared/ExportButton";

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

const AssessmentsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"assessments" | "blueprint">("assessments");

  // Settings panel state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Blueprint state
  const [blueprintCourseId, setBlueprintCourseId] = useState<string>("");
  const [blueprintData, setBlueprintData] = useState<Awaited<ReturnType<typeof courseManagerApi.getBlueprint>> | null>(null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);

  // Difficulty distribution state (per-assessment, fetched on demand in blueprint)
  const [difficultyData, setDifficultyData] = useState<Record<string, { easy: number; medium: number; hard: number; unset: number; total: number }>>({});

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

  const fetchAssessments = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (typeFilter !== "all") params.type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    courseManagerApi
      .getAssessments(params)
      .then((res) => setAssessments(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load assessments")
      )
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Fetch courses for blueprint selector
  useEffect(() => {
    courseManagerApi.getCourses().then((res) => {
      setCourses(res.data.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    }).catch(() => {});
  }, []);

  const fetchBlueprint = useCallback((courseId: string) => {
    if (!courseId) return;
    setBlueprintLoading(true);
    courseManagerApi
      .getBlueprint(courseId)
      .then((res) => setBlueprintData(res))
      .catch(() => setBlueprintData(null))
      .finally(() => setBlueprintLoading(false));
  }, []);

  useEffect(() => {
    if (blueprintCourseId) fetchBlueprint(blueprintCourseId);
  }, [blueprintCourseId, fetchBlueprint]);

  // Populate flaggedIds from fetched assessments (check for flaggedAt field)
  useEffect(() => {
    const flagged = new Set<string>();
    for (const a of assessments) {
      if (a.flaggedAt) {
        flagged.add(a.id);
      }
    }
    setFlaggedIds(flagged);
  }, [assessments]);

  // Fetch difficulty distribution for all assessments in blueprint when data changes
  useEffect(() => {
    if (!blueprintData) return;
    const allAssessmentIds = new Set<string>();
    for (const row of blueprintData.matrix) {
      for (const a of row.assessments) {
        allAssessmentIds.add(a.assessmentId);
      }
    }
    for (const a of blueprintData.unlinkedAssessments) {
      allAssessmentIds.add(a.assessmentId);
    }
    for (const id of allAssessmentIds) {
      if (!difficultyData[id]) {
        courseManagerApi.getDifficultyDistribution(id).then((data) => {
          setDifficultyData((prev) => ({ ...prev, [id]: data }));
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintData]);

  const handleFlag = async () => {
    if (!flagModal || !flagReason.trim()) return;
    setFlagging(true);
    try {
      await courseManagerApi.flagAssessment(flagModal.assessmentId, flagReason.trim());
      setFlaggedIds((prev) => new Set(prev).add(flagModal.assessmentId));
      setFlagModal(null);
      setFlagReason("");
    } catch {
      // silently handle
    } finally {
      setFlagging(false);
    }
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
    } catch {
      alert(t("assessmentsPage.override.error"));
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const filteredAssessments = assessments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      quiz: "bg-[#EFF6FF] text-[#3B82F6]",
      exam: "bg-[#FEE2E2] text-[#EF4444]",
      assignment: "bg-[#DCFCE7] text-[#22C55E]",
      practical: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || "bg-[#F3F4F6] text-[#6B7280]";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      published: "bg-[#DCFCE7] text-[#22C55E]",
      closed: "bg-[#FEF3C7] text-[#D4A520]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || "bg-[#F3F4F6] text-[#6B7280]";
  };

  const toggleSettings = (assessment: AssessmentResponse) => {
    if (expandedId === assessment.id) {
      setExpandedId(null);
      setSettingsForm(null);
      setSaveSuccess(null);
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
      setSaveSuccess(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!expandedId || !settingsForm) return;
    setSaving(true);
    setSaveSuccess(null);
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
      setSaveSuccess(expandedId);
      // Update local state
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
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch {
      setSaveSuccess(null);
      alert(t("assessmentsPage.settings.error"));
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#374151]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-[#3B82F6]" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );

  const renderSettingsPanel = (assessmentId: string) => {
    if (expandedId !== assessmentId || !settingsForm) return null;

    return (
      <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Proctoring Settings */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#3B82F6]" />
              <h4 className="text-sm font-semibold text-[#1F2937]">
                {t("assessmentsPage.proctoring.title")}
              </h4>
            </div>
            <div className="space-y-1">
              <Toggle
                checked={settingsForm.proctoringEnabled}
                onChange={(v) =>
                  setSettingsForm({ ...settingsForm, proctoringEnabled: v })
                }
                label={t("assessmentsPage.proctoring.enabled")}
              />
              {settingsForm.proctoringEnabled && (
                <>
                  <Toggle
                    checked={settingsForm.proctoringRules.webcamRequired ?? false}
                    onChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        proctoringRules: { ...settingsForm.proctoringRules, webcamRequired: v },
                      })
                    }
                    label={t("assessmentsPage.proctoring.webcamRequired")}
                  />
                  <Toggle
                    checked={settingsForm.proctoringRules.browserLockdown ?? false}
                    onChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        proctoringRules: { ...settingsForm.proctoringRules, browserLockdown: v },
                      })
                    }
                    label={t("assessmentsPage.proctoring.browserLockdown")}
                  />
                  <Toggle
                    checked={settingsForm.proctoringRules.tabSwitchAlert ?? false}
                    onChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        proctoringRules: { ...settingsForm.proctoringRules, tabSwitchAlert: v },
                      })
                    }
                    label={t("assessmentsPage.proctoring.tabSwitchAlert")}
                  />
                </>
              )}
              <Toggle
                checked={settingsForm.timeLimitEnforced}
                onChange={(v) =>
                  setSettingsForm({ ...settingsForm, timeLimitEnforced: v })
                }
                label={t("assessmentsPage.proctoring.timeLimitEnforced")}
              />
            </div>
          </div>

          {/* Retake Rules */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw className="w-4 h-4 text-[#8B5CF6]" />
              <h4 className="text-sm font-semibold text-[#1F2937]">
                {t("assessmentsPage.retake.title")}
              </h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#374151] block mb-1">
                  {t("assessmentsPage.retake.maxRetakes")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={settingsForm.maxRetakes}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxRetakes: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                />
                {settingsForm.maxRetakes === 0 && (
                  <p className="text-xs text-[#6B7280] mt-1">
                    {t("assessmentsPage.retake.unlimited")}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">
                  {t("assessmentsPage.retake.coolingHours")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={settingsForm.retakeCoolingHours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      retakeCoolingHours: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">
                  {t("assessmentsPage.retake.scorePolicy")}
                </label>
                <select
                  value={settingsForm.retakeScorePolicy}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      retakeScorePolicy: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  <option value="highest">{t("assessmentsPage.retake.policies.highest")}</option>
                  <option value="latest">{t("assessmentsPage.retake.policies.latest")}</option>
                  <option value="average">{t("assessmentsPage.retake.policies.average")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">
                  {t("assessmentsPage.retake.scope")}
                </label>
                <select
                  value={settingsForm.retakeScope}
                  onChange={(e) => setSettingsForm({ ...settingsForm, retakeScope: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  <option value="full">{t("assessmentsPage.retake.scopeFull")}</option>
                  <option value="failed_sections">{t("assessmentsPage.retake.scopeFailedSections")}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#93C5FD] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? t("assessmentsPage.settings.saving") : t("assessmentsPage.settings.save")}
          </button>
          <button
            onClick={() => {
              setExpandedId(null);
              setSettingsForm(null);
              setSaveSuccess(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {saveSuccess === assessmentId && (
            <span className="text-sm text-[#22C55E] flex items-center gap-1">
              <Check className="w-4 h-4" />
              {t("assessmentsPage.settings.saved")}
            </span>
          )}
        </div>
      </div>
    );
  };

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
    if (assessment.proctoringEnabled) {
      indicators.push(
        <span key="proctor" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#EFF6FF] text-[#3B82F6]">
          <Shield className="w-3 h-3" />
          {t("assessmentsPage.proctoring.enabled")}
        </span>
      );
    }
    if (assessment.maxRetakes > 0) {
      indicators.push(
        <span key="retake" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#F3E8FF] text-[#8B5CF6]">
          <RotateCcw className="w-3 h-3" />
          {assessment.maxRetakes}x
        </span>
      );
    }
    return indicators.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-1">{indicators}</div>
    ) : null;
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("assessmentsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("assessmentsPage.subtitle")}
                  </p>
                </div>
                <ExportButton
                  tableType="assessments"
                  filters={{
                    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
                    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
                  }}
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 mb-6">
                <button
                  onClick={() => setActiveTab("assessments")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "assessments"
                      ? "bg-[#3B82F6] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {t("assessmentsPage.tabs.assessments")}
                </button>
                <button
                  onClick={() => setActiveTab("blueprint")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "blueprint"
                      ? "bg-[#3B82F6] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  {t("assessmentsPage.tabs.blueprint")}
                </button>
              </div>

              {activeTab === "assessments" && (
              <>
              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{assessments.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.active")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {assessments.filter((a) => a.status === "published" || a.status === "active").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-[#3B82F6]" />
                    <p className="text-xs text-[#6B7280]">{t("assessmentsPage.proctoring.enabled")}</p>
                  </div>
                  <p className="text-2xl font-bold text-[#3B82F6] mt-1">
                    {assessments.filter((a) => a.proctoringEnabled).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-[#8B5CF6]" />
                    <p className="text-xs text-[#6B7280]">{t("assessmentsPage.retake.title")}</p>
                  </div>
                  <p className="text-2xl font-bold text-[#8B5CF6] mt-1">
                    {assessments.filter((a) => a.maxRetakes > 0).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-1">
                    <Flag className="w-3 h-3 text-[#EA580C]" />
                    <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.flagged")}</p>
                  </div>
                  <p className="text-2xl font-bold text-[#EA580C] mt-1">
                    {flaggedIds.size}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("assessmentsPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("assessmentsPage.filters.allTypes")}</option>
                      <option value="quiz">{t("assessmentsPage.filters.quiz")}</option>
                      <option value="exam">{t("assessmentsPage.filters.exam")}</option>
                      <option value="assignment">{t("assessmentsPage.filters.assignment")}</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("assessmentsPage.filters.allStatus")}</option>
                      <option value="draft">{t("assessmentsPage.filters.draft")}</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} cols={6} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280] mb-4">{error}</p>
                  <button
                    onClick={fetchAssessments}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && filteredAssessments.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
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
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.assessment")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.type")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.totalMarks")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.passingMarks")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.status")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
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
                                    className={`hover:bg-[#F9FAFB] transition-colors cursor-pointer ${
                                      expandedId === assessment.id ? "bg-[#F9FAFB]" : ""
                                    }`}
                                    onClick={() => toggleSettings(assessment)}
                                  >
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-[#1F2937] truncate">{assessment.title}</p>
                                      {assessment.durationMinutes && (
                                        <p className="text-xs text-[#6B7280] mt-0.5">
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
                                      <span className="text-sm text-[#1F2937]">{assessment.totalMarks}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-[#1F2937]">{assessment.passingMarks}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${badge}`}>
                                        {t(`assessmentsPage.status.${assessment.status}`)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSettings(assessment);
                                          }}
                                          className={`p-1.5 rounded-lg transition-colors ${
                                            expandedId === assessment.id
                                              ? "bg-[#3B82F6] text-white"
                                              : "hover:bg-[#F3F4F6] text-[#6B7280]"
                                          }`}
                                          title={t("assessmentsPage.actions.configure")}
                                        >
                                          <Settings className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOverrideModal({ assessmentId: assessment.id, title: assessment.title });
                                            courseManagerApi.getEnrollments({ courseId: assessment.courseId }).then((res) => {
                                              setOverrideStudents(res.data.map((e: any) => ({
                                                id: e.studentId || e.userId || e.id,
                                                name: `${e.studentFirstName || e.firstName || ''} ${e.studentLastName || e.lastName || ''}`.trim() || e.studentEmail || e.email || 'Unknown',
                                              })));
                                            }).catch(() => setOverrideStudents([]));
                                          }}
                                          className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors"
                                          title={t("assessmentsPage.override.title")}
                                        >
                                          <Shield className="w-4 h-4" />
                                        </button>
                                      </div>
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
                  <div className="md:hidden divide-y divide-[#E5E7EB]">
                    {filteredAssessments.map((assessment) => (
                      <div key={assessment.id}>
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-medium text-[#1F2937]">{assessment.title}</h3>
                              {assessment.durationMinutes && (
                                <p className="text-xs text-[#6B7280] mt-0.5">{assessment.durationMinutes} min</p>
                              )}
                              {renderProctoringIndicators(assessment)}
                            </div>
                            <button
                              onClick={() => toggleSettings(assessment)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                expandedId === assessment.id
                                  ? "bg-[#3B82F6] text-white"
                                  : "hover:bg-[#F3F4F6] text-[#6B7280]"
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
                          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                            <span>{t("assessmentsPage.table.totalMarks")}: {assessment.totalMarks}</span>
                            <span>{t("assessmentsPage.table.passingMarks")}: {assessment.passingMarks}</span>
                          </div>
                        </div>
                        {renderSettingsPanel(assessment.id)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !error && filteredAssessments.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("assessmentsPage.noAssessments")}
                  </h3>
                  <p className="text-sm text-[#6B7280]">
                    {t("assessmentsPage.noAssessmentsDesc")}
                  </p>
                </div>
              )}
              </>
              )}

              {activeTab === "blueprint" && (
                <div className="space-y-6">
                  {/* Course Selector */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <label className="text-sm font-medium text-[#374151] block mb-2">
                      {t("assessmentsPage.blueprint.selectCourse")}
                    </label>
                    <select
                      value={blueprintCourseId}
                      onChange={(e) => setBlueprintCourseId(e.target.value)}
                      className="w-full sm:w-80 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="">{t("assessmentsPage.blueprint.selectCourse")}</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {!blueprintCourseId && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                      <LayoutGrid className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" />
                      <p className="text-sm text-[#6B7280]">{t("assessmentsPage.blueprint.noCourse")}</p>
                    </div>
                  )}

                  {blueprintLoading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                    </div>
                  )}

                  {blueprintCourseId && !blueprintLoading && blueprintData && (
                    <>
                      {/* Coverage Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                          <p className="text-3xl font-bold text-[#3B82F6]">{blueprintData.coveragePercent}%</p>
                          <p className="text-xs text-[#6B7280] mt-1">{t("assessmentsPage.blueprint.coverage")}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                          <p className="text-3xl font-bold text-[#1F2937]">{blueprintData.totalModules}</p>
                          <p className="text-xs text-[#6B7280] mt-1">{t("assessmentsPage.blueprint.module")}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                          <p className="text-3xl font-bold text-[#22C55E]">{blueprintData.coveredModules}</p>
                          <p className="text-xs text-[#6B7280] mt-1">{t("assessmentsPage.blueprint.coveredModules")}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                          <p className="text-3xl font-bold text-[#EF4444]">{blueprintData.gapModules}</p>
                          <p className="text-xs text-[#6B7280] mt-1">{t("assessmentsPage.blueprint.gaps")}</p>
                        </div>
                        {/* Difficulty Distribution Summary */}
                        {(() => {
                          const allIds = [
                            ...blueprintData.matrix.flatMap((r) => r.assessments.map((a) => a.assessmentId)),
                            ...blueprintData.unlinkedAssessments.map((a) => a.assessmentId),
                          ];
                          const totals = { easy: 0, medium: 0, hard: 0 };
                          let totalQ = 0;
                          for (const id of allIds) {
                            const d = difficultyData[id];
                            if (d) {
                              totals.easy += d.easy;
                              totals.medium += d.medium;
                              totals.hard += d.hard;
                              totalQ += d.total;
                            }
                          }
                          return (
                            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                              <p className="text-xs text-[#6B7280] mb-2">{t("assessmentsPage.difficulty.title")}</p>
                              {totalQ > 0 ? (
                                <>
                                  <div className="flex h-3 rounded-full overflow-hidden mb-2">
                                    <div className="bg-[#22C55E]" style={{ width: `${(totals.easy / totalQ) * 100}%` }} />
                                    <div className="bg-[#F59E0B]" style={{ width: `${(totals.medium / totalQ) * 100}%` }} />
                                    <div className="bg-[#EF4444]" style={{ width: `${(totals.hard / totalQ) * 100}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-[#6B7280]">
                                    <span className="text-[#22C55E]">{t("assessmentsPage.difficulty.easy")} {totals.easy}</span>
                                    <span className="text-[#F59E0B]">{t("assessmentsPage.difficulty.medium")} {totals.medium}</span>
                                    <span className="text-[#EF4444]">{t("assessmentsPage.difficulty.hard")} {totals.hard}</span>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-[#9CA3AF]">—</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Coverage Grid */}
                      {blueprintData.totalModules === 0 ? (
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                          <p className="text-sm text-[#6B7280]">{t("assessmentsPage.blueprint.noModules")}</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                                    {t("assessmentsPage.blueprint.module")}
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase">
                                    {t("assessmentsPage.blueprint.coverage")}
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                                    {t("assessmentsPage.blueprint.linked")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E5E7EB]">
                                {blueprintData.matrix.map((row) => (
                                  <tr key={row.moduleId} className="hover:bg-[#F9FAFB]">
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-[#1F2937]">{row.moduleTitle}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {row.covered ? (
                                        <CheckCircle2 className="w-5 h-5 text-[#22C55E] mx-auto" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-[#EF4444] mx-auto" />
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {row.assessments.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {row.assessments.map((a) => {
                                            const d = difficultyData[a.assessmentId];
                                            return (
                                              <div key={a.assessmentId} className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(a.type)}`}>
                                                  {a.title} ({a.questionCount} {t("assessmentsPage.blueprint.questions")})
                                                </span>
                                                {d && d.total > 0 && (
                                                  <div className="flex h-1.5 w-16 rounded-full overflow-hidden" title={`E:${d.easy} M:${d.medium} H:${d.hard}`}>
                                                    <div className="bg-[#22C55E]" style={{ width: `${(d.easy / d.total) * 100}%` }} />
                                                    <div className="bg-[#F59E0B]" style={{ width: `${(d.medium / d.total) * 100}%` }} />
                                                    <div className="bg-[#EF4444]" style={{ width: `${(d.hard / d.total) * 100}%` }} />
                                                  </div>
                                                )}
                                                {flaggedIds.has(a.assessmentId) ? (
                                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-[#EA580C]">
                                                    <Flag className="w-3 h-3" />
                                                    {t("assessmentsPage.flaggedBadge")}
                                                  </span>
                                                ) : d && d.total > 0 && (d.easy / d.total > 0.8 || d.medium / d.total > 0.8 || d.hard / d.total > 0.8) ? (
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setFlagModal({ assessmentId: a.assessmentId, title: a.title }); }}
                                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-[#EA580C] bg-[#FFF7ED] hover:bg-[#FFEDD5] transition-colors"
                                                    title={t("assessmentsPage.flagForReview")}
                                                  >
                                                    <Flag className="w-3 h-3" />
                                                  </button>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-[#9CA3AF]">—</span>
                                          <button
                                            onClick={() => setFlagModal({ assessmentId: row.moduleId, title: row.moduleTitle })}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#EA580C] bg-[#FFF7ED] hover:bg-[#FFEDD5] transition-colors"
                                            title={t("assessmentsPage.flagForReview")}
                                          >
                                            <Flag className="w-3 h-3" />
                                            {t("assessmentsPage.flagForReview")}
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Unlinked Assessments */}
                      {blueprintData.unlinkedAssessments.length > 0 && (
                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                          <h3 className="text-sm font-semibold text-[#1F2937] mb-2">
                            {t("assessmentsPage.blueprint.unlinked")}
                          </h3>
                          <p className="text-xs text-[#6B7280] mb-3">
                            {t("assessmentsPage.blueprint.unlinkedDesc")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {blueprintData.unlinkedAssessments.map((a) => (
                              <span
                                key={a.assessmentId}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadge(a.type)}`}
                              >
                                {a.title} ({a.questionCount} {t("assessmentsPage.blueprint.questions")})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("assessmentsPage.override.title")}
                </h3>
                <p className="text-sm text-[#6B7280]">{overrideModal.title}</p>
              </div>
            </div>
            <div className="space-y-4">
              {/* Student Select */}
              <div>
                <label className="text-sm font-medium text-[#374151] block mb-1">
                  {t("assessmentsPage.override.selectStudent")}
                </label>
                <select
                  value={overrideForm.studentId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  <option value="">{t("assessmentsPage.override.selectStudent")}</option>
                  {overrideStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {/* Override Type */}
              <div>
                <label className="text-sm font-medium text-[#374151] block mb-1">
                  {t("assessmentsPage.override.type")}
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm" style={{ borderColor: overrideForm.overrideType === 'time_extension' ? '#3B82F6' : '#E5E7EB', background: overrideForm.overrideType === 'time_extension' ? '#EFF6FF' : 'white' }}>
                    <input type="radio" name="overrideType" value="time_extension" checked={overrideForm.overrideType === 'time_extension'} onChange={(e) => setOverrideForm({ ...overrideForm, overrideType: e.target.value, value: 30 })} className="sr-only" />
                    {t("assessmentsPage.override.timeExtension")}
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm" style={{ borderColor: overrideForm.overrideType === 'extra_attempts' ? '#3B82F6' : '#E5E7EB', background: overrideForm.overrideType === 'extra_attempts' ? '#EFF6FF' : 'white' }}>
                    <input type="radio" name="overrideType" value="extra_attempts" checked={overrideForm.overrideType === 'extra_attempts'} onChange={(e) => setOverrideForm({ ...overrideForm, overrideType: e.target.value, value: 1 })} className="sr-only" />
                    {t("assessmentsPage.override.extraAttempts")}
                  </label>
                </div>
              </div>
              {/* Value */}
              <div>
                <label className="text-sm font-medium text-[#374151] block mb-1">
                  {overrideForm.overrideType === 'time_extension' ? t("assessmentsPage.override.minutes") : t("assessmentsPage.override.attempts")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={overrideForm.value}
                  onChange={(e) => setOverrideForm({ ...overrideForm, value: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>
              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-[#374151] block mb-1">
                  {t("assessmentsPage.override.reason")}
                </label>
                <textarea
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  rows={3}
                  placeholder={t("assessmentsPage.override.reasonPlaceholder")}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-6">
              <button
                onClick={() => { setOverrideModal(null); setOverrideForm({ studentId: "", overrideType: "time_extension", value: 30, reason: "" }); }}
                className="px-4 py-2 border border-[#E5E7EB] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#F3F4F6] transition-colors"
              >
                {t("assessmentsPage.override.cancel")}
              </button>
              <button
                onClick={handleOverride}
                disabled={overrideSubmitting || !overrideForm.studentId || !overrideForm.reason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#93C5FD] text-white text-sm font-medium rounded-lg transition-colors"
              >
                {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {t("assessmentsPage.override.grant")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Confirmation Modal */}
      {flagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF7ED] flex items-center justify-center">
                <Flag className="w-5 h-5 text-[#EA580C]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("assessmentsPage.flag.title")}
                </h3>
                <p className="text-sm text-[#6B7280]">{flagModal.title}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[#374151] block mb-1">
                {t("assessmentsPage.flag.reason")}
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={3}
                placeholder={t("assessmentsPage.flag.reasonPlaceholder")}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:border-transparent resize-none"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setFlagModal(null); setFlagReason(""); }}
                className="px-4 py-2 border border-[#E5E7EB] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#F3F4F6] transition-colors"
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
