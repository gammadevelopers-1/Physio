"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  MoreVertical,
  ChevronRight,
  AlertTriangle,
  Mail,
  Calendar,
  Ticket,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { instructorApi, ApiError } from "@/lib/api";

interface AtRiskLearner {
  id: string;
  name: string;
  initials: string;
  riskType: "lowAttendance" | "lowScore" | "inactive";
  riskValue: string;
  course?: string;
  email?: string;
  enrolledCourseIds?: string[];
}

interface CourseOption {
  value: string;
  label: string;
}

interface AtRiskLearnersProps {
  learners: AtRiskLearner[];
  visibleCount?: number;
  courses?: CourseOption[];
  onRefresh?: () => void;
}

const AtRiskLearners = ({
  learners,
  visibleCount = 5,
  courses = [],
  onRefresh,
}: AtRiskLearnersProps) => {
  const t = useTranslations("instructorDashboard");
  const tA = useTranslations("accessibility");
  const router = useRouter();
  const locale = useLocale();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRiskBadgeStyle = (riskType: string) => {
    switch (riskType) {
      case "lowAttendance":
        return "bg-[#FEE2E2] text-[#EF4444]";
      case "lowScore":
        return "bg-[#FFEDD5] text-[#F97316]";
      case "inactive":
        return "bg-[#FEF9C3] text-[#EAB308]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getRiskLabel = (riskType: string, value: string) => {
    switch (riskType) {
      case "lowAttendance":
        return `${t("atRisk.lowAttendance")} ${value}`;
      case "lowScore":
        return `${t("atRisk.lowScore")} ${value}`;
      case "inactive":
        return `${t("atRisk.inactive")} ${value}`;
      default:
        return value;
    }
  };

  const handleSendReminder = useCallback(async (learner: AtRiskLearner) => {
    setOpenDropdown(null);
    setActionLoading(learner.id);
    try {
      await instructorApi.createIntervention({
        type: "email",
        studentId: learner.id,
        courseId: learner.enrolledCourseIds?.[0],
      });
      toast.success(t("atRisk.reminderSent"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("atRisk.reminderFailed")
      );
    } finally {
      setActionLoading(null);
    }
  }, [t]);

  const handleScheduleMakeup = useCallback((learner: AtRiskLearner) => {
    setOpenDropdown(null);
    const courseId = learner.enrolledCourseIds?.[0] || "";
    router.push(
      `/${locale}/dashboard/instructor/sessions?openSchedule=true&courseId=${courseId}&isMakeup=true&studentId=${learner.id}`
    );
  }, [router, locale]);

  const handleOpenTicket = useCallback(async (learner: AtRiskLearner) => {
    setOpenDropdown(null);
    setActionLoading(learner.id);
    try {
      await instructorApi.createIntervention({
        type: "ticket",
        studentId: learner.id,
        courseId: learner.enrolledCourseIds?.[0],
      });
      toast.success(t("atRisk.ticketCreated"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("atRisk.actionFailed")
      );
    } finally {
      setActionLoading(null);
    }
  }, [t]);

  const displayedLearners = learners.slice(0, visibleCount);
  const totalCount = learners.length;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 sm:p-5">
        {/* Header with Badge Count + Settings Gear */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F97316]" />
            {t("atRisk.title")}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              title={t("atRisk.thresholdSettings")}
            >
              <Settings className="w-4 h-4" />
            </button>
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#FEE2E2] text-[#EF4444] text-xs font-semibold rounded-full">
              {totalCount}
            </span>
          </div>
        </div>

        <div className="space-y-3" ref={dropdownRef}>
          {displayedLearners.map((learner) => (
            <div
              key={learner.id}
              className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563] flex-shrink-0">
                {learner.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1F2937] truncate">
                  {learner.name}
                </p>
                {learner.course && (
                  <p className="text-[11px] text-[#6B7280] truncate mb-0.5">
                    {learner.course}
                  </p>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getRiskBadgeStyle(learner.riskType)}`}
                >
                  {getRiskLabel(learner.riskType, learner.riskValue)}
                </span>
              </div>

              {/* Action Dropdown */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setOpenDropdown(openDropdown === learner.id ? null : learner.id)}
                  disabled={actionLoading === learner.id}
                  className="p-1.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#E5E7EB] rounded-lg transition-colors disabled:opacity-50"
                  aria-label={tA("openActions")}
                  aria-haspopup="true"
                  aria-expanded={openDropdown === learner.id}
                >
                  {actionLoading === learner.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MoreVertical className="w-4 h-4" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {openDropdown === learner.id && (
                  <div className="absolute end-0 top-full mt-1 w-48 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10" role="menu">
                    <div className="py-1">
                      <button
                        onClick={() => handleSendReminder(learner)}
                        disabled={actionLoading === learner.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                        role="menuitem"
                      >
                        <Mail className="w-4 h-4 text-[#6B7280]" />
                        {t("atRisk.sendReminder")}
                      </button>
                      <button
                        onClick={() => handleScheduleMakeup(learner)}
                        disabled={actionLoading === learner.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                        role="menuitem"
                      >
                        <Calendar className="w-4 h-4 text-[#6B7280]" />
                        {t("atRisk.scheduleMakeup")}
                      </button>
                      <button
                        onClick={() => handleOpenTicket(learner)}
                        disabled={actionLoading === learner.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                        role="menuitem"
                      >
                        <Ticket className="w-4 h-4 text-[#6B7280]" />
                        {t("atRisk.openTicket")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <button
          onClick={() => router.push(`/${locale}/dashboard/instructor/students`)}
          className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline"
        >
          {t("atRisk.viewAll")} ({totalCount})
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Threshold Settings Modal */}
      {showSettings && (
        <ThresholdSettingsModal
          courses={courses.filter((c) => c.value !== "all")}
          t={t}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); onRefresh?.(); }}
        />
      )}
    </div>
  );
};

/* ─── Threshold Settings Modal ──────────────────────────── */
function ThresholdSettingsModal({
  courses,
  t,
  onClose,
  onSaved,
}: {
  courses: CourseOption[];
  t: (key: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.value || "");
  const [attendance, setAttendance] = useState("70");
  const [score, setScore] = useState("60");
  const [inactivity, setInactivity] = useState("7");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    try {
      await instructorApi.updateAtRiskSettings(selectedCourse, {
        atRiskAttendanceThreshold: Number(attendance),
        atRiskScoreThreshold: Number(score),
        atRiskInactivityDays: Number(inactivity),
      });
      toast.success(t("atRisk.thresholdsSaved"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("atRisk.actionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAttendance("70");
    setScore("60");
    setInactivity("7");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("atRisk.thresholdSettings")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Course selector */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("atRisk.selectCourse")}
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              {courses.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Attendance threshold */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("atRisk.attendanceThreshold")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                max={100}
              />
              <span className="text-sm text-[#6B7280]">%</span>
            </div>
          </div>

          {/* Score threshold */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("atRisk.scoreThreshold")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                max={100}
              />
              <span className="text-sm text-[#6B7280]">%</span>
            </div>
          </div>

          {/* Inactivity threshold */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("atRisk.inactivityThreshold")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inactivity}
                onChange={(e) => setInactivity(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={1}
                max={90}
              />
              <span className="text-sm text-[#6B7280]">{t("atRisk.days")}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
            >
              {t("atRisk.resetDefaults")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedCourse}
              className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("atRisk.saveThresholds")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AtRiskLearners;
