"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Info, FileText, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { taApi } from "@/lib/api";

interface SubmissionAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

interface SubmissionFile {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

interface Submission {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  status: string;
  answers: SubmissionAnswer[] | null;
  submissionFiles: SubmissionFile[] | null;
  instructorComment: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
}

interface TAAssessmentSubmissionsViewProps {
  assessmentId: string;
  onBack: () => void;
}

const TAAssessmentSubmissionsView = ({
  assessmentId,
  onBack,
}: TAAssessmentSubmissionsViewProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taApi.getSessionSubmissions(assessmentId);
      setSubmissions(data as Submission[]);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t("submissions.title")}
        </h1>
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-700">{t("submissions.readOnly")}</p>
      </div>

      {/* Submissions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{t("submissions.noSubmissions")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("submissions.studentName")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("submissions.studentId")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("submissions.submittedAt")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("submissions.score")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const isExpanded = expandedId === submission.id;
                  const hasContent = (submission.answers && submission.answers.length > 0) || (submission.submissionFiles && submission.submissionFiles.length > 0);
                  return (
                    <React.Fragment key={submission.id}>
                      <tr
                        className={`border-b border-[var(--color-border)] last:border-b-0 ${hasContent ? "cursor-pointer hover:bg-[#F9FAFB]" : ""}`}
                        onClick={() => hasContent && setExpandedId(isExpanded ? null : submission.id)}
                      >
                        <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                          <span className="flex items-center gap-2">
                            {hasContent && (
                              isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                            )}
                            {submission.studentFirstName} {submission.studentLastName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                          {submission.studentEmail}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                          {formatDateTime(submission.submittedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {submission.score !== null ? (
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {submission.score}/{submission.totalMarks}
                              {submission.percentage !== null && (
                                <span className="text-[var(--color-text-secondary)] ml-1">
                                  ({submission.percentage}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-secondary)] italic">
                              {t("submissions.scoreHidden")}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 bg-[#F9FAFB]">
                            <div className="space-y-3">
                              {submission.answers && submission.answers.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">{t("submissions.answers")}</p>
                                  <div className="space-y-2">
                                    {submission.answers.map((a, idx) => (
                                      <div key={idx} className="bg-white rounded-lg border border-[var(--color-border)] px-3 py-2">
                                        <p className="text-xs text-[var(--color-text-secondary)] mb-1">Q{idx + 1}</p>
                                        <p className="text-sm text-[var(--color-text-primary)]">{a.answer || "—"}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {submission.submissionFiles && submission.submissionFiles.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">{t("submissions.files")}</p>
                                  <div className="space-y-1">
                                    {submission.submissionFiles.map((f, idx) => (
                                      <a
                                        key={idx}
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-[#3B82F6] hover:underline"
                                      >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        {f.name}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TAAssessmentSubmissionsView;
