"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { instructorApi, ApiError } from "@/lib/api";
import { toast } from "sonner";
import type {
  AssessmentResponse,
  AssessmentFile,
  InstructorCourse,
  AssessmentQuestion,
  AssessmentSubmission,
  ItemAnalysisResponse,
  QuestionType,
  DifficultyLevel,
} from "@/types/instructor-dashboard";
import {
  Search,
  Plus,
  Filter,
  ChevronDown,
  MoreVertical,
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  Edit3,
  Pencil,
  Trash2,
  Eye,
  HelpCircle,
  ListChecks,
  ToggleLeft,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  X,
  RefreshCw,
  AlertTriangle,
  Save,
  Info,
  ChevronUp,
  RotateCcw,
} from "lucide-react";

/* ──────────────────────── Modal Overlay ──────────────────────── */
const ModalOverlay = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 scrollbar-hide overflow-y-auto"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    {children}
  </div>
);

/* ──────────────────── Create Assessment Modal ────────────────── */
const CreateAssessmentModal = ({
  courses,
  locale,
  t,
  onClose,
  onCreated,
}: {
  courses: InstructorCourse[];
  locale: string;
  t: (key: string) => string;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("quiz");
  const [totalMarks, setTotalMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("60");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [courseModules, setCourseModules] = useState<{ id: string; title: string }[]>([]);
  const [courseTimeLimitEnforced, setCourseTimeLimitEnforced] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const isAssignment = type === "assignment";

  useEffect(() => {
    if (!courseId) { setCourseModules([]); setModuleId(""); return; }
    let cancelled = false;
    instructorApi.getCourseDetail(courseId).then((data) => {
      if (!cancelled) {
        if (data?.modules) {
          setCourseModules(data.modules.map((m: { id: string; title: string }) => ({ id: m.id, title: m.title })));
        }
        setCourseTimeLimitEnforced(data?.assessmentTimeLimitEnforced ?? true);
      }
    }).catch(() => { if (!cancelled) setCourseModules([]); });
    setModuleId("");
    return () => { cancelled = true; };
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim()) return;
    if (isAssignment && !dueDate) {
      toast.error(t("assessments.deadlineRequired") || "Deadline is required for assignments");
      return;
    }
    if (!isAssignment && !durationMinutes) {
      toast.error(t("assessments.durationRequired") || "Duration is required for quiz/exam");
      return;
    }
    setSaving(true);
    try {
      await instructorApi.createAssessment({
        courseId,
        title: title.trim(),
        type,
        totalMarks: Number(totalMarks) || 1,
        passingMarks: Number(passingMarks) || 0,
        durationMinutes: !isAssignment && durationMinutes ? Number(durationMinutes) : undefined,
        dueDate: isAssignment && dueDate ? dueDate + ":00+03:00" : undefined,
        instructions: isAssignment && instructions ? instructions : undefined,
        moduleId: moduleId || undefined,
        randomizeOrder: !isAssignment ? true : undefined,
      });
      toast.success(t("assessments.createSuccess"));
      onCreated();
      onClose();
    } catch {
      toast.error(t("assessments.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("assessments.createNew")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.course")}
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              required
            >
              {courses.filter((c) => c.status !== "completed" && c.status !== "archived").map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" && c.titleAr ? c.titleAr : c.title}
                </option>
              ))}
            </select>
          </div>
          {courseModules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.selectModule") || "Module"}
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="">{t("assessments.noModule") || "No module (general)"}</option>
                {courseModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.assessmentTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              placeholder={t("assessments.titlePlaceholder")}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.type")}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="quiz">{t("assessments.typeQuiz")}</option>
                <option value="exam">{t("assessments.typeExam")}</option>
                <option value="assignment">{t("assessments.typeAssignment")}</option>
              </select>
            </div>
            {!isAssignment ? (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("assessments.duration")}
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  placeholder={t("assessments.minutes")}
                  min={1}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("assessments.deadline") || "Deadline"} <span className="text-red-500">*</span>
                </label>
                <DateTimePicker
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>
            )}
          </div>
          {!courseTimeLimitEnforced && (
            <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
              <Info className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#92400E]">
                <p className="font-semibold">
                  {t("assessments.timeLimitAdvisoryTitle") || "Time limit is advisory for this course"}
                </p>
                <p className="mt-0.5">
                  {isAssignment
                    ? (t("assessments.timeLimitAdvisoryAssignmentDesc") || "The course manager has disabled deadline enforcement. Students may submit after the deadline.")
                    : (t("assessments.timeLimitAdvisoryQuizDesc") || "The course manager has disabled time enforcement. Students will not be auto-submitted when the timer ends.")}
                </p>
              </div>
            </div>
          )}
          {isAssignment && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.assignmentInstructions") || "Instructions"}
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-h-[80px]"
                placeholder={t("assessments.instructionsPlaceholder") || "Enter assignment instructions..."}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.totalMarks")}
              </label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.passingMarks")}
              </label>
              <input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
            >
              {t("assessments.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !courseId}
              className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? t("assessments.creating") : t("assessments.create")}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

/* ──────────────────── Edit Assessment Modal ──────────────────── */
const EditAssessmentModal = ({
  assessment,
  t,
  onClose,
  onUpdated,
}: {
  assessment: AssessmentResponse;
  t: (key: string) => string;
  onClose: () => void;
  onUpdated: () => void;
}) => {
  const [title, setTitle] = useState(assessment.title);
  const [type, setType] = useState(assessment.type);
  const [totalMarks, setTotalMarks] = useState(String(assessment.totalMarks));
  const [passingMarks, setPassingMarks] = useState(String(assessment.passingMarks));
  const [durationMinutes, setDurationMinutes] = useState(
    assessment.durationMinutes ? String(assessment.durationMinutes) : ""
  );
  const [editDueDate, setEditDueDate] = useState(() => {
    if (!assessment.dueDate) return "";
    // Convert UTC to Saudi time (Asia/Riyadh, UTC+3) for datetime-local input
    const d = new Date(assessment.dueDate);
    const saudi = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return saudi.toISOString().slice(0, 16);
  });
  const [editInstructions, setEditInstructions] = useState(
    assessment.instructions || ""
  );
  const [editModuleId, setEditModuleId] = useState(assessment.moduleId || "");
  const [editCourseModules, setEditCourseModules] = useState<{ id: string; title: string }[]>([]);
  const [status, setStatus] = useState(assessment.status);
  const [saving, setSaving] = useState(false);
  const editIsAssignment = type === "assignment";

  useEffect(() => {
    if (!assessment.courseId) return;
    let cancelled = false;
    instructorApi.getCourseDetail(assessment.courseId).then((data) => {
      if (!cancelled && data?.modules) {
        setEditCourseModules(data.modules.map((m: { id: string; title: string }) => ({ id: m.id, title: m.title })));
      }
    }).catch(() => { if (!cancelled) setEditCourseModules([]); });
    return () => { cancelled = true; };
  }, [assessment.courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await instructorApi.updateAssessment(assessment.id, {
        title: title.trim(),
        type,
        totalMarks: Number(totalMarks) || 1,
        passingMarks: Number(passingMarks) || 0,
        durationMinutes: !editIsAssignment && durationMinutes ? Number(durationMinutes) : null,
        status,
        moduleId: editModuleId || null,
        ...(editIsAssignment && {
          dueDate: editDueDate ? editDueDate + ":00+03:00" : null,
          instructions: editInstructions || null,
        }),
      });
      toast.success(t("assessments.editSuccess"));
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t("assessments.editError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("assessments.editAssessment")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.assessmentTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              required
            />
          </div>
          {editCourseModules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.selectModule") || "Module"}
              </label>
              <select
                value={editModuleId}
                onChange={(e) => setEditModuleId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="">{t("assessments.noModule") || "No module (general)"}</option>
                {editCourseModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.type")}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="quiz">{t("assessments.typeQuiz")}</option>
                <option value="exam">{t("assessments.typeExam")}</option>
                <option value="assignment">{t("assessments.typeAssignment")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="draft">{t("assessments.statusDraft")}</option>
                <option value="published">{t("assessments.statusPublished")}</option>
                <option value="closed">{t("assessments.statusClosed")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.totalMarks")}
              </label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.passingMarks")}
              </label>
              <input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                required
              />
            </div>
            {!editIsAssignment ? (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("assessments.duration")}
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  placeholder={t("assessments.minutes")}
                  min={1}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("assessments.deadline") || "Deadline"}
                </label>
                <DateTimePicker
                  value={editDueDate}
                  onChange={setEditDueDate}
                />
              </div>
            )}
          </div>
          {assessment.timeLimitEnforced === false && (
            <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
              <Info className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#92400E]">
                <p className="font-semibold">
                  {t("assessments.timeLimitAdvisoryTitle") || "Time limit is advisory for this assessment"}
                </p>
                <p className="mt-0.5">
                  {editIsAssignment
                    ? (t("assessments.timeLimitAdvisoryAssignmentDesc") || "Deadline enforcement is disabled. Students may submit after the deadline.")
                    : (t("assessments.timeLimitAdvisoryQuizDesc") || "Time enforcement is disabled. Students will not be auto-submitted when the timer ends.")}
                </p>
              </div>
            </div>
          )}
          {editIsAssignment && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.assignmentInstructions") || "Instructions"}
              </label>
              <textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-h-[80px]"
                placeholder={t("assessments.instructionsPlaceholder") || "Enter assignment instructions..."}
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
            >
              {t("assessments.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2563EB]"
            >
              {saving ? t("assessments.saving") : t("assessments.saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

/* ──────────────────── Add Question Modal ─────────────────────── */
const AddQuestionModal = ({
  assessmentId,
  t,
  onClose,
  onAdded,
}: {
  assessmentId: string;
  t: (key: string) => string;
  onClose: () => void;
  onAdded: () => void;
}) => {
  const [qType, setQType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [questionTextAr, setQuestionTextAr] = useState("");
  const [options, setOptions] = useState([
    { text: "", textAr: "", isCorrect: false },
    { text: "", textAr: "", isCorrect: false },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState(1);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
  const [saving, setSaving] = useState(false);

  const handleAddOption = () => {
    setOptions([...options, { text: "", textAr: "", isCorrect: false }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleOptionChange = (idx: number, field: string, value: string | boolean) => {
    const updated = options.map((opt, i) => {
      if (i !== idx) return field === "isCorrect" && value === true ? { ...opt, isCorrect: false } : opt;
      return { ...opt, [field]: value };
    });
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    // Validation
    if (qType === "mcq") {
      const nonBlank = options.filter((o) => o.text.trim());
      if (nonBlank.length < 2) {
        toast.error(t("assessments.mcqMinOptions"));
        return;
      }
      if (!nonBlank.some((o) => o.isCorrect)) {
        toast.error(t("assessments.mcqNoCorrectAnswer"));
        return;
      }
    }
    if (qType === "true_false" && !correctAnswer) {
      toast.error(t("assessments.trueFalseNoAnswer"));
      return;
    }

    setSaving(true);
    try {
      const data: {
        type: string;
        questionText: string;
        questionTextAr?: string;
        options?: { text: string; textAr?: string; isCorrect: boolean }[];
        correctAnswer?: string;
        marks: number;
        difficultyLevel: string;
      } = {
        type: qType,
        questionText: questionText.trim(),
        marks,
        difficultyLevel: difficulty,
      };
      if (questionTextAr.trim()) data.questionTextAr = questionTextAr.trim();

      if (qType === "mcq") {
        data.options = options
          .filter((o) => o.text.trim())
          .map((o) => ({
            text: o.text.trim(),
            textAr: o.textAr?.trim() || undefined,
            isCorrect: o.isCorrect,
          }));
      }
      if (qType === "true_false") {
        data.correctAnswer = correctAnswer;
        data.options = [
          { text: "True", isCorrect: correctAnswer === "true" },
          { text: "False", isCorrect: correctAnswer === "false" },
        ];
      }

      if (assessmentId.startsWith("course:")) {
        const courseId = assessmentId.replace("course:", "");
        await instructorApi.addCourseBankQuestion(courseId, data);
      } else {
        await instructorApi.addQuestion(assessmentId, data);
      }
      toast.success(t("assessments.questionAdded"));
      onAdded();
      onClose();
    } catch {
      toast.error(t("assessments.questionAddError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("assessments.addQuestion")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Difficulty + Marks */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.questionType")}
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as QuestionType)}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="mcq">{t("assessments.typeMCQ")}</option>
                <option value="true_false">{t("assessments.typeTrueFalse")}</option>
                <option value="short_answer">{t("assessments.typeShortAnswer")}</option>
                <option value="essay">{t("assessments.typeEssay")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.difficulty")}
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="easy">{t("assessments.difficultyEasy")}</option>
                <option value="medium">{t("assessments.difficultyMedium")}</option>
                <option value="hard">{t("assessments.difficultyHard")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.marks")}
              </label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={1}
              />
            </div>
          </div>

          {/* Question Text EN */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.questionTextEn")}
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
              rows={3}
              required
            />
          </div>

          {/* Question Text AR */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.questionTextAr")}
            </label>
            <textarea
              value={questionTextAr}
              onChange={(e) => setQuestionTextAr(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
              rows={2}
              dir="rtl"
            />
          </div>

          {/* MCQ Options */}
          {qType === "mcq" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#374151]">
                {t("assessments.options")}
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => handleOptionChange(idx, "isCorrect", true)}
                      className="w-4 h-4 text-[#3B82F6]"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, "text", e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      placeholder={`${t("assessments.option")} ${idx + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className={`${options.length > 2 ? "ml-6 mr-9" : "ml-6"}`}>
                    <input
                      type="text"
                      value={opt.textAr || ""}
                      onChange={(e) => handleOptionChange(idx, "textAr", e.target.value)}
                      className="w-full px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      placeholder={`${t("assessments.optionAr")} ${idx + 1}`}
                      dir="rtl"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddOption}
                className="text-sm text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("assessments.addOption")}
              </button>
            </div>
          )}

          {/* True/False */}
          {qType === "true_false" && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                {t("assessments.correctAnswer")}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="trueFalse"
                    checked={correctAnswer === "true"}
                    onChange={() => setCorrectAnswer("true")}
                    className="w-4 h-4 text-[#3B82F6]"
                  />
                  <span className="text-sm">True</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="trueFalse"
                    checked={correctAnswer === "false"}
                    onChange={() => setCorrectAnswer("false")}
                    className="w-4 h-4 text-[#3B82F6]"
                  />
                  <span className="text-sm">False</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
            >
              {t("assessments.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !questionText.trim()}
              className="flex-1 px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2563EB]"
            >
              {saving ? t("assessments.saving") : t("assessments.addQuestion")}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

/* ──────────────────── Edit Question Modal ─────────────────────── */
const EditQuestionModal = ({
  question,
  assessmentId,
  t,
  onClose,
  onUpdated,
}: {
  question: AssessmentQuestion;
  assessmentId: string;
  t: (key: string) => string;
  onClose: () => void;
  onUpdated: () => void;
}) => {
  const [qType, setQType] = useState<QuestionType>(question.type as QuestionType);
  const [questionText, setQuestionText] = useState(question.questionText);
  const [questionTextAr, setQuestionTextAr] = useState(question.questionTextAr || "");
  const [options, setOptions] = useState<{ text: string; textAr: string; isCorrect: boolean }[]>(() => {
    const opts = (question.options as { text: string; textAr?: string; isCorrect: boolean }[] | undefined) || [];
    if (opts.length > 0) return opts.map((o) => ({ text: o.text, textAr: o.textAr || "", isCorrect: o.isCorrect }));
    return [
      { text: "", textAr: "", isCorrect: false },
      { text: "", textAr: "", isCorrect: false },
    ];
  });
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer || "");
  const [marks, setMarks] = useState(question.marks);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>((question.difficultyLevel || "medium") as DifficultyLevel);
  const [saving, setSaving] = useState(false);

  const handleAddOption = () => {
    setOptions([...options, { text: "", textAr: "", isCorrect: false }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleOptionChange = (idx: number, field: string, value: string | boolean) => {
    const updated = options.map((opt, i) => {
      if (i !== idx) return field === "isCorrect" && value === true ? { ...opt, isCorrect: false } : opt;
      return { ...opt, [field]: value };
    });
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    // Validation
    if (qType === "mcq") {
      const nonBlank = options.filter((o) => o.text.trim());
      if (nonBlank.length < 2) {
        toast.error(t("assessments.mcqMinOptions"));
        return;
      }
      if (!nonBlank.some((o) => o.isCorrect)) {
        toast.error(t("assessments.mcqNoCorrectAnswer"));
        return;
      }
    }
    if (qType === "true_false" && !correctAnswer) {
      toast.error(t("assessments.trueFalseNoAnswer"));
      return;
    }

    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        type: qType,
        questionText: questionText.trim(),
        questionTextAr: questionTextAr.trim() || undefined,
        marks,
        difficultyLevel: difficulty,
      };

      if (qType === "mcq") {
        data.options = options
          .filter((o) => o.text.trim())
          .map((o) => ({
            text: o.text.trim(),
            textAr: o.textAr?.trim() || undefined,
            isCorrect: o.isCorrect,
          }));
      }
      if (qType === "true_false") {
        data.correctAnswer = correctAnswer;
        data.options = [
          { text: "True", isCorrect: correctAnswer === "true" },
          { text: "False", isCorrect: correctAnswer === "false" },
        ];
      }

      const actualId = assessmentId.startsWith("course:")
        ? assessmentId.replace("course:", "")
        : assessmentId;
      await instructorApi.updateQuestion(actualId, question.id, data);
      toast.success(t("assessments.questionUpdated"));
      onUpdated();
      onClose();
    } catch {
      toast.error(t("assessments.questionUpdateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("assessments.editQuestion")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.questionType")}
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as QuestionType)}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="mcq">{t("assessments.typeMCQ")}</option>
                <option value="true_false">{t("assessments.typeTrueFalse")}</option>
                <option value="short_answer">{t("assessments.typeShortAnswer")}</option>
                <option value="essay">{t("assessments.typeEssay")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.difficulty")}
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="easy">{t("assessments.difficultyEasy")}</option>
                <option value="medium">{t("assessments.difficultyMedium")}</option>
                <option value="hard">{t("assessments.difficultyHard")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                {t("assessments.marks")}
              </label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={1}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.questionTextEn")}
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.questionTextAr")}
            </label>
            <textarea
              value={questionTextAr}
              onChange={(e) => setQuestionTextAr(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
              rows={2}
              dir="rtl"
            />
          </div>
          {qType === "mcq" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#374151]">
                {t("assessments.options")}
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="editCorrectOption"
                      checked={opt.isCorrect}
                      onChange={() => handleOptionChange(idx, "isCorrect", true)}
                      className="w-4 h-4 text-[#3B82F6]"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, "text", e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      placeholder={`${t("assessments.option")} ${idx + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className={`${options.length > 2 ? "ml-6 mr-9" : "ml-6"}`}>
                    <input
                      type="text"
                      value={opt.textAr || ""}
                      onChange={(e) => handleOptionChange(idx, "textAr", e.target.value)}
                      className="w-full px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      placeholder={`${t("assessments.optionAr")} ${idx + 1}`}
                      dir="rtl"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddOption}
                className="text-sm text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("assessments.addOption")}
              </button>
            </div>
          )}
          {qType === "true_false" && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                {t("assessments.correctAnswer")}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editTrueFalse"
                    checked={correctAnswer === "true"}
                    onChange={() => setCorrectAnswer("true")}
                    className="w-4 h-4 text-[#3B82F6]"
                  />
                  <span className="text-sm">True</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editTrueFalse"
                    checked={correctAnswer === "false"}
                    onChange={() => setCorrectAnswer("false")}
                    className="w-4 h-4 text-[#3B82F6]"
                  />
                  <span className="text-sm">False</span>
                </label>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
            >
              {t("assessments.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !questionText.trim()}
              className="flex-1 px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2563EB]"
            >
              {saving ? t("assessments.saving") : t("assessments.saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

/* ──────────────────────── Grade Modal ────────────────────────── */
const GradeModal = ({
  submission,
  questions,
  assessmentId,
  assessmentType,
  totalMarks,
  t,
  onClose,
  onGraded,
}: {
  submission: AssessmentSubmission;
  questions: AssessmentQuestion[];
  assessmentId: string;
  assessmentType?: string;
  totalMarks?: number;
  t: (key: string) => string;
  onClose: () => void;
  onGraded: () => void;
}) => {
  const isAssignmentGrade = assessmentType === "assignment";
  const [assignmentScore, setAssignmentScore] = useState(
    String(submission.score ?? 0)
  );
  const [overallComment, setOverallComment] = useState(
    submission.instructorComment || ""
  );
  const [questionComments, setQuestionComments] = useState<Record<string, string>>(
    submission.questionComments || {}
  );
  const [grades, setGrades] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    submission.answers.forEach((a) => {
      map[a.questionId] = a.marksAwarded ?? 0;
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const questionsMap = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  const handleGrade = async () => {
    setSaving(true);
    try {
      if (isAssignmentGrade) {
        await instructorApi.gradeAssignment(
          assessmentId,
          submission.id,
          Number(assignmentScore) || 0,
          overallComment || undefined,
        );
      } else {
        const gradeItems = Object.entries(grades).map(([questionId, marksAwarded]) => ({
          questionId,
          marksAwarded,
          comment: questionComments[questionId] || undefined,
        }));
        await instructorApi.gradeSubmission(assessmentId, submission.id, gradeItems, overallComment || undefined);
      }
      toast.success(t("assessments.gradeSuccess"));
      onGraded();
      onClose();
    } catch {
      toast.error(t("assessments.gradeError"));
    } finally {
      setSaving(false);
    }
  };

  // Calculate running total
  const currentTotal = isAssignmentGrade
    ? Number(assignmentScore) || 0
    : Object.values(grades).reduce((sum, v) => sum + (v || 0), 0);
  const maxTotal = isAssignmentGrade
    ? (totalMarks || 100)
    : questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2937]">
              {t("assessments.gradeSubmission")}
            </h3>
            <p className="text-sm text-[#6B7280]">
              {submission.studentFirstName} {submission.studentLastName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Total Score Summary */}
        <div className="mb-5 p-3 bg-[#F0F7FF] border border-[#BFDBFE] rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium text-[#1E40AF]">Total Score</span>
          <span className="text-lg font-bold text-[#1E40AF]">{currentTotal} / {maxTotal}</span>
        </div>

        {isAssignmentGrade ? (
          /* ─── Assignment Grading ─── */
          <div className="space-y-4">
            {submission.submissionFiles && submission.submissionFiles.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#374151] mb-2">
                  {t("assessments.studentFiles") || "Student Files"}
                </p>
                <div className="space-y-2">
                  {submission.submissionFiles.map((f) => (
                    <a
                      key={f.id}
                      href={f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg hover:bg-[#F3F4F6] text-sm text-[#3B82F6]"
                    >
                      <FileText className="w-4 h-4" />
                      {f.fileName}
                      <span className="text-xs text-[#9CA3AF] ml-auto">
                        {(f.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1">
                Score
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={assignmentScore}
                  onChange={(e) => setAssignmentScore(e.target.value)}
                  className="w-28 px-3 py-2.5 border-2 border-[#3B82F6] rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  min={0}
                  max={totalMarks || 100}
                />
                <span className="text-base font-medium text-[#6B7280]">/ {totalMarks || 100}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.instructorComment") || "Comment"}
              </label>
              <textarea
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-h-[80px]"
                placeholder={t("assessments.addComment") || "Add a comment..."}
              />
            </div>
          </div>
        ) : (
          /* ─── Quiz/Exam Grading ─── */
          <div className="space-y-0">
            {submission.answers.map((answer, idx) => {
              const question = questionsMap.get(answer.questionId);
              const maxMarks = question?.marks || 1;
              const needsManualGrade =
                question?.type === "essay" || question?.type === "short_answer";

              return (
                <div key={answer.questionId}>
                  {idx > 0 && <hr className="border-[var(--color-border)] my-4" />}
                  <div className="py-2">
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#3B82F6] text-white text-xs font-bold mr-2">
                          Q{idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-[#1F2937]">
                          {question?.questionText || t("assessments.unknownQuestion")}
                        </span>
                      </div>
                      {!needsManualGrade && answer.isCorrect !== null && (
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                            answer.isCorrect
                              ? "bg-[#DCFCE7] text-[#22C55E]"
                              : "bg-[#FEE2E2] text-[#EF4444]"
                          }`}
                        >
                          {answer.isCorrect ? t("assessments.correct") : t("assessments.incorrect")}
                        </span>
                      )}
                    </div>

                    {needsManualGrade ? (
                      <>
                        <p className="text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                          {t("assessments.studentsAnswer")}
                        </p>
                        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 mb-3">
                          <p className="text-sm text-[#1F2937] whitespace-pre-wrap leading-relaxed">
                            {answer.answer || "-"}
                          </p>
                        </div>
                        {question?.correctAnswer && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-[#374151] mb-1 uppercase tracking-wide">
                              {t("assessments.correctAnswerLabel") || "Correct Answer"} (Reference)
                            </p>
                            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3">
                              <p className="text-sm text-[#166534] whitespace-pre-wrap">
                                {question.correctAnswer}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                          <label className="text-sm font-semibold text-[#374151]">
                            Score:
                          </label>
                          <input
                            type="number"
                            value={grades[answer.questionId] ?? 0}
                            onChange={(e) =>
                              setGrades((prev) => ({
                                ...prev,
                                [answer.questionId]: Math.min(
                                  Number(e.target.value),
                                  maxMarks
                                ),
                              }))
                            }
                            className="w-20 px-3 py-1.5 border-2 border-[#3B82F6] rounded-lg text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            min={0}
                            max={maxMarks}
                          />
                          <span className="text-sm font-medium text-[#6B7280]">/ {maxMarks}</span>
                        </div>
                        <input
                          type="text"
                          value={questionComments[answer.questionId] || ""}
                          onChange={(e) =>
                            setQuestionComments((prev) => ({
                              ...prev,
                              [answer.questionId]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          placeholder={t("assessments.questionComment") || "Add comment for this question..."}
                        />
                      </>
                    ) : (
                      <>
                        <div className="mb-1.5">
                          <p className="text-xs font-semibold text-[#374151] mb-1 uppercase tracking-wide">
                            {t("assessments.studentAnswer")}
                          </p>
                          <p className="text-sm text-[#1F2937] pl-2">{answer.answer}</p>
                        </div>
                        {question && (
                          <div className="mb-1.5">
                            <p className="text-xs font-semibold text-[#374151] mb-1 uppercase tracking-wide">
                              {t("assessments.correctAnswerLabel")}
                            </p>
                            <p className="text-sm text-[#22C55E] font-medium pl-2">
                              {question.type === "mcq"
                                ? (question.options as { text: string; isCorrect: boolean }[] | undefined)
                                    ?.find((o) => o.isCorrect)?.text || "-"
                                : question.type === "true_false"
                                  ? question.correctAnswer === "true"
                                    ? "True"
                                    : "False"
                                  : question.correctAnswer || t("assessments.manualReviewRequired")}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 p-2 bg-[#F9FAFB] rounded-lg">
                          <span className="text-sm font-semibold text-[#374151]">Score:</span>
                          <span className="text-sm font-medium text-[#1F2937]">{answer.marksAwarded ?? 0} / {maxMarks}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Overall comment for quiz/exam */}
            <hr className="border-[var(--color-border)] my-4" />
            <div className="pt-2">
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.overallComment") || "Overall Comment"}
              </label>
              <textarea
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-h-[60px]"
                placeholder={t("assessments.addComment") || "Add an overall comment..."}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
          >
            {t("assessments.cancel")}
          </button>
          <button
            onClick={handleGrade}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2563EB]"
          >
            <Save className="w-4 h-4" />
            {saving ? t("assessments.saving") : t("assessments.saveGrades")}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

/* ═══════════════════ Main Component ═══════════════════════════ */
const AssessmentsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();

  // Global state
  const [activeTab, setActiveTab] = useState<
    "all" | "questionBank" | "submissions" | "itemAnalysis"
  >("all");
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All Assessments tab state
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentResponse | null>(null);

  // Question Bank tab state
  const [qbCourseFilter, setQbCourseFilter] = useState("");
  const [qbSearchQuery, setQbSearchQuery] = useState("");
  const [qbStatusFilter, setQbStatusFilter] = useState("all");
  const [qbTypeFilter, setQbTypeFilter] = useState("all");
  const [selectedAssessmentForQ, setSelectedAssessmentForQ] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("all");
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);

  // Submissions tab state
  const [subCourseFilter, setSubCourseFilter] = useState("");
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [selectedAssessmentForS, setSelectedAssessmentForS] = useState("");
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("all");
  const [expandedRetakeStudents, setExpandedRetakeStudents] = useState<Set<string>>(new Set());
  const [gradeModalData, setGradeModalData] = useState<{
    submission: AssessmentSubmission;
    questions: AssessmentQuestion[];
  } | null>(null);
  const [publishConfirmId, setPublishConfirmId] = useState<string | null>(null);
  const [publishCheckData, setPublishCheckData] = useState<{
    questionCount: number;
    marksSum: number;
    totalMarks: number;
    missingCorrect: boolean;
    isAssignment?: boolean;
    hasFiles?: boolean;
    hasDueDate?: boolean;
  } | null>(null);
  const [publishCheckLoading, setPublishCheckLoading] = useState(false);

  // Item Analysis tab state
  const [iaCourseFilter, setIaCourseFilter] = useState("");
  const [iaSearchQuery, setIaSearchQuery] = useState("");
  const [selectedAssessmentForIA, setSelectedAssessmentForIA] = useState("");
  const [itemAnalysis, setItemAnalysis] = useState<ItemAnalysisResponse | null>(null);
  const [iaLoading, setIaLoading] = useState(false);

  // Course modules cache for showing module names
  const [courseModulesCache, setCourseModulesCache] = useState<Record<string, { id: string; title: string }[]>>({});

  // Fetch modules for a course (cached)
  const fetchCourseModules = useCallback(async (cId: string) => {
    if (courseModulesCache[cId]) return courseModulesCache[cId];
    try {
      const data = await instructorApi.getCourseDetail(cId);
      const mods = (data?.modules || []).map((m: { id: string; title: string }) => ({ id: m.id, title: m.title }));
      setCourseModulesCache((prev) => ({ ...prev, [cId]: mods }));
      return mods;
    } catch { return []; }
  }, [courseModulesCache]);

  // Pre-fetch modules for active course filter
  useEffect(() => {
    const cId = qbCourseFilter || subCourseFilter || iaCourseFilter;
    if (cId && !courseModulesCache[cId]) fetchCourseModules(cId);
  }, [qbCourseFilter, subCourseFilter, iaCourseFilter, courseModulesCache, fetchCourseModules]);

  // Helper to get module name for an assessment
  const getModuleName = useCallback((assessment: AssessmentResponse) => {
    if (!assessment.moduleId || !assessment.courseId) return null;
    const mods = courseModulesCache[assessment.courseId];
    if (!mods) return null;
    const mod = mods.find((m) => m.id === assessment.moduleId);
    return mod?.title || null;
  }, [courseModulesCache]);

  /* ─── Data Fetching ──────────────────────────── */
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, assessmentsRes] = await Promise.all([
        instructorApi.getCourses({ limit: 100 }),
        instructorApi.getAssessmentsList({ limit: 100 }),
      ]);
      setCourses(coursesRes.data);
      setAssessments(assessmentsRes.data);
    } catch {
      setError(t("assessments.errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const refreshAssessments = useCallback(async () => {
    try {
      const res = await instructorApi.getAssessmentsList({ limit: 100 });
      setAssessments(res.data);
    } catch { /* ignore */ }
  }, []);

  // Fetch questions when assessment changes
  useEffect(() => {
    if (!selectedAssessmentForQ) {
      setQuestions([]);
      return;
    }
    const fetchQuestions = async () => {
      setQuestionsLoading(true);
      try {
        const data = selectedAssessmentForQ.startsWith("course:")
          ? await instructorApi.getCourseBankQuestions(selectedAssessmentForQ.replace("course:", ""))
          : await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
        setQuestions(data);
      } catch {
        toast.error(t("assessments.questionsLoadError"));
      } finally {
        setQuestionsLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedAssessmentForQ, t]);

  // Fetch submissions when assessment changes
  useEffect(() => {
    if (!selectedAssessmentForS) {
      setSubmissions([]);
      return;
    }
    const fetchSubs = async () => {
      setSubmissionsLoading(true);
      try {
        const data = await instructorApi.getSubmissions(selectedAssessmentForS);
        setSubmissions(data);
      } catch {
        toast.error(t("assessments.submissionsLoadError"));
      } finally {
        setSubmissionsLoading(false);
      }
    };
    fetchSubs();
  }, [selectedAssessmentForS, t]);

  // Fetch item analysis when assessment changes
  useEffect(() => {
    if (!selectedAssessmentForIA) {
      setItemAnalysis(null);
      return;
    }
    const fetchIA = async () => {
      setIaLoading(true);
      try {
        const data = await instructorApi.getItemAnalysis(selectedAssessmentForIA);
        setItemAnalysis(data);
      } catch {
        toast.error(t("assessments.itemAnalysisLoadError"));
      } finally {
        setIaLoading(false);
      }
    };
    fetchIA();
  }, [selectedAssessmentForIA, t]);

  /* ─── Filtering ──────────────────────────────── */
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = selectedCourse === "all" || a.courseId === selectedCourse;
      const matchesType = selectedType === "all" || a.type === selectedType;
      const matchesStatus = selectedStatus === "all" || a.status === selectedStatus;
      return matchesSearch && matchesCourse && matchesType && matchesStatus;
    });
  }, [assessments, searchQuery, selectedCourse, selectedType, selectedStatus]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesDifficulty =
        questionDifficultyFilter === "all" || q.difficultyLevel === questionDifficultyFilter;
      const matchesType = questionTypeFilter === "all" || q.type === questionTypeFilter;
      return matchesDifficulty && matchesType;
    });
  }, [questions, questionDifficultyFilter, questionTypeFilter]);

  /* ─── Stats ──────────────────────────────────── */
  const stats = useMemo(() => {
    const total = assessments.length;
    const published = assessments.filter((a) => a.status === "published").length;
    const draft = assessments.filter((a) => a.status === "draft").length;
    return { total, published, draft };
  }, [assessments]);

  /* ─── Course name lookup ─────────────────────── */
  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c) => {
      map.set(c.id, locale === "ar" && c.titleAr ? c.titleAr : c.title);
    });
    return map;
  }, [courses, locale]);

  /* ─── Helpers ────────────────────────────────── */
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "published":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "draft":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "closed":
        return "bg-[#F3F4F6] text-[#6B7280]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return t("assessments.statusPublished");
      case "draft":
        return t("assessments.statusDraft");
      case "closed":
        return t("assessments.statusClosed");
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "quiz":
        return t("assessments.typeQuiz");
      case "exam":
        return t("assessments.typeExam");
      case "assignment":
        return t("assessments.typeAssignment");
      default:
        return type;
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "mcq":
        return <ListChecks className="w-4 h-4 text-[#3B82F6]" />;
      case "true_false":
        return <ToggleLeft className="w-4 h-4 text-[#22C55E]" />;
      case "short_answer":
        return <MessageSquare className="w-4 h-4 text-[#F97316]" />;
      case "essay":
        return <FileText className="w-4 h-4 text-[#8B5CF6]" />;
      default:
        return <HelpCircle className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "mcq":
        return t("assessments.typeMCQ");
      case "true_false":
        return t("assessments.typeTrueFalse");
      case "short_answer":
        return t("assessments.typeShortAnswer");
      case "essay":
        return t("assessments.typeEssay");
      default:
        return type;
    }
  };

  const getDifficultyStyle = (d: string) => {
    switch (d) {
      case "easy":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "medium":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "hard":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getSubmissionStatusStyle = (status: string) => {
    switch (status) {
      case "graded":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "submitted":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "in_progress":
        return "bg-[#DBEAFE] text-[#3B82F6]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getSubmissionStatusLabel = (status: string) => {
    switch (status) {
      case "graded":
        return t("assessments.submissionGraded");
      case "submitted":
        return t("assessments.submissionPending");
      case "in_progress":
        return t("assessments.submissionInProgress");
      default:
        return status;
    }
  };

  const getDiscriminationLabel = (value: number) => {
    if (value >= 0.4) return { label: t("assessments.discriminationGood"), style: "text-[#22C55E]", icon: <TrendingUp className="w-4 h-4" /> };
    if (value >= 0.2) return { label: t("assessments.discriminationModerate"), style: "text-[#EAB308]", icon: null };
    return { label: t("assessments.discriminationPoor"), style: "text-[#EF4444]", icon: <TrendingDown className="w-4 h-4" /> };
  };

  const getDifficultyIndexLabel = (value: number) => {
    if (value >= 0.7) return t("assessments.difficultyEasy");
    if (value >= 0.3) return t("assessments.difficultyMedium");
    return t("assessments.difficultyHard");
  };

  const handleDeleteAssessment = async (id: string) => {
    try {
      await instructorApi.deleteAssessment(id);
      toast.success(t("assessments.deleteSuccess"));
      refreshAssessments();
    } catch {
      toast.error(t("assessments.deleteError"));
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await instructorApi.updateAssessment(id, { status: "published" });
      toast.success(t("assessments.publishSuccess"));
      refreshAssessments();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || t("assessments.publishError"));
      }
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const isCourseBank = selectedAssessmentForQ?.startsWith("course:");
      const actualId = isCourseBank
        ? selectedAssessmentForQ.replace("course:", "")
        : selectedAssessmentForQ || '';
      await instructorApi.deleteQuestion(actualId, questionId);
      toast.success(t("assessments.questionDeleted"));
      // Refresh questions
      if (selectedAssessmentForQ) {
        const data = isCourseBank
          ? await instructorApi.getCourseBankQuestions(actualId)
          : await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
        setQuestions(data);
      }
    } catch {
      toast.error(t("assessments.questionDeleteError"));
    }
  };

  const handleOpenGradeModal = async (submission: AssessmentSubmission) => {
    try {
      const qs = await instructorApi.getAssessmentQuestions(submission.assessmentId);
      setGradeModalData({ submission, questions: qs });
    } catch {
      toast.error(t("assessments.questionsLoadError"));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return formatDateHijri(dateStr, calendarFormat, { locale });
  };

  /* ─── Tabs ───────────────────────────────────── */
  const tabs = [
    { id: "all" as const, label: t("assessments.tabAll"), icon: ClipboardList },
    { id: "questionBank" as const, label: t("assessments.tabQuestionBank"), icon: HelpCircle },
    { id: "submissions" as const, label: t("assessments.tabSubmissions"), icon: Users },
    { id: "itemAnalysis" as const, label: t("assessments.tabItemAnalysis"), icon: BarChart3 },
  ];

  const types = [
    { id: "all", name: t("assessments.allTypes") },
    { id: "quiz", name: t("assessments.typeQuiz") },
    { id: "exam", name: t("assessments.typeExam") },
    { id: "assignment", name: t("assessments.typeAssignment") },
  ];

  const statusOptions = [
    { id: "all", name: t("assessments.allStatuses") },
    { id: "draft", name: t("assessments.statusDraft") },
    { id: "published", name: t("assessments.statusPublished") },
    { id: "closed", name: t("assessments.statusClosed") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("assessments.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("assessments.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {t("assessments.createNew")}
                </button>
              </div>

              {/* Loading / Error */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-[#3B82F6] animate-spin" />
                  <span className="ml-3 text-sm text-[#6B7280]">
                    {t("assessments.loading")}
                  </span>
                </div>
              )}

              {error && !loading && (
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-6 text-center">
                  <p className="text-[#DC2626] font-medium mb-3">{error}</p>
                  <button
                    onClick={fetchInitialData}
                    className="px-4 py-2 bg-[#DC2626] text-white rounded-lg text-sm hover:bg-[#B91C1C]"
                  >
                    {t("assessments.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-[#3B82F6]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1F2937]">{stats.total}</p>
                          <p className="text-xs text-[#6B7280]">{t("assessments.total")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1F2937]">{stats.published}</p>
                          <p className="text-xs text-[#6B7280]">{t("assessments.published")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                          <Clock className="w-5 h-5 text-[#EAB308]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1F2937]">{stats.draft}</p>
                          <p className="text-xs text-[#6B7280]">{t("assessments.drafts")}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="bg-white rounded-xl border border-[var(--color-border)]">
                    <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                              ? "text-[#3B82F6]"
                              : "text-[#6B7280] hover:text-[#374151]"
                          }`}
                        >
                          <tab.icon className="w-4 h-4" />
                          {tab.label}
                          {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ═══ ALL ASSESSMENTS TAB ═══ */}
                    {activeTab === "all" && (
                      <>
                        {/* Search and Filters */}
                        <div className="p-4 border-b border-[var(--color-border)]">
                          <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                              <Search
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type="text"
                                placeholder={t("assessments.searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                              />
                            </div>
                            <button
                              onClick={() => setShowFilters(!showFilters)}
                              className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
                            >
                              <Filter className="w-4 h-4" />
                              {t("assessments.filters")}
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                              />
                            </button>
                            <div className="hidden md:flex gap-3">
                              <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                <option value="all">{t("assessments.allCourses")}</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {locale === "ar" && c.titleAr ? c.titleAr : c.title}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {types.map((t_) => (
                                  <option key={t_.id} value={t_.id}>{t_.name}</option>
                                ))}
                              </select>
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {statusOptions.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {showFilters && (
                            <div className="md:hidden mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 gap-3">
                              <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                <option value="all">{t("assessments.allCourses")}</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {locale === "ar" && c.titleAr ? c.titleAr : c.title}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {types.map((t_) => (
                                  <option key={t_.id} value={t_.id}>{t_.name}</option>
                                ))}
                              </select>
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {statusOptions.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-4">
                          {filteredAssessments.length === 0 ? (
                            <div className="text-center py-12">
                              <ClipboardList className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
                              <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                                {t("assessments.noAssessments")}
                              </h3>
                              <p className="text-sm text-[#6B7280]">
                                {t("assessments.noAssessmentsDesc")}
                              </p>
                            </div>
                          ) : (
                            filteredAssessments.map((assessment) => (
                              <div
                                key={assessment.id}
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[var(--color-border)] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
                                      <FileText className="w-5 h-5 text-[#3B82F6]" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold text-[#1F2937]">
                                        {assessment.title}
                                      </h4>
                                      <p className="text-xs text-[#6B7280] mt-0.5">
                                        {courseNameMap.get(assessment.courseId) || assessment.courseId}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-3 mt-2">
                                        <span className="text-xs text-[#6B7280]">
                                          {getTypeLabel(assessment.type)}
                                        </span>
                                        <span className="text-xs text-[#6B7280]">
                                          {t("assessments.totalMarks")}: {assessment.totalMarks}
                                        </span>
                                        <span className="text-xs text-[#6B7280]">
                                          {t("assessments.passingMarks")}: {assessment.passingMarks}
                                        </span>
                                        {assessment.durationMinutes && (
                                          <span className="text-xs text-[#6B7280]">
                                            {assessment.durationMinutes} {t("assessments.minutes")}
                                          </span>
                                        )}
                                        <span className="text-xs text-[#6B7280] flex items-center gap-1">
                                          <Users className="w-3 h-3" />
                                          {t("assessments.submissionCount", { count: assessment.submissionCount || 0 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(assessment.status)}`}
                                  >
                                    {assessment.status === "published" && <CheckCircle className="w-3 h-3" />}
                                    {assessment.status === "draft" && <Clock className="w-3 h-3" />}
                                    {getStatusLabel(assessment.status)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingAssessment(assessment)}
                                      className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                      title={t("assessments.edit")}
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    {assessment.status === "draft" && (
                                      <button
                                        onClick={async () => {
                                          setPublishConfirmId(assessment.id);
                                          setPublishCheckLoading(true);
                                          try {
                                            if (assessment.type === "assignment") {
                                              const detail = await instructorApi.getAssessmentDetail(assessment.id);
                                              setPublishCheckData({
                                                questionCount: 0,
                                                marksSum: 0,
                                                totalMarks: assessment.totalMarks,
                                                missingCorrect: false,
                                                isAssignment: true,
                                                hasFiles: ((detail.assignmentFiles as unknown[]) || []).length > 0,
                                                hasDueDate: !!detail.dueDate,
                                              });
                                            } else {
                                              const qs = await instructorApi.getAssessmentQuestions(assessment.id);
                                              const marksSum = qs.reduce((s: number, q: AssessmentQuestion) => s + q.marks, 0);
                                              const hasMissingCorrect = qs.some((q: AssessmentQuestion) => {
                                                if (q.type === "mcq") {
                                                  const opts = (q.options as { isCorrect: boolean }[] | undefined) || [];
                                                  return !opts.some((o) => o.isCorrect);
                                                }
                                                if (q.type === "true_false") return !q.correctAnswer;
                                                return false;
                                              });
                                              setPublishCheckData({
                                                questionCount: qs.length,
                                                marksSum,
                                                totalMarks: assessment.totalMarks,
                                                missingCorrect: hasMissingCorrect,
                                              });
                                            }
                                          } catch {
                                            setPublishCheckData({ questionCount: 0, marksSum: 0, totalMarks: assessment.totalMarks, missingCorrect: false });
                                          } finally {
                                            setPublishCheckLoading(false);
                                          }
                                        }}
                                        className="p-2 text-[#6B7280] hover:text-[#22C55E] hover:bg-[#DCFCE7] rounded-lg transition-colors"
                                        title={t("assessments.publish")}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    )}
                                    {assessment.status === "draft" && (
                                      <button
                                        onClick={() => handleDeleteAssessment(assessment.id)}
                                        className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                                        title={t("assessments.delete")}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    {/* ═══ QUESTION BANK TAB ═══ */}
                    {activeTab === "questionBank" && (() => {
                      // Filter assessments for the picker
                      const qbFiltered = assessments.filter((a) => {
                        if (qbCourseFilter && a.courseId !== qbCourseFilter) return false;
                        if (qbStatusFilter !== "all" && a.status !== qbStatusFilter) return false;
                        if (qbTypeFilter !== "all" && a.type !== qbTypeFilter) return false;
                        if (qbSearchQuery && !a.title.toLowerCase().includes(qbSearchQuery.toLowerCase())) return false;
                        return true;
                      });
                      const selectedQbAssessment = assessments.find((a) => a.id === selectedAssessmentForQ);
                      const isQbAssignment = selectedQbAssessment?.type === "assignment";

                      return (
                      <div className="p-5 space-y-4">
                        {/* Step 1: Course + Filters Row */}
                        {!selectedAssessmentForQ && (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <select
                                value={qbCourseFilter}
                                onChange={(e) => { setQbCourseFilter(e.target.value); setSelectedAssessmentForQ(""); }}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[200px]"
                              >
                                <option value="">{t("assessments.allCourses")}</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>{locale === "ar" && c.titleAr ? c.titleAr : c.title}</option>
                                ))}
                              </select>
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                                <input
                                  type="text"
                                  placeholder={t("assessments.searchByName") || "Search by name..."}
                                  value={qbSearchQuery}
                                  onChange={(e) => setQbSearchQuery(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                />
                              </div>
                              <select
                                value={qbStatusFilter}
                                onChange={(e) => setQbStatusFilter(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                <option value="all">{t("assessments.allStatuses")}</option>
                                <option value="draft">{t("assessments.statusDraft")}</option>
                                <option value="published">{t("assessments.statusPublished")}</option>
                              </select>
                              <select
                                value={qbTypeFilter}
                                onChange={(e) => setQbTypeFilter(e.target.value)}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                <option value="all">{t("assessments.allTypes")}</option>
                                <option value="quiz">{t("assessments.typeQuiz")}</option>
                                <option value="exam">{t("assessments.typeExam")}</option>
                                <option value="assignment">{t("assessments.typeAssignment")}</option>
                              </select>
                            </div>

                            {/* Step 2: Assessment Cards List */}
                            {qbFiltered.length === 0 ? (
                              <div className="text-center py-10">
                                <HelpCircle className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">{t("assessments.noAssessmentsFound") || "No assessments found"}</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {/* All Questions option per course */}
                                {qbCourseFilter && qbTypeFilter !== "assignment" && (
                                  <button
                                    onClick={() => setSelectedAssessmentForQ(`course:${qbCourseFilter}`)}
                                    className="w-full text-start p-3 border border-[#DBEAFE] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors"
                                  >
                                    <span className="text-sm font-medium text-[#2563EB]">
                                      {t("assessments.allQuestions")} — {courses.find((c) => c.id === qbCourseFilter)?.title || ""}
                                    </span>
                                  </button>
                                )}
                                {qbFiltered.map((a) => {
                                  const cName = courses.find((c) => c.id === a.courseId);
                                  const courseName = cName ? (locale === "ar" && cName.titleAr ? cName.titleAr : cName.title) : "";
                                  const modName = getModuleName(a);
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setSelectedAssessmentForQ(a.id)}
                                      className="w-full text-start p-3 border border-[var(--color-border)] rounded-lg hover:bg-[#F9FAFB] hover:border-[#3B82F6] transition-colors flex items-center justify-between gap-3"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-[#1F2937] truncate">{a.title}</span>
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            a.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : a.type === "exam" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#E0E7FF] text-[#4338CA]"
                                          }`}>
                                            {a.type === "quiz" ? t("assessments.typeQuiz") : a.type === "exam" ? t("assessments.typeExam") : t("assessments.typeAssignment")}
                                          </span>
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            a.status === "published" ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF3C7] text-[#D97706]"
                                          }`}>
                                            {a.status === "published" ? t("assessments.statusPublished") : t("assessments.statusDraft")}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-xs text-[#9CA3AF]">{courseName}</span>
                                          {modName && <span className="text-xs text-[#9CA3AF]">/ {modName}</span>}
                                          <span className="text-xs text-[#9CA3AF]">{a.totalMarks} {t("assessments.marks")}</span>
                                        </div>
                                      </div>
                                      <ChevronDown className="w-4 h-4 text-[#9CA3AF] -rotate-90 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Back button + filters when assessment is selected */}
                        {selectedAssessmentForQ && (
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setSelectedAssessmentForQ("")}
                                className="flex items-center gap-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                              >
                                <ChevronDown className="w-4 h-4 rotate-90" />
                                {t("assessments.back") || "Back"}
                              </button>
                              <div>
                                <span className="text-sm font-semibold text-[#1F2937]">
                                  {selectedQbAssessment?.title || (selectedAssessmentForQ.startsWith("course:") ? `${t("assessments.allQuestions")} — ${courses.find((c) => c.id === selectedAssessmentForQ.replace("course:", ""))?.title || ""}` : "")}
                                </span>
                                {selectedQbAssessment && (
                                  <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    selectedQbAssessment.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : selectedQbAssessment.type === "exam" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#E0E7FF] text-[#4338CA]"
                                  }`}>
                                    {selectedQbAssessment.type}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isQbAssignment && !selectedAssessmentForQ.startsWith("course:") && selectedAssessmentForQ && (
                                <>
                                  <select
                                    value={questionTypeFilter}
                                    onChange={(e) => setQuestionTypeFilter(e.target.value)}
                                    className="px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                  >
                                    <option value="all">{t("assessments.allTypes")}</option>
                                    <option value="mcq">{t("assessments.typeMCQ")}</option>
                                    <option value="true_false">{t("assessments.typeTrueFalse")}</option>
                                    <option value="short_answer">{t("assessments.typeShortAnswer")}</option>
                                    <option value="essay">{t("assessments.typeEssay")}</option>
                                  </select>
                                  <select
                                    value={questionDifficultyFilter}
                                    onChange={(e) => setQuestionDifficultyFilter(e.target.value)}
                                    className="px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                  >
                                    <option value="all">{t("assessments.allDifficulties")}</option>
                                    <option value="easy">{t("assessments.difficultyEasy")}</option>
                                    <option value="medium">{t("assessments.difficultyMedium")}</option>
                                    <option value="hard">{t("assessments.difficultyHard")}</option>
                                  </select>
                                </>
                              )}
                              {!isQbAssignment && !selectedAssessmentForQ.startsWith("course:") && selectedAssessmentForQ && (
                                <button
                                  onClick={() => setShowAddQuestionModal(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors text-sm font-medium"
                                >
                                  <Plus className="w-4 h-4" />
                                  {t("assessments.addQuestion")}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedAssessmentForQ && questionsLoading && (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                          </div>
                        )}

                        {/* Assignment Files Panel */}
                        {selectedAssessmentForQ && !questionsLoading && !selectedAssessmentForQ.startsWith("course:") && (() => {
                          const selAssignment = assessments.find((a) => a.id === selectedAssessmentForQ);
                          if (selAssignment?.type !== "assignment") return null;

                          const AssignmentFilesPanel = () => {
                            const [uploading, setUploading] = useState(false);
                            const [uploadPct, setUploadPct] = useState(0);
                            const files = selAssignment.assignmentFiles || [];

                            const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              setUploadPct(0);
                              try {
                                await instructorApi.uploadAssignmentFile(selAssignment.id, file, setUploadPct);
                                toast.success(t("assessments.assignmentFileUploaded") || "File uploaded");
                                refreshAssessments();
                              } catch {
                                toast.error(t("assessments.uploadError") || "Upload failed");
                              } finally {
                                setUploading(false);
                                e.target.value = "";
                              }
                            };

                            const handleRemoveFile = async (fileId: string) => {
                              try {
                                await instructorApi.removeAssignmentFile(selAssignment.id, fileId);
                                toast.success(t("assessments.removeFile") || "File removed");
                                refreshAssessments();
                              } catch {
                                toast.error(tToasts("failedRemoveFile"));
                              }
                            };

                            return (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium text-[#374151] mb-2">
                                    {t("assessments.assignmentFiles") || "Assignment Files"}
                                  </p>
                                  {selAssignment.instructions && (
                                    <div className="bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg p-3 mb-3">
                                      <p className="text-xs font-medium text-[#6B7280] mb-1">{t("assessments.assignmentInstructions") || "Instructions"}</p>
                                      <p className="text-sm text-[#374151] whitespace-pre-wrap">{selAssignment.instructions}</p>
                                    </div>
                                  )}
                                  {selAssignment.dueDate && (
                                    <p className="text-xs text-[#6B7280] mb-3">
                                      {t("assessments.deadline") || "Deadline"}: {new Date(selAssignment.dueDate).toLocaleString("en-SA", { timeZone: "Asia/Riyadh" })} (KSA)
                                    </p>
                                  )}
                                </div>

                                {/* Upload zone */}
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[#3B82F6] hover:bg-[#EFF6FF] transition-colors">
                                  <div className="flex flex-col items-center">
                                    <Plus className="w-8 h-8 text-[#9CA3AF] mb-1" />
                                    <p className="text-sm text-[#6B7280]">
                                      {uploading ? `${t("assessments.uploadFiles") || "Uploading"}... ${uploadPct}%` : (t("assessments.dragDropFiles") || "Click to upload files")}
                                    </p>
                                  </div>
                                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif"
                                  />
                                </label>
                                {uploading && (
                                  <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                                    <div className="bg-[#3B82F6] h-2 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                                  </div>
                                )}

                                {/* File list */}
                                {files.length === 0 ? (
                                  <p className="text-sm text-[#9CA3AF] text-center py-4">
                                    {t("assessments.noFilesUploaded") || "No files uploaded yet"}
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {files.map((f) => (
                                      <div key={f.id} className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <FileText className="w-4 h-4 text-[#3B82F6] shrink-0" />
                                          <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#3B82F6] hover:underline truncate">{f.fileName}</a>
                                          <span className="text-xs text-[#9CA3AF] shrink-0">{(f.fileSize / 1024).toFixed(0)} KB</span>
                                        </div>
                                        <button onClick={() => handleRemoveFile(f.id)} className="p-1 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return <AssignmentFilesPanel />;
                        })()}

                        {selectedAssessmentForQ && !questionsLoading && (selectedAssessmentForQ.startsWith("course:") || (() => {
                          const selA = assessments.find((a) => a.id === selectedAssessmentForQ);
                          return !selA || selA.type !== "assignment";
                        })()) && (
                          <>
                            <p className="text-sm text-[#6B7280]">
                              {filteredQuestions.length} {t("assessments.questionsInBank")}
                            </p>
                            {filteredQuestions.length === 0 ? (
                              <div className="text-center py-8">
                                <HelpCircle className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noQuestions")}
                                </p>
                              </div>
                            ) : (
                              filteredQuestions.map((question) => {
                                const opts = (question.options as { text: string; isCorrect: boolean }[] | undefined) || [];
                                return (
                                <div
                                  key={question.id}
                                  className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 border border-[var(--color-border)] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                                >
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                                      {getQuestionTypeIcon(question.type)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-[#1F2937]">
                                        {question.questionText}
                                      </p>
                                      {/* MCQ options */}
                                      {question.type === "mcq" && opts.length > 0 && (
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                          {opts.map((opt, oi) => (
                                            <span
                                              key={oi}
                                              className={`text-xs ${opt.isCorrect ? "text-[#22C55E] font-medium" : "text-[#6B7280]"}`}
                                            >
                                              {opt.isCorrect ? "\u25CF" : "\u25CB"} {opt.text}{opt.isCorrect ? ` (${t("assessments.correct")})` : ""}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {/* T/F correct answer */}
                                      {question.type === "true_false" && question.correctAnswer && (
                                        <p className="text-xs text-[#22C55E] font-medium mt-1.5">
                                          {t("assessments.correctAnswerLabel")}: {question.correctAnswer === "true" ? "True" : "False"}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="text-xs text-[#9CA3AF]">
                                          {getQuestionTypeLabel(question.type)}
                                        </span>
                                        <span className="text-xs text-[#9CA3AF]">
                                          {question.marks} {t("assessments.marks")}
                                        </span>
                                        {question.difficultyLevel && (
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getDifficultyStyle(question.difficultyLevel)}`}
                                          >
                                            {t(`assessments.difficulty${question.difficultyLevel.charAt(0).toUpperCase() + question.difficultyLevel.slice(1)}`)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => setEditingQuestion(question)}
                                      className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                      title={t("assessments.editQuestion")}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuestion(question.id)}
                                      className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                );
                              })
                            )}
                          </>
                        )}
                      </div>
                      );
                    })()}

                    {/* ═══ SUBMISSIONS TAB ═══ */}
                    {activeTab === "submissions" && (() => {
                      const subFiltered = assessments.filter((a) => {
                        if (a.status === "draft") return false;
                        if (subCourseFilter && a.courseId !== subCourseFilter) return false;
                        if (subSearchQuery && !a.title.toLowerCase().includes(subSearchQuery.toLowerCase())) return false;
                        return true;
                      });
                      const selectedSubAssessment = assessments.find((a) => a.id === selectedAssessmentForS);

                      return (
                      <div className="p-5 space-y-4">
                        {/* Assessment picker (when nothing selected) */}
                        {!selectedAssessmentForS && (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <select
                                value={subCourseFilter}
                                onChange={(e) => { setSubCourseFilter(e.target.value); }}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[200px]"
                              >
                                <option value="">{t("assessments.allCourses")}</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>{locale === "ar" && c.titleAr ? c.titleAr : c.title}</option>
                                ))}
                              </select>
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                                <input
                                  type="text"
                                  placeholder={t("assessments.searchByName") || "Search by name..."}
                                  value={subSearchQuery}
                                  onChange={(e) => setSubSearchQuery(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                />
                              </div>
                            </div>
                            {subFiltered.length === 0 ? (
                              <div className="text-center py-10">
                                <Users className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">{t("assessments.noPublishedAssessments") || "No published assessments found"}</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {subFiltered.map((a) => {
                                  const cName = courses.find((c) => c.id === a.courseId);
                                  const courseName = cName ? (locale === "ar" && cName.titleAr ? cName.titleAr : cName.title) : "";
                                  const modName = getModuleName(a);
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setSelectedAssessmentForS(a.id)}
                                      className="w-full text-start p-3 border border-[var(--color-border)] rounded-lg hover:bg-[#F9FAFB] hover:border-[#3B82F6] transition-colors flex items-center justify-between gap-3"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-[#1F2937] truncate">{a.title}</span>
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            a.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : a.type === "exam" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#E0E7FF] text-[#4338CA]"
                                          }`}>{a.type}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-xs text-[#9CA3AF]">{courseName}</span>
                                          {modName && <span className="text-xs text-[#9CA3AF]">/ {modName}</span>}
                                          <span className="text-xs text-[#9CA3AF]">{a.submissionCount || 0} {t("assessments.submissions")}</span>
                                        </div>
                                      </div>
                                      <ChevronDown className="w-4 h-4 text-[#9CA3AF] -rotate-90 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Back button + filters when assessment selected */}
                        {selectedAssessmentForS && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setSelectedAssessmentForS("")}
                                className="flex items-center gap-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                              >
                                <ChevronDown className="w-4 h-4 rotate-90" />
                                {t("assessments.back") || "Back"}
                              </button>
                              <div>
                                <span className="text-sm font-semibold text-[#1F2937]">{selectedSubAssessment?.title}</span>
                                {selectedSubAssessment && (
                                  <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    selectedSubAssessment.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : selectedSubAssessment.type === "exam" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#E0E7FF] text-[#4338CA]"
                                  }`}>{selectedSubAssessment.type}</span>
                                )}
                              </div>
                            </div>
                            <select
                              value={submissionStatusFilter}
                              onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                              className="px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            >
                              <option value="all">{t("assessments.filterByStatus")}</option>
                              <option value="submitted">{t("assessments.submissionPending")}</option>
                              <option value="graded">{t("assessments.submissionGraded")}</option>
                              <option value="in_progress">{t("assessments.submissionInProgress")}</option>
                            </select>
                          </div>
                        )}

                        {selectedAssessmentForS && submissionsLoading && (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                          </div>
                        )}

                        {selectedAssessmentForS && !submissionsLoading && (
                          <>
                            {(submissionStatusFilter === "all"
                              ? submissions
                              : submissions.filter((s) => s.status === submissionStatusFilter)
                            ).length === 0 ? (
                              <div className="text-center py-8">
                                <Users className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noSubmissions")}
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-start">
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.student")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.score")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.percentage")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.submitted")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.status")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.actions")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-border)]">
                                    {(() => {
                                      const filtered = submissionStatusFilter === "all"
                                        ? submissions
                                        : submissions.filter((s) => s.status === submissionStatusFilter);
                                      // Group by student
                                      const grouped = new Map<string, typeof submissions>();
                                      for (const sub of filtered) {
                                        const list = grouped.get(sub.studentId);
                                        if (list) list.push(sub);
                                        else grouped.set(sub.studentId, [sub]);
                                      }

                                      const renderRow = (sub: AssessmentSubmission, isNested: boolean) => {
                                        const pct = sub.percentage ? parseFloat(sub.percentage) : 0;
                                        return (
                                          <tr key={sub.id} className={`hover:bg-[#F9FAFB] ${isNested ? "bg-[#FAFAFA]" : ""}`}>
                                            <td className={`py-3 ${isNested ? "ps-14" : ""}`}>
                                              {isNested ? (
                                                <div className="flex items-center gap-2">
                                                  <span className="inline-flex items-center gap-1 text-xs text-[#7C3AED]">
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t("assessments.retakeLabel", { n: (sub.attemptNumber ?? 1) - 1 })}
                                                  </span>
                                                  {sub.isEffective && (
                                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                                      {t("assessments.effective")}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs font-semibold text-[#4B5563]">
                                                    {(sub.studentFirstName?.[0] || "").toUpperCase()}
                                                    {(sub.studentLastName?.[0] || "").toUpperCase()}
                                                  </div>
                                                  <div>
                                                    <span className="text-sm text-[#1F2937]">{sub.studentFirstName} {sub.studentLastName}</span>
                                                    <p className="text-xs text-[#9CA3AF]">{sub.studentEmail}</p>
                                                  </div>
                                                </div>
                                              )}
                                            </td>
                                            <td className="py-3">
                                              <span className={`text-sm font-semibold ${pct >= 80 ? "text-[#22C55E]" : pct >= 60 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                                                {sub.score ?? 0}/{sub.totalMarks ?? 0}
                                              </span>
                                            </td>
                                            <td className="py-3"><span className="text-sm text-[#374151]">{pct.toFixed(1)}%</span></td>
                                            <td className="py-3"><span className="text-sm text-[#6B7280]">{formatDate(sub.submittedAt)}</span></td>
                                            <td className="py-3">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSubmissionStatusStyle(sub.status)}`}>
                                                {sub.status === "graded" && <CheckCircle className="w-3 h-3" />}
                                                {sub.status === "submitted" && <Clock className="w-3 h-3" />}
                                                {getSubmissionStatusLabel(sub.status)}
                                              </span>
                                            </td>
                                            <td className="py-3">
                                              {(sub.status === "submitted" || sub.status === "graded") && (
                                                <button onClick={() => handleOpenGradeModal(sub)} className="flex items-center gap-1 px-3 py-1.5 text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors text-sm font-medium">
                                                  <Edit3 className="w-4 h-4" />
                                                  {sub.status === "submitted" ? t("assessments.grade") : t("assessments.review")}
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      };

                                      return Array.from(grouped.entries()).map(([studentId, attempts]) => {
                                        const sorted = [...attempts].sort((a, b) => (a.attemptNumber ?? 1) - (b.attemptNumber ?? 1));
                                        const effectiveRow = sorted.find((s) => s.isEffective) || sorted[sorted.length - 1];
                                        const retakeRows = sorted.filter((s) => s.id !== effectiveRow.id);
                                        const hasRetakes = retakeRows.length > 0;
                                        const isExpanded = expandedRetakeStudents.has(studentId);
                                        const pct = effectiveRow.percentage ? parseFloat(effectiveRow.percentage) : 0;

                                        return (
                                          <React.Fragment key={studentId}>
                                            <tr className="hover:bg-[#F9FAFB]">
                                              <td className="py-3">
                                                <div className="flex items-center gap-3">
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
                                                      className="p-0.5 hover:bg-[#F3F4F6] rounded flex-shrink-0"
                                                    >
                                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#6B7280]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />}
                                                    </button>
                                                  )}
                                                  <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs font-semibold text-[#4B5563]">
                                                    {(effectiveRow.studentFirstName?.[0] || "").toUpperCase()}
                                                    {(effectiveRow.studentLastName?.[0] || "").toUpperCase()}
                                                  </div>
                                                  <div>
                                                    <span className="text-sm text-[#1F2937]">{effectiveRow.studentFirstName} {effectiveRow.studentLastName}</span>
                                                    <p className="text-xs text-[#9CA3AF]">{effectiveRow.studentEmail}</p>
                                                    {hasRetakes && (
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F3E8FF] text-[#7C3AED]">
                                                          <RotateCcw className="w-2.5 h-2.5" />
                                                          {sorted.length} {t("assessments.attempts")}
                                                        </span>
                                                        {effectiveRow.isEffective && (
                                                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                                            {t("assessments.effective")}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="py-3">
                                                <span className={`text-sm font-semibold ${pct >= 80 ? "text-[#22C55E]" : pct >= 60 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                                                  {effectiveRow.score ?? 0}/{effectiveRow.totalMarks ?? 0}
                                                </span>
                                              </td>
                                              <td className="py-3"><span className="text-sm text-[#374151]">{pct.toFixed(1)}%</span></td>
                                              <td className="py-3"><span className="text-sm text-[#6B7280]">{formatDate(effectiveRow.submittedAt)}</span></td>
                                              <td className="py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSubmissionStatusStyle(effectiveRow.status)}`}>
                                                  {effectiveRow.status === "graded" && <CheckCircle className="w-3 h-3" />}
                                                  {effectiveRow.status === "submitted" && <Clock className="w-3 h-3" />}
                                                  {getSubmissionStatusLabel(effectiveRow.status)}
                                                </span>
                                              </td>
                                              <td className="py-3">
                                                {(effectiveRow.status === "submitted" || effectiveRow.status === "graded") && (
                                                  <button onClick={() => handleOpenGradeModal(effectiveRow)} className="flex items-center gap-1 px-3 py-1.5 text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors text-sm font-medium">
                                                    <Edit3 className="w-4 h-4" />
                                                    {effectiveRow.status === "submitted" ? t("assessments.grade") : t("assessments.review")}
                                                  </button>
                                                )}
                                              </td>
                                            </tr>
                                            {isExpanded && retakeRows.map((sub) => renderRow(sub, true))}
                                          </React.Fragment>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      );
                    })()}

                    {/* ═══ ITEM ANALYSIS TAB ═══ */}
                    {activeTab === "itemAnalysis" && (() => {
                      const iaFiltered = assessments.filter((a) => {
                        if (a.status === "draft") return false;
                        if (a.type === "assignment") return false;
                        if (iaCourseFilter && a.courseId !== iaCourseFilter) return false;
                        if (iaSearchQuery && !a.title.toLowerCase().includes(iaSearchQuery.toLowerCase())) return false;
                        return true;
                      });
                      const selectedIAAssessment = assessments.find((a) => a.id === selectedAssessmentForIA);

                      return (
                      <div className="p-5 space-y-4">
                        {/* Assessment picker (when nothing selected) */}
                        {!selectedAssessmentForIA && (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <select
                                value={iaCourseFilter}
                                onChange={(e) => { setIaCourseFilter(e.target.value); }}
                                className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[200px]"
                              >
                                <option value="">{t("assessments.allCourses") || "All Courses"}</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>{locale === "ar" && c.titleAr ? c.titleAr : c.title}</option>
                                ))}
                              </select>
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                                <input
                                  type="text"
                                  placeholder={t("assessments.searchByName") || "Search by name..."}
                                  value={iaSearchQuery}
                                  onChange={(e) => setIaSearchQuery(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                />
                              </div>
                            </div>
                            {iaFiltered.length === 0 ? (
                              <div className="text-center py-10">
                                <BarChart3 className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">{t("assessments.noPublishedAssessments") || "No published assessments found"}</p>
                                <p className="text-xs text-[#9CA3AF] mt-1">{t("assessments.itemAnalysisQuizExamOnly") || "Item analysis is available for quizzes and exams only"}</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {iaFiltered.map((a) => {
                                  const cName = courses.find((c) => c.id === a.courseId);
                                  const courseName = cName ? (locale === "ar" && cName.titleAr ? cName.titleAr : cName.title) : "";
                                  const modName = getModuleName(a);
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setSelectedAssessmentForIA(a.id)}
                                      className="w-full text-start p-3 border border-[var(--color-border)] rounded-lg hover:bg-[#F9FAFB] hover:border-[#3B82F6] transition-colors flex items-center justify-between gap-3"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-[#1F2937] truncate">{a.title}</span>
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            a.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : "bg-[#FEF3C7] text-[#D97706]"
                                          }`}>{a.type}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-xs text-[#9CA3AF]">{courseName}</span>
                                          {modName && <span className="text-xs text-[#9CA3AF]">/ {modName}</span>}
                                          <span className="text-xs text-[#9CA3AF]">{a.totalMarks || 0} {t("assessments.marks")}</span>
                                        </div>
                                      </div>
                                      <ChevronDown className="w-4 h-4 text-[#9CA3AF] -rotate-90 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Back button when assessment selected */}
                        {selectedAssessmentForIA && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setSelectedAssessmentForIA("")}
                              className="flex items-center gap-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                            >
                              <ChevronDown className="w-4 h-4 rotate-90" />
                              {t("assessments.back") || "Back"}
                            </button>
                            <div>
                              <span className="text-sm font-semibold text-[#1F2937]">{selectedIAAssessment?.title}</span>
                              {selectedIAAssessment && (
                                <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  selectedIAAssessment.type === "quiz" ? "bg-[#DBEAFE] text-[#2563EB]" : "bg-[#FEF3C7] text-[#D97706]"
                                }`}>{selectedIAAssessment.type}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedAssessmentForIA && iaLoading && (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                          </div>
                        )}

                        {selectedAssessmentForIA && !iaLoading && itemAnalysis && (
                          <>
                            {/* Summary */}
                            <div className="flex items-center gap-4 p-3 bg-[#F9FAFB] rounded-xl">
                              <div className="text-center">
                                <p className="text-lg font-bold text-[#1F2937]">
                                  {itemAnalysis.totalSubmissions}
                                </p>
                                <p className="text-xs text-[#6B7280]">
                                  {t("assessments.totalSubmissions")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-[#1F2937]">
                                  {itemAnalysis.questions.length}
                                </p>
                                <p className="text-xs text-[#6B7280]">
                                  {t("assessments.questions")}
                                </p>
                              </div>
                            </div>

                            {/* Pre/Post Comparison */}
                            {itemAnalysis.prePostComparison &&
                              itemAnalysis.prePostComparison.length > 1 && (
                                <div className="p-4 border border-[var(--color-border)] rounded-xl">
                                  <h4 className="text-sm font-semibold text-[#1F2937] mb-3">
                                    {t("assessments.prePostComparison")}
                                  </h4>
                                  <div className="space-y-2">
                                    {itemAnalysis.prePostComparison!.map((item, idx) => {
                                      const firstAvg = itemAnalysis.prePostComparison![0].averagePercentage;
                                      const delta = idx > 0 ? item.averagePercentage - firstAvg : null;
                                      return (
                                        <div
                                          key={item.assessmentId}
                                          className="flex items-center justify-between"
                                        >
                                          <span className="text-sm text-[#374151] flex-1 min-w-0 truncate">
                                            {item.title}
                                          </span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <div className="w-24 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-[#3B82F6] rounded-full"
                                                style={{
                                                  width: `${Math.min(item.averagePercentage, 100)}%`,
                                                }}
                                              />
                                            </div>
                                            <span className="text-sm font-medium text-[#374151] w-12 text-right">
                                              {item.averagePercentage.toFixed(1)}%
                                            </span>
                                            {delta !== null && (
                                              <span
                                                className={`text-xs font-medium w-14 text-right ${
                                                  delta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                                                }`}
                                              >
                                                {delta >= 0 ? "+" : ""}
                                                {delta.toFixed(1)}%
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                            {/* Question-Level Analysis */}
                            {itemAnalysis.questions.length === 0 ? (
                              <div className="text-center py-8">
                                <BarChart3 className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noAnalysisData")}
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-start">
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.question")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.correctRate")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.difficultyIndex")}
                                      </th>
                                      <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                        {t("assessments.discrimination")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-border)]">
                                    {itemAnalysis.questions.map((item, idx) => {
                                      const correctRate =
                                        item.totalAttempts > 0
                                          ? Math.round(
                                              (item.correctAnswers / item.totalAttempts) * 100
                                            )
                                          : 0;
                                      const disc = getDiscriminationLabel(
                                        item.discriminationIndex
                                      );
                                      return (
                                        <tr
                                          key={item.questionId}
                                          className="hover:bg-[#F9FAFB]"
                                        >
                                          <td className="py-3 max-w-[300px]">
                                            <span className="text-sm text-[#1F2937] line-clamp-2">
                                              {idx + 1}. {item.questionText}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <div className="flex items-center gap-2">
                                              <div className="w-20 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full ${
                                                    correctRate >= 70
                                                      ? "bg-[#22C55E]"
                                                      : correctRate >= 50
                                                        ? "bg-[#EAB308]"
                                                        : "bg-[#EF4444]"
                                                  }`}
                                                  style={{
                                                    width: `${correctRate}%`,
                                                  }}
                                                />
                                              </div>
                                              <span className="text-sm text-[#374151]">
                                                {correctRate}%
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-3">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyStyle(
                                                item.difficultyIndex >= 0.7
                                                  ? "easy"
                                                  : item.difficultyIndex >= 0.3
                                                    ? "medium"
                                                    : "hard"
                                              )}`}
                                            >
                                              {item.difficultyIndex.toFixed(2)} —{" "}
                                              {getDifficultyIndexLabel(
                                                item.difficultyIndex
                                              )}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <span
                                              className={`flex items-center gap-1 text-sm font-medium ${disc.style}`}
                                            >
                                              {disc.icon}
                                              {item.discriminationIndex.toFixed(2)} —{" "}
                                              {disc.label}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && courses.length > 0 && (
        <CreateAssessmentModal
          courses={courses}
          locale={locale}
          t={t}
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshAssessments}
        />
      )}

      {editingAssessment && (
        <EditAssessmentModal
          assessment={editingAssessment}
          t={t}
          onClose={() => setEditingAssessment(null)}
          onUpdated={refreshAssessments}
        />
      )}

      {showAddQuestionModal && selectedAssessmentForQ && (
        <AddQuestionModal
          assessmentId={selectedAssessmentForQ}
          t={t}
          onClose={() => setShowAddQuestionModal(false)}
          onAdded={async () => {
            const data = selectedAssessmentForQ.startsWith("course:")
              ? await instructorApi.getCourseBankQuestions(selectedAssessmentForQ.replace("course:", ""))
              : await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
            setQuestions(data);
          }}
        />
      )}

      {editingQuestion && selectedAssessmentForQ && (
        <EditQuestionModal
          question={editingQuestion}
          assessmentId={selectedAssessmentForQ}
          t={t}
          onClose={() => setEditingQuestion(null)}
          onUpdated={async () => {
            const data = selectedAssessmentForQ.startsWith("course:")
              ? await instructorApi.getCourseBankQuestions(selectedAssessmentForQ.replace("course:", ""))
              : await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
            setQuestions(data);
          }}
        />
      )}

      {publishConfirmId && (
        <ModalOverlay onClose={() => { setPublishConfirmId(null); setPublishCheckData(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {t("assessments.confirmPublish")}
              </h3>
              <button onClick={() => { setPublishConfirmId(null); setPublishCheckData(null); }} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            {publishCheckLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
              </div>
            ) : publishCheckData ? (
              <div className="space-y-3 mb-5">
                {publishCheckData.isAssignment ? (
                  <>
                    <div className="flex items-center gap-2">
                      {publishCheckData.hasFiles ? (
                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      )}
                      <span className="text-sm text-[#374151]">
                        {publishCheckData.hasFiles ? t("assessments.filesUploaded") || "Assignment files uploaded" : t("assessments.noFiles") || "No assignment files uploaded"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {publishCheckData.hasDueDate ? (
                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      )}
                      <span className="text-sm text-[#374151]">
                        {publishCheckData.hasDueDate ? t("assessments.dueDateSet") || "Due date set" : t("assessments.noDueDate") || "No due date set"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {publishCheckData.questionCount > 0 ? (
                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      )}
                      <span className="text-sm text-[#374151]">
                        {publishCheckData.questionCount} {t("assessments.questions")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {publishCheckData.marksSum === publishCheckData.totalMarks ? (
                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#EAB308]" />
                      )}
                      <span className="text-sm text-[#374151]">
                        {t("assessments.marksTotal")}: {publishCheckData.marksSum} / {publishCheckData.totalMarks}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!publishCheckData.missingCorrect ? (
                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      )}
                      <span className="text-sm text-[#374151]">
                        {publishCheckData.missingCorrect
                          ? t("assessments.mcqNoCorrectAnswer")
                          : t("assessments.correctAnswer")}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={() => { setPublishConfirmId(null); setPublishCheckData(null); }}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                {t("assessments.cancel")}
              </button>
              <button
                onClick={async () => {
                  const id = publishConfirmId;
                  setPublishConfirmId(null);
                  setPublishCheckData(null);
                  if (id) await handlePublish(id);
                }}
                disabled={publishCheckLoading}
                className="flex-1 px-4 py-2.5 bg-[#22C55E] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#16A34A]"
              >
                {t("assessments.confirmPublishBtn")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {gradeModalData && (() => {
        const gradeAssessment = assessments.find((a) => a.id === selectedAssessmentForS);
        return (
          <GradeModal
            submission={gradeModalData.submission}
            questions={gradeModalData.questions}
            assessmentId={selectedAssessmentForS || ''}
            assessmentType={gradeAssessment?.type}
            totalMarks={gradeAssessment?.totalMarks}
            t={t}
            onClose={() => setGradeModalData(null)}
            onGraded={async () => {
              if (selectedAssessmentForS) {
                const data = await instructorApi.getSubmissions(selectedAssessmentForS);
                setSubmissions(data);
              }
            }}
          />
        );
      })()}
    </>
  );
};

export default AssessmentsContent;
