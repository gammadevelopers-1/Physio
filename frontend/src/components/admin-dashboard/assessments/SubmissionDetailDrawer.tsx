"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  X,
  CheckCircle2,
  XCircle,
  Circle,
  FileText,
  Download,
  Clock,
  User,
  MessageSquare,
} from "lucide-react";
import type {
  AssessmentResponse,
  AssessmentQuestion,
  AssessmentSubmission,
} from "@/types/instructor-dashboard";

type Status = "in_progress" | "submitted" | "graded";

interface Props {
  open: boolean;
  onClose: () => void;
  submission: AssessmentSubmission | null;
  assessment: (AssessmentResponse & { questions: AssessmentQuestion[] }) | null;
}

function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("adminDashboard.submissionDetail");
  const style =
    status === "graded"
      ? "bg-[#DCFCE7] text-[#16A34A]"
      : status === "submitted"
        ? "bg-[#FEF3C7] text-[#D97706]"
        : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  const label =
    status === "graded"
      ? t("statuses.graded")
      : status === "submitted"
        ? t("statuses.submitted")
        : t("statuses.inProgress");
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${style}`}>{label}</span>
  );
}

export default function SubmissionDetailDrawer({
  open,
  onClose,
  submission,
  assessment,
}: Props) {
  const t = useTranslations("adminDashboard.submissionDetail");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Build a map for quick question lookup by id.
  const questionMap = useMemo(() => {
    const map = new Map<string, AssessmentQuestion>();
    assessment?.questions?.forEach((q) => map.set(q.id, q));
    return map;
  }, [assessment]);

  if (!open || !submission) return null;

  const studentName =
    `${submission.studentFirstName || ""} ${submission.studentLastName || ""}`.trim() ||
    submission.studentEmail;

  const status = submission.status;
  const isGraded = status === "graded";
  const totalScored = submission.answers?.reduce(
    (sum, a) => sum + (a.marksAwarded ?? 0),
    0,
  ) ?? 0;
  const grandTotal = submission.totalMarks ?? assessment?.totalMarks ?? 0;
  const pct = grandTotal > 0 ? Math.round((totalScored / grandTotal) * 100) : 0;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-3xl h-full bg-[var(--color-surface-page)] shadow-2xl flex flex-col ${
          isRTL ? "border-r" : "border-l"
        } border-[var(--color-border)]`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {t("studentLabel")}
              </p>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {studentName}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                {submission.studentEmail}
              </p>
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

          {/* Score summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCell
              label={t("status")}
              value={<StatusBadge status={status} />}
            />
            <SummaryCell
              label={t("scoreLabel")}
              value={
                <span
                  className={`text-lg font-bold ${
                    isGraded
                      ? pct >= 80
                        ? "text-[#16A34A]"
                        : pct >= 60
                          ? "text-[#D97706]"
                          : "text-[#DC2626]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {isGraded ? `${totalScored} / ${grandTotal}` : "—"}
                </span>
              }
            />
            <SummaryCell
              label={t("percentage")}
              value={
                <span className="text-lg font-bold text-[var(--color-text-primary)]">
                  {isGraded ? `${pct}%` : "—"}
                </span>
              }
            />
            <SummaryCell
              label={t("submittedAt")}
              value={
                <span className="text-xs text-[var(--color-text-primary)] inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(submission.submittedAt)}
                </span>
              }
            />
          </div>

          {/* Overall comment */}
          {submission.instructorComment && (
            <div className="mt-4 p-3 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#92400E] mb-0.5">
                  {t("instructorComment")}
                </p>
                <p className="text-sm text-[#78350F]">{submission.instructorComment}</p>
              </div>
            </div>
          )}
        </div>

        {/* Submission body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {/* Assignment files (if any) */}
          {submission.submissionFiles && submission.submissionFiles.length > 0 && (
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                {t("uploadedFiles")}
              </p>
              <ul className="space-y-2">
                {submission.submissionFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 p-2 rounded bg-[var(--color-surface-page)] border border-[var(--color-border)]"
                  >
                    <FileText className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)] truncate">
                        {f.fileName}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {(f.fileSize / 1024).toFixed(1)} KB · {f.mimeType}
                      </p>
                    </div>
                    <a
                      href={f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t("download")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-question answers */}
          {submission.answers && submission.answers.length > 0 ? (
            submission.answers.map((ans, idx) => {
              const q = questionMap.get(ans.questionId);
              if (!q) {
                return (
                  <div
                    key={`${ans.questionId}-${idx}`}
                    className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4"
                  >
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("missingQuestion")}
                    </p>
                    <p className="text-sm text-[var(--color-text-primary)] mt-1">
                      {ans.answer}
                    </p>
                  </div>
                );
              }
              return (
                <AnswerCard
                  key={`${ans.questionId}-${idx}`}
                  q={q}
                  ans={ans}
                  index={idx + 1}
                  perQuestionComment={
                    submission.questionComments?.[ans.questionId] ?? null
                  }
                />
              );
            })
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)] py-12 text-center">
              {t("noAnswers")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
        {label}
      </p>
      <div>{value}</div>
    </div>
  );
}

