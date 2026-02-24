"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { studentApi } from "@/lib/api";
import type {
  StudentAssessment,
  AssessmentResult,
} from "@/types/student-dashboard";

const AssessmentContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const assessmentId = params.assessmentId as string;

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [assessment, setAssessment] = useState<StudentAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        const data = await studentApi.getAssessment(assessmentId);
        setAssessment(data);
        if (data.durationMinutes) {
          setTimeLeft(data.durationMinutes * 60);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load assessment"
        );
      } finally {
        setLoading(false);
      }
    };
    loadAssessment();
  }, [assessmentId]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, result]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && !result && !submitting && assessment) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const handleSubmit = useCallback(async () => {
    if (!assessment || submitting) return;

    setSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(
        ([questionId, answer]) => ({
          questionId,
          answer,
        })
      );
      const res = await studentApi.submitAssessment(assessmentId, answerArray);
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit assessment"
      );
    } finally {
      setSubmitting(false);
    }
  }, [assessment, submitting, answers, assessmentId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto mb-3" />
          <p className="text-[#6B7280] mb-4">{error}</p>
          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="text-sm text-[#002D87] hover:underline"
          >
            {t("courseDetail.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  // Results view
  if (result) {
    return (
      <div
        className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          {result.passed ? (
            <CheckCircle2 className="w-16 h-16 text-[#16A34A] mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-[#DC2626] mx-auto mb-4" />
          )}

          <h2 className="text-xl font-bold text-[#1F2937] mb-2">
            {result.passed
              ? t("assessment.passed")
              : t("assessment.failed")}
          </h2>

          <p className="text-[#6B7280] mb-6">{t("assessment.resultMessage")}</p>

          <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">
                  {t("assessment.score")}
                </p>
                <p className="text-lg font-bold text-[#1F2937]">
                  {result.score}/{result.totalMarks}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">
                  {t("assessment.percentage")}
                </p>
                <p className="text-lg font-bold text-[#1F2937]">
                  {result.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg"
          >
            {t("assessment.backToCourse")}
          </Link>
        </div>
      </div>
    );
  }

  const question = assessment.questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = assessment.questions.length;

  return (
    <div className="min-h-screen bg-[#F9FAFB]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            >
              <BackIcon className="w-5 h-5 text-[#4B5563]" />
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-[#1F2937]">
              {assessment.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  timeLeft < 60
                    ? "bg-red-50 text-[#DC2626]"
                    : timeLeft < 300
                      ? "bg-yellow-50 text-[#D4A520]"
                      : "bg-[#F3F4F6] text-[#4B5563]"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {/* Progress */}
            <span className="text-xs text-[#6B7280]">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* Question Area */}
      <div className="max-w-[900px] mx-auto px-4 py-6 sm:py-8">
        {/* Question Header */}
        <div className="mb-6">
          <p className="text-xs text-[#6B7280] mb-1">
            {t("assessment.question")} {currentQuestion + 1} / {totalQuestions}
          </p>
          <p className="text-xs text-[#9CA3AF]">
            {question.marks} {question.marks === 1 ? t("assessment.mark") : t("assessment.marks")}
          </p>
        </div>

        {/* Question */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
          <p className="text-base sm:text-lg font-medium text-[#1F2937] mb-6">
            {isRTL && question.questionTextAr
              ? question.questionTextAr
              : question.questionText}
          </p>

          {/* MCQ / True-False Options */}
          {(question.type === "mcq" || question.type === "true_false") && (
            <div className="space-y-3">
              {question.options.map((option, index) => {
                const optionText =
                  isRTL && option.textAr ? option.textAr : option.text;
                const isSelected = answers[question.id] === option.text;

                return (
                  <button
                    key={index}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: option.text,
                      }))
                    }
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-start ${
                      isSelected
                        ? "border-[#002D87] bg-[#F0F7FF]"
                        : "border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "border-[#002D87] bg-[#002D87]"
                          : "border-[#D1D5DB]"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        isSelected
                          ? "text-[#002D87] font-medium"
                          : "text-[#4B5563]"
                      }`}
                    >
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Short Answer */}
          {question.type === "short_answer" && (
            <input
              type="text"
              value={answers[question.id] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={t("assessment.typeAnswer")}
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent"
            />
          )}

          {/* Essay */}
          {question.type === "essay" && (
            <textarea
              value={answers[question.id] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={t("assessment.typeAnswer")}
              rows={6}
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent resize-none"
            />
          )}
        </div>

        {/* Navigation + Submit */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
            disabled={currentQuestion === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors disabled:opacity-40"
          >
            {isRTL ? (
              <ArrowRight className="w-4 h-4" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            {t("assessment.previous")}
          </button>

          <div className="flex items-center gap-2">
            {currentQuestion < totalQuestions - 1 ? (
              <button
                onClick={() =>
                  setCurrentQuestion((p) =>
                    Math.min(totalQuestions - 1, p + 1)
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white rounded-lg text-sm hover:bg-[#111827] transition-colors"
              >
                {t("assessment.next")}
                {isRTL ? (
                  <ArrowLeft className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t("assessment.submit")}
              </button>
            )}
          </div>
        </div>

        {/* Question Navigation Dots */}
        <div className="flex flex-wrap gap-2 justify-center mt-8">
          {assessment.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(index)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                index === currentQuestion
                  ? "bg-[#002D87] text-white"
                  : answers[q.id]
                    ? "bg-[#16A34A] text-white"
                    : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssessmentContent;
