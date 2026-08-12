"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  X,
  Loader2,
  Clock,
  FileCheck2,
  Target,
  Hash,
  CheckCircle2,
  Circle,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import { instructorApi } from "@/lib/api";
import { pickLocaleTitle } from "@/lib/locale-title";
import type {
  AssessmentResponse,
  AssessmentQuestion,
} from "@/types/instructor-dashboard";

interface Props {
  assessmentId: string;
  courseId: string;
  open: boolean;
  onClose: () => void;
  /** Where the "View submissions" button should link. */
  submissionsHrefBase: string;
}

export default function AssessmentPreviewDrawer({
  assessmentId,
  courseId,
  open,
  onClose,
  submissionsHrefBase,
}: Props) {
  const t = useTranslations("adminDashboard.assessmentPreview");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<
    (AssessmentResponse & { questions: AssessmentQuestion[] }) | null
  >(null);

  useEffect(() => {
    if (!open || !assessmentId) return;
    let cancelled = false;
    setLoading(true);
    setAssessment(null);
    instructorApi
      .getAssessmentDetail(assessmentId)
      .then((res) => {
        if (!cancelled) setAssessment(res);
      })
      .catch(() => {
        if (!cancelled) setAssessment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, assessmentId]);

  if (!open) return null;

  const submissionCount = assessment?.submissionCount ?? 0;
  const typeBadgeStyle =
    assessment?.type === "assignment"
      ? "bg-amber-50 text-amber-700"
      : assessment?.type === "exam"
        ? "bg-purple-50 text-purple-700"
        : "bg-blue-50 text-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-2xl h-full bg-[var(--color-surface-page)] shadow-2xl flex flex-col ${
          isRTL ? "border-r" : "border-l"
        } border-[var(--color-border)]`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                {t("title")}
              </p>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {assessment ? pickLocaleTitle(assessment.title, assessment.titleAr, locale) : "—"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-border-subtle)] flex-shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {assessment && (
            <>
              {/* Meta chips */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeBadgeStyle}`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  {assessment.type}
                </span>
                <MetaChip icon={Target} label={`${assessment.totalMarks} ${t("marks")}`} />
                <MetaChip icon={FileCheck2} label={`${assessment.passingMarks} ${t("passing")}`} />
                {assessment.durationMinutes ? (
                  <MetaChip
                    icon={Clock}
                    label={`${assessment.durationMinutes} ${t("minutes")}`}
                  />
                ) : null}
                <MetaChip
                  icon={Hash}
                  label={`${assessment.questions?.length ?? 0} ${t("questions")}`}
                />
              </div>

              {/* Submissions block */}
              <div className="flex items-center justify-between gap-3 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("submissionsLabel")}
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {submissionCount}
                  </p>
                </div>
                <Link
                  href={`${submissionsHrefBase}/${assessmentId}/submissions`}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-semibold rounded-lg whitespace-nowrap ${
                    submissionCount === 0 ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {t("viewSubmissions")}
                  <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {!loading && assessment && assessment.questions?.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)] py-12 text-center">
              {t("noQuestions")}
            </p>
          )}

          {!loading &&
            assessment?.questions?.map((q, idx) => (
              <QuestionCard key={q.id} q={q} index={idx + 1} courseId={courseId} />
            ))}
        </div>
      </div>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: typeof Clock;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-page)] border border-[var(--color-border)]">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function QuestionCard({
  q,
  index,
}: {
  q: AssessmentQuestion;
  index: number;
  courseId: string;
}) {
  const t = useTranslations("adminDashboard.assessmentPreview");
  const locale = useLocale();
  const questionText =
    locale === "ar" && q.questionTextAr ? q.questionTextAr : q.questionText;

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-border-subtle)] text-xs font-semibold text-[var(--color-text-primary)] flex-shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {questionText}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium">
              {q.type.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {q.marks} {t("marks")}
            </span>
          </div>
        </div>
      </div>

      {/* MCQ / True/False options */}
      {(q.type === "mcq" || q.type === "true_false") && q.options && q.options.length > 0 && (
        <ul className="space-y-1.5 ms-9">
          {q.options.map((opt, i) => {
            const text =
              locale === "ar" && opt.textAr ? opt.textAr : opt.text;
            return (
              <li
                key={`${q.id}-${i}`}
                className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded ${
                  opt.isCorrect
                    ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {opt.isCorrect ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
                )}
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Short answer / essay — show the model answer if provided */}
      {(q.type === "short_answer" || q.type === "essay") && q.correctAnswer && (
        <div className="ms-9 mt-2 p-2 rounded bg-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)]">
          <span className="font-medium">{t("modelAnswer")}: </span>
          {q.correctAnswer}
        </div>
      )}
    </div>
  );
}