function AnswerCard({
  q,
  ans,
  index,
  perQuestionComment,
}: {
  q: AssessmentQuestion;
  ans: { questionId: string; answer: string; isCorrect: boolean | null; marksAwarded: number | null };
  index: number;
  perQuestionComment: string | null;
}) {
  const t = useTranslations("adminDashboard.submissionDetail");
  const locale = useLocale();
  const questionText =
    locale === "ar" && q.questionTextAr ? q.questionTextAr : q.questionText;

  const isObjective = q.type === "mcq" || q.type === "true_false";
  const correct = ans.isCorrect;

  // For MCQ/TF the student stores an option index or text. Try to map.
  const optionAnswer =
    isObjective && q.options
      ? (() => {
          // student answer may be an index or text
          const asIdx = Number(ans.answer);
          if (!isNaN(asIdx) && asIdx >= 0 && asIdx < q.options.length) {
            return q.options[asIdx];
          }
          return q.options.find(
            (o) =>
              o.text === ans.answer ||
              (locale === "ar" && o.textAr === ans.answer),
          );
        })()
      : null;

  return (
    <div
      className={`bg-[var(--color-surface-card)] border rounded-lg p-4 ${
        correct === true
          ? "border-[#BBF7D0]"
          : correct === false
            ? "border-[#FCA5A5]"
            : "border-[var(--color-border)]"
      }`}
    >
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
              {ans.marksAwarded ?? "—"} / {q.marks} {t("marks")}
            </span>
            {correct === true && (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            )}
            {correct === false && (
              <XCircle className="w-4 h-4 text-[#DC2626]" />
            )}
            {correct === null && (
              <Circle className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </div>
        </div>
      </div>

      {/* Student answer */}
      <div className="ms-9 space-y-2">
        {isObjective && optionAnswer ? (
          <div
            className={`text-xs px-2 py-1.5 rounded inline-flex items-center gap-2 ${
              optionAnswer.isCorrect
                ? "bg-[#DCFCE7] text-[#166534]"
                : "bg-[#FEE2E2] text-[#991B1B]"
            }`}
          >
            <span className="font-semibold">{t("studentChose")}:</span>
            <span>{locale === "ar" && optionAnswer.textAr ? optionAnswer.textAr : optionAnswer.text}</span>
          </div>
        ) : (
          <div className="text-xs p-3 rounded bg-[var(--color-surface-page)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
            <p className="font-semibold text-[var(--color-text-secondary)] mb-1">
              {t("studentAnswer")}
            </p>
            <p className="whitespace-pre-wrap">{ans.answer || t("emptyAnswer")}</p>
          </div>
        )}

        {/* Correct answer / model answer */}
        {isObjective && q.options && (
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t("correctAnswer")}:{" "}
            <span className="font-medium text-[#16A34A] normal-case">
              {q.options
                .filter((o) => o.isCorrect)
                .map((o) => (locale === "ar" && o.textAr ? o.textAr : o.text))
                .join(", ") || "—"}
            </span>
          </div>
        )}
        {!isObjective && q.correctAnswer && (
          <div className="text-xs p-2 rounded bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
            <span className="font-medium">{t("modelAnswer")}: </span>
            {q.correctAnswer}
          </div>
        )}

        {/* Per-question instructor comment */}
        {perQuestionComment && (
          <div className="text-xs p-2 rounded bg-[#FFFBEB] border border-[#FCD34D] text-[#78350F]">
            <MessageSquare className="w-3 h-3 inline-block me-1" />
            <span className="font-semibold">{t("instructorComment")}: </span>
            {perQuestionComment}
          </div>
        )}
      </div>
    </div>
  );
}
