"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { instructorApi } from "@/lib/api";
import { toast } from "sonner";
import type {
  AssessmentResponse,
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
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim()) return;
    setSaving(true);
    try {
      await instructorApi.createAssessment({
        courseId,
        title: title.trim(),
        type,
        totalMarks: Number(totalMarks) || 1,
        passingMarks: Number(passingMarks) || 0,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
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
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              required
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" && c.titleAr ? c.titleAr : c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("assessments.assessmentTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="quiz">{t("assessments.typeQuiz")}</option>
                <option value="exam">{t("assessments.typeExam")}</option>
                <option value="assignment">{t("assessments.typeAssignment")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.duration")}
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                placeholder={t("assessments.minutes")}
                min={1}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.totalMarks")}
              </label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
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
  const [status, setStatus] = useState(assessment.status);
  const [saving, setSaving] = useState(false);

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
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        status,
      });
      toast.success(t("assessments.editSuccess"));
      onUpdated();
      onClose();
    } catch {
      toast.error(t("assessments.editError"));
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
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("assessments.duration")}
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                placeholder={t("assessments.minutes")}
                min={1}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
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

      await instructorApi.addQuestion(assessmentId, data);
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
                className="w-full px-2 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-2 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                className="w-full px-2 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
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
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
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
                <div key={idx} className="flex items-center gap-2">
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
                    className="flex-1 px-2 py-1.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
              className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
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

/* ──────────────────────── Grade Modal ────────────────────────── */
const GradeModal = ({
  submission,
  questions,
  assessmentId,
  t,
  onClose,
  onGraded,
}: {
  submission: AssessmentSubmission;
  questions: AssessmentQuestion[];
  assessmentId: string;
  t: (key: string) => string;
  onClose: () => void;
  onGraded: () => void;
}) => {
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
      const gradeItems = Object.entries(grades).map(([questionId, marksAwarded]) => ({
        questionId,
        marksAwarded,
      }));
      await instructorApi.gradeSubmission(assessmentId, submission.id, gradeItems);
      toast.success(t("assessments.gradeSuccess"));
      onGraded();
      onClose();
    } catch {
      toast.error(t("assessments.gradeError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
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

        <div className="space-y-4">
          {submission.answers.map((answer, idx) => {
            const question = questionsMap.get(answer.questionId);
            const maxMarks = question?.marks || 1;
            const needsManualGrade =
              question?.type === "essay" || question?.type === "short_answer";

            return (
              <div
                key={answer.questionId}
                className="p-4 border border-[#E5E7EB] rounded-xl"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1F2937]">
                      {idx + 1}. {question?.questionText || t("assessments.unknownQuestion")}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      {t("assessments.studentAnswer")}: <span className="text-[#374151]">{answer.answer}</span>
                    </p>
                  </div>
                  {answer.isCorrect !== null && (
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
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-[#6B7280]">
                      {t("assessments.marks")}:
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
                      className="w-20 px-2 py-1 border border-[#E5E7EB] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      min={0}
                      max={maxMarks}
                    />
                    <span className="text-xs text-[#9CA3AF]">/ {maxMarks}</span>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7280] mt-1">
                    {t("assessments.autoGraded")}: {answer.marksAwarded ?? 0}/{maxMarks}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
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
  const locale = useLocale();
  const isRTL = locale === "ar";

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
  const [selectedAssessmentForQ, setSelectedAssessmentForQ] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("all");

  // Submissions tab state
  const [selectedAssessmentForS, setSelectedAssessmentForS] = useState("");
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [gradeModalData, setGradeModalData] = useState<{
    submission: AssessmentSubmission;
    questions: AssessmentQuestion[];
  } | null>(null);

  // Item Analysis tab state
  const [selectedAssessmentForIA, setSelectedAssessmentForIA] = useState("");
  const [itemAnalysis, setItemAnalysis] = useState<ItemAnalysisResponse | null>(null);
  const [iaLoading, setIaLoading] = useState(false);

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
        const data = await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
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
        return "bg-[#FEE2E2] text-[#EF4444]";
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
    } catch {
      toast.error(t("assessments.publishError"));
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await instructorApi.deleteQuestion(selectedAssessmentForQ || '', questionId);
      toast.success(t("assessments.questionDeleted"));
      // Refresh questions
      if (selectedAssessmentForQ) {
        const data = await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
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
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
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
                  <div className="bg-white rounded-xl border border-[#E5E7EB]">
                    <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
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
                        <div className="p-4 border-b border-[#E5E7EB]">
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
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                              />
                            </div>
                            <button
                              onClick={() => setShowFilters(!showFilters)}
                              className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
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
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {types.map((t_) => (
                                  <option key={t_.id} value={t_.id}>{t_.name}</option>
                                ))}
                              </select>
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {statusOptions.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {showFilters && (
                            <div className="md:hidden mt-4 pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-3">
                              <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              >
                                {types.map((t_) => (
                                  <option key={t_.id} value={t_.id}>{t_.name}</option>
                                ))}
                              </select>
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                              <ClipboardList className="w-12 h-12 text-[#D1D5DB] mx-auto mb-4" />
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
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
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
                                        onClick={() => handlePublish(assessment.id)}
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
                    {activeTab === "questionBank" && (
                      <div className="p-5 space-y-4">
                        {/* Assessment Selector */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <select
                              value={selectedAssessmentForQ}
                              onChange={(e) => setSelectedAssessmentForQ(e.target.value)}
                              className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[200px]"
                            >
                              <option value="">{t("assessments.selectAssessment")}</option>
                              {assessments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.title}
                                </option>
                              ))}
                            </select>
                            {selectedAssessmentForQ && (
                              <>
                                <select
                                  value={questionTypeFilter}
                                  onChange={(e) => setQuestionTypeFilter(e.target.value)}
                                  className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                                  className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                >
                                  <option value="all">{t("assessments.allDifficulties")}</option>
                                  <option value="easy">{t("assessments.difficultyEasy")}</option>
                                  <option value="medium">{t("assessments.difficultyMedium")}</option>
                                  <option value="hard">{t("assessments.difficultyHard")}</option>
                                </select>
                              </>
                            )}
                          </div>
                          {selectedAssessmentForQ && (
                            <button
                              onClick={() => setShowAddQuestionModal(true)}
                              className="flex items-center gap-2 px-3 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors text-sm font-medium"
                            >
                              <Plus className="w-4 h-4" />
                              {t("assessments.addQuestion")}
                            </button>
                          )}
                        </div>

                        {!selectedAssessmentForQ && (
                          <div className="text-center py-12">
                            <HelpCircle className="w-12 h-12 text-[#D1D5DB] mx-auto mb-4" />
                            <p className="text-sm text-[#6B7280]">
                              {t("assessments.selectAssessmentForQuestions")}
                            </p>
                          </div>
                        )}

                        {selectedAssessmentForQ && questionsLoading && (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                          </div>
                        )}

                        {selectedAssessmentForQ && !questionsLoading && (
                          <>
                            <p className="text-sm text-[#6B7280]">
                              {filteredQuestions.length} {t("assessments.questionsInBank")}
                            </p>
                            {filteredQuestions.length === 0 ? (
                              <div className="text-center py-8">
                                <HelpCircle className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noQuestions")}
                                </p>
                              </div>
                            ) : (
                              filteredQuestions.map((question) => (
                                <div
                                  key={question.id}
                                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                                >
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                                      {getQuestionTypeIcon(question.type)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-[#1F2937] line-clamp-2">
                                        {question.questionText}
                                      </p>
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
                                      onClick={() => handleDeleteQuestion(question.id)}
                                      className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* ═══ SUBMISSIONS TAB ═══ */}
                    {activeTab === "submissions" && (
                      <div className="p-5 space-y-4">
                        {/* Assessment Selector */}
                        <select
                          value={selectedAssessmentForS}
                          onChange={(e) => setSelectedAssessmentForS(e.target.value)}
                          className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[250px]"
                        >
                          <option value="">{t("assessments.selectAssessment")}</option>
                          {assessments
                            .filter((a) => a.status !== "draft")
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.title}
                              </option>
                            ))}
                        </select>

                        {!selectedAssessmentForS && (
                          <div className="text-center py-12">
                            <Users className="w-12 h-12 text-[#D1D5DB] mx-auto mb-4" />
                            <p className="text-sm text-[#6B7280]">
                              {t("assessments.selectAssessmentForSubmissions")}
                            </p>
                          </div>
                        )}

                        {selectedAssessmentForS && submissionsLoading && (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                          </div>
                        )}

                        {selectedAssessmentForS && !submissionsLoading && (
                          <>
                            {submissions.length === 0 ? (
                              <div className="text-center py-8">
                                <Users className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noSubmissions")}
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-left">
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
                                  <tbody className="divide-y divide-[#E5E7EB]">
                                    {submissions.map((sub) => {
                                      const pct = sub.percentage
                                        ? parseFloat(sub.percentage)
                                        : 0;
                                      return (
                                        <tr key={sub.id} className="hover:bg-[#F9FAFB]">
                                          <td className="py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-semibold text-[#4B5563]">
                                                {(sub.studentFirstName?.[0] || "")
                                                  .toUpperCase()}
                                                {(sub.studentLastName?.[0] || "")
                                                  .toUpperCase()}
                                              </div>
                                              <div>
                                                <span className="text-sm text-[#1F2937]">
                                                  {sub.studentFirstName} {sub.studentLastName}
                                                </span>
                                                <p className="text-xs text-[#9CA3AF]">
                                                  {sub.studentEmail}
                                                </p>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-3">
                                            <span
                                              className={`text-sm font-semibold ${
                                                pct >= 80
                                                  ? "text-[#22C55E]"
                                                  : pct >= 60
                                                    ? "text-[#EAB308]"
                                                    : "text-[#EF4444]"
                                              }`}
                                            >
                                              {sub.score ?? 0}/{sub.totalMarks ?? 0}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <span className="text-sm text-[#374151]">
                                              {pct.toFixed(1)}%
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <span className="text-sm text-[#6B7280]">
                                              {formatDate(sub.submittedAt)}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <span
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSubmissionStatusStyle(sub.status)}`}
                                            >
                                              {sub.status === "graded" && (
                                                <CheckCircle className="w-3 h-3" />
                                              )}
                                              {sub.status === "submitted" && (
                                                <Clock className="w-3 h-3" />
                                              )}
                                              {getSubmissionStatusLabel(sub.status)}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            {(sub.status === "submitted" || sub.status === "graded") && (
                                              <button
                                                onClick={() => handleOpenGradeModal(sub)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors text-sm font-medium"
                                              >
                                                <Edit3 className="w-4 h-4" />
                                                {sub.status === "submitted"
                                                  ? t("assessments.grade")
                                                  : t("assessments.review")}
                                              </button>
                                            )}
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
                    )}

                    {/* ═══ ITEM ANALYSIS TAB ═══ */}
                    {activeTab === "itemAnalysis" && (
                      <div className="p-5 space-y-4">
                        {/* Assessment Selector */}
                        <select
                          value={selectedAssessmentForIA}
                          onChange={(e) => setSelectedAssessmentForIA(e.target.value)}
                          className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[250px]"
                        >
                          <option value="">{t("assessments.selectAssessment")}</option>
                          {assessments
                            .filter((a) => a.status !== "draft")
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.title}
                              </option>
                            ))}
                        </select>

                        {!selectedAssessmentForIA && (
                          <div className="text-center py-12">
                            <BarChart3 className="w-12 h-12 text-[#D1D5DB] mx-auto mb-4" />
                            <p className="text-sm text-[#6B7280]">
                              {t("assessments.selectAssessmentForAnalysis")}
                            </p>
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
                                <div className="p-4 border border-[#E5E7EB] rounded-xl">
                                  <h4 className="text-sm font-semibold text-[#1F2937] mb-3">
                                    {t("assessments.prePostComparison")}
                                  </h4>
                                  <div className="space-y-2">
                                    {itemAnalysis.prePostComparison.map((item) => (
                                      <div
                                        key={item.assessmentId}
                                        className="flex items-center justify-between"
                                      >
                                        <span className="text-sm text-[#374151]">
                                          {item.title}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <div className="w-24 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
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
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Question-Level Analysis */}
                            {itemAnalysis.questions.length === 0 ? (
                              <div className="text-center py-8">
                                <BarChart3 className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                                <p className="text-sm text-[#6B7280]">
                                  {t("assessments.noAnalysisData")}
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-left">
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
                                  <tbody className="divide-y divide-[#E5E7EB]">
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
                                              <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
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
                    )}
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
            const data = await instructorApi.getAssessmentQuestions(selectedAssessmentForQ);
            setQuestions(data);
          }}
        />
      )}

      {gradeModalData && (
        <GradeModal
          submission={gradeModalData.submission}
          questions={gradeModalData.questions}
          assessmentId={selectedAssessmentForS || ''}
          t={t}
          onClose={() => setGradeModalData(null)}
          onGraded={async () => {
            if (selectedAssessmentForS) {
              const data = await instructorApi.getSubmissions(selectedAssessmentForS);
              setSubmissions(data);
            }
          }}
        />
      )}
    </>
  );
};

export default AssessmentsContent;
