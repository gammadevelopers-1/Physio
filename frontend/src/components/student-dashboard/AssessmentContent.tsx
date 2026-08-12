"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Send,
  XCircle,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
  Check,
  Upload,
  Paperclip,
  X,
  Bold,
  Italic,
  Underline,
  List,
  FileText,
  Download,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";
import { pickLocaleTitle } from "@/lib/locale-title";
import type {
  StudentAssessment,
  AssessmentResult,
  SubmissionReview,
} from "@/types/student-dashboard";

const AssessmentContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const tToasts = useTranslations("toasts");
  const isRTL = locale === "ar";
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const assessmentId = params.assessmentId as string;
  const openReview = searchParams.get("review") === "true";

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Core state
  const [assessment, setAssessment] = useState<StudentAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // ISO timestamp when this attempt started — used to resume the timer correctly
  // after refresh/close. Set from the existing draft, otherwise initialized when
  // the student clicks "Start".
  const [draftStartedAt, setDraftStartedAt] = useState<string | null>(null);

  // Step 1: Start screen
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  // Step 2: Flagging
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Step 4: Breakdown
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Step 6: Auto-save
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 8: Review mode
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState<SubmissionReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

  // Assignment-specific state
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [assignmentUploading, setAssignmentUploading] = useState(false);
  const [assignmentUploadPct, setAssignmentUploadPct] = useState(0);
  const [assignmentSubmitted, setAssignmentSubmitted] = useState(false);

  // Ref for auto-save interval
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Load assessment
  useEffect(() => {
    const loadAssessment = async () => {
      try {
        const data = await studentApi.getAssessment(assessmentId);
        setAssessment(data);
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

  // Load saved progress when assessment is loaded
  useEffect(() => {
    if (!assessment || assessmentStarted) return;
    const loadProgress = async () => {
      try {
        const progress = await studentApi.getAssessmentProgress(assessmentId);
        if (progress && progress.answers) {
          const savedAnswers: Record<string, string> = {};
          progress.answers.forEach((a) => {
            savedAnswers[a.questionId] = a.answer;
          });
          setAnswers(savedAnswers);
          if (progress.startedAt) {
            setDraftStartedAt(progress.startedAt);
            // Auto-resume so the student doesn't see the Start screen again
            // (otherwise refreshing would reset the timer to full duration)
            setAssessmentStarted(true);
          }
        }
      } catch {
        // ignore — no saved progress
      }
    };
    loadProgress();
  }, [assessment, assessmentId, assessmentStarted]);

  // Start the timer when the assessment starts. Resume from draftStartedAt
  // (if we recovered an in-progress draft) or from "now" for a fresh attempt.
  useEffect(() => {
    if (!assessmentStarted || !assessment?.durationMinutes || timeLeft !== null) return;
    const totalSeconds = assessment.durationMinutes * 60;
    if (draftStartedAt) {
      const elapsedSec = Math.floor((Date.now() - new Date(draftStartedAt).getTime()) / 1000);
      setTimeLeft(Math.max(0, totalSeconds - elapsedSec));
    } else {
      setDraftStartedAt(new Date().toISOString());
      setTimeLeft(totalSeconds);
    }
  }, [assessmentStarted, assessment, timeLeft, draftStartedAt]);

  // Timer countdown
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

  // Auto-submit when time runs out — only if time limit is enforced
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !result &&
      !submitting &&
      assessment &&
      assessment.timeLimitEnforced !== false
    ) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!assessmentStarted || result || !assessment) return;

    const interval = setInterval(async () => {
      const currentAnswers = answersRef.current;
      const answerArray = Object.entries(currentAnswers).map(
        ([questionId, answer]) => ({ questionId, answer })
      );
      if (answerArray.length > 0) {
        setSaving(true);
        try {
          await studentApi.saveAssessmentProgress(assessmentId, answerArray);
          setLastSaved(new Date());
        } catch {
          // silently fail
        } finally {
          setSaving(false);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [assessmentStarted, result, assessment, assessmentId]);

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

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleMultiSelectToggle = (questionId: string, optionText: string) => {
    setAnswers((prev) => {
      let selected: string[] = [];
      try {
        selected = JSON.parse(prev[questionId] || "[]");
      } catch {
        selected = [];
      }

      if (selected.includes(optionText)) {
        selected = selected.filter((s) => s !== optionText);
      } else {
        selected = [...selected, optionText];
      }

      return {
        ...prev,
        [questionId]: JSON.stringify(selected),
      };
    });
  };

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
    setCurrentQuestion(0);
    setAssessmentStarted(false);
    setTimeLeft(null);
    setFlagged(new Set());
    setShowBreakdown(false);
    setReviewMode(false);
    setReviewData(null);
  };

  const handleLoadReview = async () => {
    if (!result) return;
    setReviewLoading(true);
    try {
      const data = await studentApi.getSubmissionReview(result.submissionId);
      setReviewData(data);
      setReviewMode(true);
      setReviewAttemptId(result.submissionId);
      setCurrentQuestion(0);
    } catch {
      // silently fail
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSwitchAttemptReview = async (submissionId: string) => {
    if (submissionId === reviewAttemptId) return;
    setReviewLoading(true);
    try {
      const data = await studentApi.getSubmissionReview(submissionId);
      setReviewData(data);
      setReviewAttemptId(submissionId);
      setCurrentQuestion(0);
    } catch {
      toast.error(t("assessment.reviewLoadError") || "Could not load this attempt's review");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleAssignmentSubmit = useCallback(async () => {
    if (!assessment || assignmentUploading || assignmentFiles.length === 0) return;
    setAssignmentUploading(true);
    setAssignmentUploadPct(0);
    try {
      const res = await studentApi.submitAssignment(assessmentId, assignmentFiles, setAssignmentUploadPct);
      setResult({
        submissionId: res.submissionId,
        score: 0,
        totalMarks: assessment.totalMarks,
        percentage: 0,
        status: res.status || "submitted",
        passed: false,
        hasManualGrading: true,
      });
      setAssignmentSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit assignment";
      toast.error(msg);
    } finally {
      setAssignmentUploading(false);
    }
  }, [assessment, assignmentUploading, assignmentFiles, assessmentId]);

  // Auto-trigger review mode when navigating with ?review=true
  // (e.g. clicking "Review" from the course card). Uses the latest graded
  // submission's ID to load the review, without needing a fresh result.
  useEffect(() => {
    if (
      openReview &&
      assessment &&
      !reviewMode &&
      !reviewData &&
      assessment.latestSubmission?.status === "graded" &&
      assessment.latestSubmission.id
    ) {
      setReviewLoading(true);
      setReviewAttemptId(assessment.latestSubmission.id);
      studentApi
        .getSubmissionReview(assessment.latestSubmission.id)
        .then((data) => {
          setReviewData(data);
          setReviewMode(true);
        })
        .catch(() => {})
        .finally(() => setReviewLoading(false));
    }
  }, [openReview, assessment, reviewMode, reviewData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      quiz: {
        label: t("assessment.quizType"),
        color: "bg-blue-50 text-blue-700",
      },
      exam: {
        label: t("assessment.examType"),
        color: "bg-purple-50 text-purple-700",
      },
      assignment: {
        label: t("assessment.assignmentType"),
        color: "bg-amber-50 text-amber-700",
      },
    };
    return map[type] || { label: type, color: "bg-[var(--color-surface-page)] text-[var(--color-text-primary)]" };
  };

  // ─── Loading / Error ────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-text-secondary)] animate-spin" />
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {t("courseDetail.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  // When navigating with ?review=true, show a spinner while review data loads
  // instead of flashing the start/attempt screen.
  if (openReview && !reviewMode && !reviewData) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-text-secondary)] animate-spin" />
      </div>
    );
  }

  // ─── Max Attempts Reached — Show result + review option ───
  // But if canRetake is true (manager granted a retake), skip this and fall
  // through to the start screen so the student can begin the new attempt.
  if (assessment.maxAttemptsReached && !assessment.canRetake && !result && !reviewMode) {
    const sub = assessment.latestSubmission;
    const isGraded = sub?.status === "graded";
    const score = sub?.score ?? 0;
    const pct = assessment.totalMarks > 0 ? (score / assessment.totalMarks) * 100 : 0;
    const passed = pct >= ((assessment.passingMarks / assessment.totalMarks) * 100);

    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-8 max-w-lg w-full text-center">
          {!isGraded ? (
            <Clock className="w-16 h-16 text-[#D4A520] mx-auto mb-4" />
          ) : passed ? (
            <CheckCircle2 className="w-16 h-16 text-[#16A34A] mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-[#DC2626] mx-auto mb-4" />
          )}

          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            {!isGraded
              ? t("assessment.pendingGrading")
              : passed
                ? t("assessment.passed")
                : t("assessment.failed")}
          </h2>

          {isGraded && (
            <div className="bg-[var(--color-surface-page)] rounded-xl p-4 mb-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.score")}</p>
                  <p className="text-lg font-bold text-[var(--color-text-secondary)]">{score}/{assessment.totalMarks}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.percentage")}</p>
                  <p className="text-lg font-bold text-[var(--color-text-secondary)]">{pct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {!isGraded && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("assessment.pendingGradingMessage")}</p>
          )}

          <div className="flex flex-col gap-3 mt-4">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
            >
              {t("assessment.backToCourse")}
            </Link>
            {isGraded && sub?.id && (
              <button
                onClick={() => {
                  setReviewLoading(true);
                  setReviewAttemptId(sub.id);
                  studentApi.getSubmissionReview(sub.id).then((data) => {
                    setReviewData(data);
                    setReviewMode(true);
                  }).catch(() => {}).finally(() => setReviewLoading(false));
                }}
                disabled={reviewLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-[#002D87] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-60"
              >
                {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {t("assessment.reviewAnswers")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Assignment Flow ──────────────────────────────────────

  if (assessment.type === "assignment") {
    const badge = getTypeBadge("assignment");
    const isPastDeadline = assessment.dueDate ? new Date() > new Date(assessment.dueDate) : false;
    const hasExistingSubmission = assessment.attemptsTaken > 0;
    const canSubmit = assessment.canSubmit !== false && !isPastDeadline && !hasExistingSubmission;

    // Assignment Review Mode (after grading)
    if (reviewMode && reviewData) {
      return (
        <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
          <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-4 py-3">
            <div className="max-w-[700px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href={`/${locale}/dashboard/student/courses/${courseId}`}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                >
                  <BackIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </Link>
                <h1 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                  {pickLocaleTitle(assessment.title, assessment.titleAr, locale)} — {t("assessment.reviewAnswers")}
                </h1>
              </div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {reviewData.score}/{reviewData.totalMarks} ({reviewData.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="max-w-[700px] mx-auto px-4 py-6 sm:py-8 space-y-6">
            {/* Instructor Comment */}
            {reviewData.instructorComment && (
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-[#0284C7]" />
                  <h3 className="text-sm font-semibold text-[#0C4A6E]">{t("assessment.instructorComment") || "Instructor Comment"}</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{reviewData.instructorComment}</p>
              </div>
            )}

            {/* Score */}
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.score")}</p>
                  <p className="text-lg font-bold text-[var(--color-text-secondary)]">{reviewData.score}/{reviewData.totalMarks}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.percentage")}</p>
                  <p className="text-lg font-bold text-[var(--color-text-secondary)]">{reviewData.percentage.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.status")}</p>
                  <p className={`text-lg font-bold ${reviewData.percentage >= ((assessment.passingMarks / assessment.totalMarks) * 100) ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {reviewData.percentage >= ((assessment.passingMarks / assessment.totalMarks) * 100) ? t("assessment.passed") : t("assessment.failed")}
                  </p>
                </div>
              </div>
            </div>

            {/* Submitted Files */}
            {reviewData.submissionFiles && reviewData.submissionFiles.length > 0 && (
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t("assessment.studentFiles") || "Your Submitted Files"}</h3>
                <div className="space-y-2">
                  {reviewData.submissionFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                        <span className="text-sm text-[var(--color-text-secondary)] truncate">{f.fileName}</span>
                        <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{(f.fileSize / 1024).toFixed(0)} KB</span>
                      </div>
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
            >
              {t("assessment.backToCourse")}
            </Link>
          </div>
        </div>
      );
    }

    // Assignment Result View
    if (result) {
      const isPendingGrading = result.status === "submitted";

      return (
        <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-8 max-w-lg w-full text-center">
            {isPendingGrading ? (
              <Clock className="w-16 h-16 text-[#D4A520] mx-auto mb-4" />
            ) : result.passed ? (
              <CheckCircle2 className="w-16 h-16 text-[#16A34A] mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-[#DC2626] mx-auto mb-4" />
            )}

            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              {isPendingGrading ? (t("assessment.assignmentSubmitted") || "Assignment Submitted") : result.passed ? t("assessment.passed") : t("assessment.failed")}
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              {isPendingGrading ? (t("assessment.pendingGradingMessage")) : t("assessment.resultMessage")}
            </p>

            {!isPendingGrading && (
              <div className="bg-[var(--color-surface-page)] rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.score")}</p>
                    <p className="text-lg font-bold text-[var(--color-text-secondary)]">{result.score}/{result.totalMarks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("assessment.percentage")}</p>
                    <p className="text-lg font-bold text-[var(--color-text-secondary)]">{result.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link
                href={`/${locale}/dashboard/student/courses/${courseId}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
              >
                {t("assessment.backToCourse")}
              </Link>
              {result.status === "graded" && (
                <button
                  onClick={handleLoadReview}
                  disabled={reviewLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-[#002D87] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-60"
                >
                  {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {t("assessment.reviewAnswers")}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Assignment Start / Submission Screen
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[700px] mx-auto px-4 py-6 sm:py-8">
          {/* Back link */}
          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
          >
            <BackIcon className="w-4 h-4" />
            {t("assessment.backToCourse")}
          </Link>

          {/* Title + Badge */}
          <div className="mb-6">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-3 ${badge.color}`}>
              {badge.label}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{pickLocaleTitle(assessment.title, assessment.titleAr, locale)}</h1>
          </div>

          {/* Deadline Banner */}
          {isPastDeadline && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" />
              <p className="text-sm font-medium text-[#DC2626]">{t("assessment.deadlinePassed") || "Deadline has passed"}</p>
            </div>
          )}

          {/* Already Submitted Banner */}
          {hasExistingSubmission && !result && (
            <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0" />
              <p className="text-sm font-medium text-[#1E3A8A]">{t("assessment.assignmentSubmitted") || "Assignment already submitted"}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{t("assessment.totalMarks")}</p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">{assessment.totalMarks}</p>
            </div>
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{t("assessment.passingMarks")}</p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">{assessment.passingMarks}</p>
            </div>
            {assessment.dueDate && (
              <div className="col-span-2 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{t("assessment.deadline") || "Deadline"}</p>
                <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                  {new Date(assessment.dueDate).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { timeZone: "Asia/Riyadh" })} (KSA)
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          {assessment.instructions && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5 mb-6">
              <h3 className="font-medium text-sm text-[#0C4A6E] mb-2">{t("assessment.assignmentInstructions") || "Instructions"}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">{assessment.instructions}</p>
            </div>
          )}

          {/* Assignment Files (instructor-provided) */}
          {assessment.assignmentFiles && assessment.assignmentFiles.length > 0 && (
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 mb-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t("assessment.assignmentFiles") || "Assignment Files"}</h3>
              <div className="space-y-2">
                {assessment.assignmentFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                      <span className="text-sm text-[var(--color-text-secondary)] truncate">{f.fileName}</span>
                      <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{(f.fileSize / 1024).toFixed(0)} KB</span>
                    </div>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                      {t("assessment.downloadFile") || "Download"}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student File Upload */}
          {canSubmit && (
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 mb-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t("assessment.uploadFiles") || "Upload Your Files"}</h3>

              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors mb-3">
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-[var(--color-text-secondary)] mb-1" />
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("assessment.dragDropFiles") || "Click to select files"}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">PDF, DOC, DOCX, JPG, PNG, GIF, MP4, MOV ({t("assessment.maxFiles") || "Max 10 files, 100 MB each"})</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov"
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files!);
                      const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
                      const MAX_FILES = 10;
                      const oversized = newFiles.filter((f) => f.size > MAX_SIZE);
                      if (oversized.length > 0) {
                        toast.error(tToasts("fileExceedsLimit", { name: oversized[0].name }));
                        e.target.value = "";
                        return;
                      }
                      setAssignmentFiles((prev) => {
                        const combined = [...prev, ...newFiles];
                        if (combined.length > MAX_FILES) {
                          toast.error(tToasts("maxFilesAllowed", { max: MAX_FILES }));
                          return prev;
                        }
                        return combined;
                      });
                    }
                    e.target.value = "";
                  }}
                  disabled={assignmentUploading}
                />
              </label>

              {/* Selected files list */}
              {assignmentFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  {assignmentFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Paperclip className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
                        <span className="text-sm text-[var(--color-text-secondary)] truncate">{f.name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button
                        onClick={() => setAssignmentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="p-1 text-[var(--color-text-secondary)] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload progress */}
              {assignmentUploading && (
                <div className="w-full bg-[var(--color-border)] rounded-full h-2 mb-4">
                  <div className="bg-[var(--color-primary)] h-2 rounded-full transition-all" style={{ width: `${assignmentUploadPct}%` }} />
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleAssignmentSubmit}
                disabled={assignmentFiles.length === 0 || assignmentUploading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignmentUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("assessment.submitting") || "Submitting..."}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("assessment.submitAssignment") || "Submit Assignment"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* No files uploaded notice when can't submit */}
          {!canSubmit && !hasExistingSubmission && (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t("assessment.noFilesUploaded") || "Submissions are closed"}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Review Mode ────────────────────────────────────────

  if (reviewMode && reviewData) {
    const reviewQuestion = reviewData.questions[currentQuestion];
    const studentAnswer = reviewData.answers.find(
      (a) => a.questionId === reviewQuestion?.id
    );
    const reviewableAttempts = (assessment.allAttempts || []).filter(
      (a) => a.status === "graded"
    );
    const currentAttempt = reviewableAttempts.find(
      (a) => a.id === reviewAttemptId
    );

    return (
      <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
        {/* Top Bar */}
        <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="max-w-[900px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/dashboard/student/courses/${courseId}`}
                className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                <BackIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </Link>
              <h1 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                {pickLocaleTitle(assessment.title, assessment.titleAr, locale)} — {t("assessment.reviewAnswers")}
              </h1>
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {reviewData.score}/{reviewData.totalMarks} (
              {reviewData.percentage.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Attempt Selector */}
        {reviewableAttempts.length > 1 && (
          <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-4 py-2">
            <div className="max-w-[900px] mx-auto flex items-center gap-2 overflow-x-auto">
              {reviewableAttempts.map((attempt) => {
                const isActive = attempt.id === reviewAttemptId;
                const pct = attempt.percentage != null ? attempt.percentage.toFixed(1) : "—";
                return (
                  <button
                    key={attempt.id}
                    onClick={() => handleSwitchAttemptReview(attempt.id)}
                    disabled={reviewLoading}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                      isActive
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    {attempt.attemptNumber === 1
                      ? (t("assessment.originalAttempt") || "Original")
                      : (t("assessment.retakeNum", { n: attempt.attemptNumber - 1 }) || `Retake ${attempt.attemptNumber - 1}`)}
                    <span className={isActive ? "text-white/80" : "text-[var(--color-text-secondary)]"}>
                      {attempt.score ?? "—"}/{attempt.totalMarks ?? assessment.totalMarks} ({pct}%)
                    </span>
                    {attempt.isEffective && (
                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                        isActive ? "bg-[var(--color-surface-card)]/20 text-white" : "bg-[#DCFCE7] text-[#15803D]"
                      }`}>
                        {t("assessment.effective") || "Effective"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-[900px] mx-auto px-4 py-6 sm:py-8 relative">
          {/* Loading overlay when switching attempts */}
          {reviewLoading && (
            <div className="absolute inset-0 bg-[var(--color-surface-card)]/60 flex items-center justify-center z-10 rounded-xl">
              <Loader2 className="w-6 h-6 text-[var(--color-text-secondary)] animate-spin" />
            </div>
          )}
          {/* Instructor Overall Comment */}
          {reviewData.instructorComment && currentQuestion === 0 && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-[#0284C7]" />
                <h3 className="text-sm font-semibold text-[#0C4A6E]">{t("assessment.instructorComment") || "Instructor Comment"}</h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{reviewData.instructorComment}</p>
            </div>
          )}

          {reviewQuestion && (
            <>
              <div className="mb-6">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                  {t("assessment.question")} {currentQuestion + 1} /{" "}
                  {reviewData.questions.length}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {reviewQuestion.marks}{" "}
                    {reviewQuestion.marks === 1
                      ? t("assessment.mark")
                      : t("assessment.marks")}
                  </p>
                  {studentAnswer && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        studentAnswer.isCorrect === true
                          ? "bg-green-50 text-[#16A34A]"
                          : studentAnswer.isCorrect === false
                            ? "bg-red-50 text-[#DC2626]"
                            : "bg-yellow-50 text-[#D4A520]"
                      }`}
                    >
                      {studentAnswer.marksAwarded ?? 0}/{reviewQuestion.marks}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
                <p className="text-base sm:text-lg font-medium text-[var(--color-text-secondary)] mb-6">
                  {isRTL && reviewQuestion.questionTextAr
                    ? reviewQuestion.questionTextAr
                    : reviewQuestion.questionText}
                </p>

                {(reviewQuestion.type === "mcq" ||
                  reviewQuestion.type === "true_false") &&
                  reviewQuestion.options && (
                    <div className="space-y-3">
                      {reviewQuestion.options.map((option, index) => {
                        const optionText =
                          isRTL && option.textAr ? option.textAr : option.text;
                        const isStudentAnswer =
                          studentAnswer?.answer === option.text ||
                          (() => {
                            try {
                              const selected = JSON.parse(
                                studentAnswer?.answer || "[]"
                              );
                              return (
                                Array.isArray(selected) &&
                                selected.includes(option.text)
                              );
                            } catch {
                              return false;
                            }
                          })();
                        const isCorrectOption = option.isCorrect;

                        return (
                          <div
                            key={index}
                            className={`w-full flex items-center gap-3 p-4 rounded-lg border ${
                              isCorrectOption
                                ? "border-[#16A34A] bg-green-50"
                                : isStudentAnswer
                                  ? "border-[#DC2626] bg-red-50"
                                  : "border-[var(--color-border)]"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isCorrectOption
                                  ? "border-[#16A34A] bg-[#16A34A]"
                                  : isStudentAnswer
                                    ? "border-[#DC2626] bg-[#DC2626]"
                                    : "border-[var(--color-border)]"
                              }`}
                            >
                              {isCorrectOption && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                              {isStudentAnswer && !isCorrectOption && (
                                <XCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {optionText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {(reviewQuestion.type === "short_answer" ||
                  reviewQuestion.type === "essay") && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("assessment.yourAnswer")}
                      </p>
                      <div className="p-3 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                        {studentAnswer?.answer || "—"}
                      </div>
                    </div>
                    {reviewQuestion.correctAnswer && (
                      <div>
                        <p className="text-xs font-medium text-[#16A34A] mb-1">
                          {t("assessment.correctAnswer")}
                        </p>
                        <div className="p-3 bg-green-50 rounded-lg border border-[#16A34A] text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                          {reviewQuestion.correctAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Per-question instructor comment */}
              {reviewData.questionComments && reviewData.questionComments[reviewQuestion.id] && (
                <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span className="text-xs font-semibold text-[#9A3412]">{t("assessment.questionComment") || "Instructor Feedback"}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{reviewData.questionComments[reviewQuestion.id]}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-40"
                >
                  {isRTL ? (
                    <ArrowRight className="w-4 h-4" />
                  ) : (
                    <ArrowLeft className="w-4 h-4" />
                  )}
                  {t("assessment.previous")}
                </button>

                {currentQuestion < reviewData.questions.length - 1 && (
                  <button
                    onClick={() =>
                      setCurrentQuestion((p) =>
                        Math.min(reviewData.questions.length - 1, p + 1)
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-text-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-text-primary)] transition-colors"
                  >
                    {t("assessment.next")}
                    {isRTL ? (
                      <ArrowLeft className="w-4 h-4" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Question dots */}
              <div className="flex flex-wrap gap-2 justify-center mt-8">
                {reviewData.questions.map((q, index) => {
                  const ans = reviewData.answers.find(
                    (a) => a.questionId === q.id
                  );
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestion(index)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        index === currentQuestion
                          ? "bg-[var(--color-primary)] text-white"
                          : ans?.isCorrect === true
                            ? "bg-[#16A34A] text-white"
                            : ans?.isCorrect === false
                              ? "bg-[#DC2626] text-white"
                              : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Results View ───────────────────────────────────────

  if (result) {
    const isPendingGrading = result.status === "submitted";

    return (
      <div
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-8 max-w-lg w-full text-center">
          {isPendingGrading ? (
            <Clock className="w-16 h-16 text-[#D4A520] mx-auto mb-4" />
          ) : result.passed ? (
            <CheckCircle2 className="w-16 h-16 text-[#16A34A] mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-[#DC2626] mx-auto mb-4" />
          )}

          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            {isPendingGrading
              ? t("assessment.submittedTitle")
              : result.passed
                ? t("assessment.passed")
                : t("assessment.failed")}
          </h2>

          <p className="text-[var(--color-text-secondary)] mb-6">
            {isPendingGrading
              ? t("assessment.pendingGradingMessage")
              : t("assessment.resultMessage")}
          </p>

          {/* Score Grid */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                  {isPendingGrading
                    ? t("assessment.autoGradedScore")
                    : t("assessment.score")}
                </p>
                <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                  {result.score}/{result.totalMarks}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                  {t("assessment.percentage")}
                </p>
                <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                  {result.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Per-question breakdown */}
          {result.gradedAnswers && result.gradedAnswers.length > 0 && (
            <div className="mb-6 text-start">
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline mx-auto mb-3"
              >
                {showBreakdown
                  ? t("assessment.hideBreakdown")
                  : t("assessment.showBreakdown")}
                {showBreakdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showBreakdown && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {result.gradedAnswers.map((ga, i) => (
                    <div
                      key={ga.questionId}
                      className="flex items-center gap-3 p-3 bg-[var(--color-surface-page)] rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        {ga.isCorrect === true ? (
                          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                        ) : ga.isCorrect === false ? (
                          <XCircle className="w-5 h-5 text-[#DC2626]" />
                        ) : (
                          <Clock className="w-5 h-5 text-[#D4A520]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-text-secondary)] truncate">
                          Q{i + 1}. {ga.questionText}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {ga.isCorrect === null
                            ? t("assessment.pendingReview")
                            : ga.isCorrect
                              ? t("assessment.correct")
                              : t("assessment.incorrect")}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-secondary)] flex-shrink-0">
                        {ga.marksAwarded ?? "—"}/{ga.questionMarks}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past attempts history — visible if the student has multiple attempts */}
          {assessment.allAttempts && assessment.allAttempts.length > 0 && (
            <div className="mb-6 text-start">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
                {t("assessment.attemptsHistory") || "Attempts History"}
                {assessment.retakeScorePolicy && (
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded">
                    {assessment.retakeScorePolicy === "average"
                      ? (t("assessment.policyAverage") || "Average of all attempts")
                      : assessment.retakeScorePolicy === "latest"
                        ? (t("assessment.policyLatest") || "Latest attempt counts")
                        : (t("assessment.policyHighest") || "Highest score counts")}
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {assessment.allAttempts.map((attempt) => {
                  const passed = attempt.score !== null && assessment.passingMarks > 0 && attempt.score >= assessment.passingMarks;
                  const isNotSubmitted = attempt.submittedAt === null && attempt.status === "graded";
                  return (
                    <div
                      key={attempt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        attempt.isEffective ? "border-[#7C3AED] bg-[#F5F3FF]" : "border-[var(--color-border)] bg-[var(--color-surface-page)]"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          attempt.attemptNumber === 1 ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]" : "bg-[#F3E8FF] text-[#7C3AED]"
                        }`}>
                          {attempt.attemptNumber}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                          {attempt.attemptNumber === 1
                            ? (t("assessment.originalAttempt") || "Original attempt")
                            : (t("assessment.retakeNum", { n: attempt.attemptNumber - 1 }) || `Retake ${attempt.attemptNumber - 1}`)}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {isNotSubmitted
                            ? (t("assessment.notSubmittedLabel") || "Not submitted")
                            : attempt.submittedAt
                              ? new Date(attempt.submittedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
                                  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {attempt.score !== null ? (
                          <span className={`text-sm font-semibold ${passed ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                            {attempt.score}/{attempt.totalMarks}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                        )}
                        {attempt.isEffective && (
                          <span className="text-[10px] font-semibold text-[#7C3AED] bg-[#EDE9FE] px-1.5 py-0.5 rounded">
                            {t("assessment.effective") || "Effective"}
                          </span>
                        )}
                        {assessment.retakeScorePolicy === "average" && attempt.score !== null && (
                          <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-1.5 py-0.5 rounded">
                            {t("assessment.includedInAvg") || "In avg"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
            >
              {t("assessment.backToCourse")}
            </Link>

            {/* Retake button — prominent, above review */}
            {assessment.canRetake && (
              <button
                onClick={handleRetake}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t("assessment.startRetake") || "Start Retake"}
              </button>
            )}

            {/* Review button (only for graded) */}
            {result.status === "graded" && (
              <button
                onClick={handleLoadReview}
                disabled={reviewLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-[#002D87] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-60"
              >
                {reviewLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {t("assessment.reviewAnswers")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Start Screen ───────────────────────────────────────

  if (!assessmentStarted) {
    const badge = getTypeBadge(assessment.type);

    return (
      <div
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6 sm:p-8 max-w-lg w-full">
          {/* Back link */}
          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
          >
            <BackIcon className="w-4 h-4" />
            {t("assessment.backToCourse")}
          </Link>

          {/* Title + Badge */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}
              >
                {badge.label}
              </span>
              {assessment.isRetakeAttempt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F3E8FF] text-[#7C3AED]">
                  {t("assessment.retakeAttempt", { number: assessment.currentAttemptNumber ?? 2 }) ||
                    `Attempt ${assessment.currentAttemptNumber ?? 2} (Retake)`}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
              {pickLocaleTitle(assessment.title, assessment.titleAr, locale)}
            </h1>
            {assessment.isRetakeAttempt && (
              <p className="mt-2 text-sm text-[#6B21A8]">
                {t("assessment.retakeAttemptDesc") ||
                  "Your course manager has granted you another attempt at this assessment."}
              </p>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-surface-page)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                {t("assessment.totalMarks")}
              </p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                {assessment.totalMarks}
              </p>
            </div>
            <div className="bg-[var(--color-surface-page)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                {t("assessment.passingMarks")}
              </p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                {assessment.passingMarks}
              </p>
            </div>
            <div className="bg-[var(--color-surface-page)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                {t("assessment.questionsCount")}
              </p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                {assessment.questions.length}
              </p>
            </div>
            <div className="bg-[var(--color-surface-page)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                {t("assessment.timeLimit")}
              </p>
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                {assessment.durationMinutes
                  ? `${assessment.durationMinutes} ${t("assessment.minutes")}`
                  : t("assessment.noTimeLimit")}
              </p>
            </div>
          </div>

          {/* Attempts */}
          <div className="bg-[var(--color-surface-page)] rounded-lg p-3 mb-6">
            <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
              {t("assessment.attemptsUsed")}
            </p>
            <p className="text-base font-semibold text-[var(--color-text-secondary)]">
              {assessment.attemptsTaken} /{" "}
              {assessment.attemptsAllowed ?? t("assessment.unlimited")}
            </p>
          </div>

          {/* Instructions */}
          {assessment.instructions && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-4 mb-6">
              <h3 className="font-medium text-sm text-[#0C4A6E] mb-2">
                {t("assessment.instructions")}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {assessment.instructions}
              </p>
            </div>
          )}

          {/* Timer warning */}
          {assessment.durationMinutes && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
              <AlertCircle className="w-4 h-4 text-[#D4A520] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#92400E]">
                {t("assessment.timerWarning")}
              </p>
            </div>
          )}

          {/* Saved progress notice */}
          {Object.keys(answers).length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#1E3A8A]">
                {t("assessment.savedProgressNotice", {
                  count: Object.keys(answers).length,
                })}
              </p>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={() => setAssessmentStarted(true)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("assessment.startAssessment")}
          </button>
        </div>
      </div>
    );
  }

  // ─── Assessment Taking UI ──────────────────────────────

  // Guard: if questions array is empty (e.g. stale attempt data), show an
  // error message instead of crashing on undefined property access.
  if (assessment.questions.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-8 max-w-lg w-full text-center">
          <AlertCircle className="w-12 h-12 text-[#D4A520] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
            {t("assessment.noQuestionsAvailable") || "No questions available"}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {t("assessment.noQuestionsDesc") || "This assessment has no questions loaded. Please go back and try again."}
          </p>
          <Link
            href={`/${locale}/dashboard/student/courses/${courseId}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
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

  // Helper: get dot color for question navigation
  const getDotClass = (q: (typeof assessment.questions)[0], index: number) => {
    if (index === currentQuestion) return "bg-[var(--color-primary)] text-white";
    const isAnswered = !!answers[q.id];
    const isFlagged = flagged.has(q.id);

    if (isAnswered && isFlagged) return "bg-[#D4A520] text-white ring-2 ring-[#16A34A]";
    if (isFlagged) return "bg-[#FBBF24] text-[var(--color-text-primary)]";
    if (isAnswered) return "bg-[#16A34A] text-white";
    return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]";
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Bar */}
      <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <BackIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] truncate max-w-[200px] sm:max-w-none">
              {pickLocaleTitle(assessment.title, assessment.titleAr, locale)}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Auto-save indicator */}
            {saving && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t("assessment.saving")}
              </span>
            )}
            {!saving && lastSaved && (
              <span className="text-xs text-[#16A34A] hidden sm:inline">
                {t("assessment.saved")}
              </span>
            )}

            {/* Timer */}
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  assessment?.timeLimitEnforced === false
                    ? "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                    : timeLeft < 60
                      ? "bg-red-50 text-[#DC2626]"
                      : timeLeft < 300
                        ? "bg-yellow-50 text-[#D4A520]"
                        : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                }`}
                title={
                  assessment?.timeLimitEnforced === false
                    ? t("assessment.timerAdvisory") || "Timer is advisory — you can keep going past zero"
                    : undefined
                }
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {formatTime(Math.max(0, timeLeft))}
                </span>
                {assessment?.timeLimitEnforced === false && (
                  <span className="text-[10px] uppercase font-semibold opacity-70">
                    {t("assessment.advisory") || "Advisory"}
                  </span>
                )}
              </div>
            )}

            {/* Progress */}
            <span className="text-xs text-[var(--color-text-secondary)]">
              {answeredCount}/{totalQuestions}
            </span>

            {/* Flagged count */}
            {flagged.size > 0 && (
              <span className="flex items-center gap-1 text-xs text-[#D4A520]">
                <Flag className="w-3 h-3" />
                {flagged.size}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content — sidebar + question */}
      <div className="max-w-[1100px] mx-auto px-4 py-6 sm:py-8 flex gap-6">
        {/* Question Navigation Sidebar (desktop only) */}
        <div className="hidden lg:block w-[200px] flex-shrink-0">
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sticky top-6">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("assessment.questionsCount")}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {assessment.questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${getDotClass(q, index)}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <div className="w-3 h-3 rounded-full bg-[#16A34A]" />
                {t("assessment.correct")}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <div className="w-3 h-3 rounded-full bg-[#FBBF24]" />
                {t("assessment.flagged")}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <div className="w-3 h-3 rounded-full bg-[var(--color-border-subtle)]" />
                {t("assessment.unanswered")}
              </div>
            </div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 min-w-0">
          {/* Question Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                {t("assessment.question")} {currentQuestion + 1} /{" "}
                {totalQuestions}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {question.marks}{" "}
                {question.marks === 1
                  ? t("assessment.mark")
                  : t("assessment.marks")}
                {question.isMultiSelect && (
                  <span className="ml-2 text-[var(--color-primary)]">
                    ({t("assessment.selectMultiple")})
                  </span>
                )}
              </p>
            </div>

            {/* Flag button */}
            <button
              onClick={() => toggleFlag(question.id)}
              className={`p-2 rounded-lg transition-colors ${
                flagged.has(question.id)
                  ? "text-[#D4A520] bg-yellow-50"
                  : "text-[var(--color-text-secondary)] hover:text-[#D4A520] hover:bg-yellow-50"
              }`}
              title={
                flagged.has(question.id)
                  ? t("assessment.unflagQuestion")
                  : t("assessment.flagQuestion")
              }
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>

          {/* Question Content */}
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <p className="text-base sm:text-lg font-medium text-[var(--color-text-secondary)] mb-6">
              {isRTL && question.questionTextAr
                ? question.questionTextAr
                : question.questionText}
            </p>

            {/* MCQ Single Select */}
            {question.type === "mcq" && !question.isMultiSelect && (
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
                          ? "border-[#002D87] bg-[var(--color-border-subtle)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "border-[#002D87] bg-[var(--color-primary)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 bg-[var(--color-surface-card)] rounded-full" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isSelected
                            ? "text-[var(--color-primary)] font-medium"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* MCQ Multiple Select */}
            {question.type === "mcq" && question.isMultiSelect && (
              <div className="space-y-3">
                {question.options.map((option, index) => {
                  const optionText =
                    isRTL && option.textAr ? option.textAr : option.text;
                  let selected: string[] = [];
                  try {
                    selected = JSON.parse(answers[question.id] || "[]");
                  } catch {
                    selected = [];
                  }
                  const isSelected = selected.includes(option.text);

                  return (
                    <button
                      key={index}
                      onClick={() =>
                        handleMultiSelectToggle(question.id, option.text)
                      }
                      className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-start ${
                        isSelected
                          ? "border-[#002D87] bg-[var(--color-border-subtle)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "border-[#002D87] bg-[var(--color-primary)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isSelected
                            ? "text-[var(--color-primary)] font-medium"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* True/False */}
            {question.type === "true_false" && (
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
                          ? "border-[#002D87] bg-[var(--color-border-subtle)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "border-[#002D87] bg-[var(--color-primary)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 bg-[var(--color-surface-card)] rounded-full" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isSelected
                            ? "text-[var(--color-primary)] font-medium"
                            : "text-[var(--color-text-secondary)]"
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
              <div>
                <input
                  type="text"
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value,
                    }))
                  }
                  maxLength={500}
                  placeholder={t("assessment.typeAnswer")}
                  className="w-full px-4 py-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent"
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-end">
                  {(answers[question.id] || "").length}/500
                </p>
              </div>
            )}

            {/* Essay with formatting toolbar */}
            {question.type === "essay" && (
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#002D87] focus-within:border-transparent">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => document.execCommand("bold")}
                    className="p-1.5 rounded hover:bg-[var(--color-border)] transition-colors"
                    title={t("assessment.bold")}
                  >
                    <Bold className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => document.execCommand("italic")}
                    className="p-1.5 rounded hover:bg-[var(--color-border)] transition-colors"
                    title={t("assessment.italic")}
                  >
                    <Italic className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => document.execCommand("underline")}
                    className="p-1.5 rounded hover:bg-[var(--color-border)] transition-colors"
                    title={t("assessment.underline")}
                  >
                    <Underline className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                  <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
                  <button
                    type="button"
                    onClick={() => document.execCommand("insertUnorderedList")}
                    className="p-1.5 rounded hover:bg-[var(--color-border)] transition-colors"
                    title={t("assessment.bulletList")}
                  >
                    <List className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                </div>
                {/* Editable area */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="px-4 py-3 min-h-[180px] text-sm text-[var(--color-text-primary)] focus:outline-none"
                  dangerouslySetInnerHTML={{
                    __html: answers[question.id] || "",
                  }}
                  onInput={(e) => {
                    const html = (e.target as HTMLDivElement).innerHTML;
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: html,
                    }));
                  }}
                />
              </div>
            )}

            {/* File Upload */}
            {question.type === "file_upload" && (
              <div>
                {answers[question.id] ? (
                  <div className="flex items-center gap-3 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-page)]">
                    <Paperclip className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
                    <span className="text-sm text-[var(--color-text-secondary)] truncate flex-1">
                      {t("assessment.fileUploaded")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => {
                          const updated = { ...prev };
                          delete updated[question.id];
                          return updated;
                        })
                      }
                      className="p-1 hover:bg-[var(--color-border)] rounded flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-border-subtle)] hover:border-[#002D87] transition-colors">
                    <Upload className="w-10 h-10 text-[var(--color-text-secondary)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {t("assessment.uploadFile")}
                    </span>
                    <span className="text-xs text-[var(--color-border)]">
                      PDF, DOCX, JPG, PNG
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) return;
                        try {
                          const result = await studentApi.uploadFile(file);
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: result.url,
                          }));
                        } catch {
                          // Upload failed silently
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Navigation + Submit */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
              disabled={currentQuestion === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-40"
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-text-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-text-primary)] transition-colors"
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
                  className="flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium disabled:opacity-60"
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

          {/* Mobile Question Navigation Dots */}
          <div className="flex flex-wrap gap-2 justify-center mt-8 lg:hidden">
            {assessment.questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${getDotClass(q, index)}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentContent;
