"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Star } from "lucide-react";

const scoreColors: Record<
  number,
  { active: string; inactive: string }
> = {
  1: {
    active: "bg-red-500 text-white",
    inactive: "bg-red-50 text-red-600 hover:bg-red-100",
  },
  2: {
    active: "bg-orange-500 text-white",
    inactive: "bg-orange-50 text-orange-600 hover:bg-orange-100",
  },
  3: {
    active: "bg-yellow-500 text-white",
    inactive: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100",
  },
  4: {
    active: "bg-blue-500 text-white",
    inactive: "bg-blue-50 text-blue-600 hover:bg-blue-100",
  },
  5: {
    active: "bg-green-500 text-white",
    inactive: "bg-green-50 text-green-600 hover:bg-green-100",
  },
};

export default function CsatRatingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.surveyId as string;
  const t = useTranslations("surveys.csat");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [survey, setSurvey] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scoreParam = searchParams.get("score");
    if (scoreParam) {
      const parsed = parseInt(scoreParam, 10);
      if (parsed >= 1 && parsed <= 5) {
        setSelectedScore(parsed);
      }
    }

    const fetchSurvey = async () => {
      try {
        const data = await supportApi.getCsatSurvey(surveyId);
        setSurvey(data);

        // Backend returns `alreadySubmitted` (computed) + `submittedAt`.
        // Treat either as a sign the survey is done.
        if (data.alreadySubmitted || data.submittedAt) {
          setSubmitted(true);
        }
      } catch (err: any) {
        if (err?.response?.status === 410 || err?.message?.includes("expired")) {
          setError("expired");
        } else {
          setError("not_found");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurvey();
  }, [surveyId, searchParams]);

  const handleSubmit = async () => {
    if (!selectedScore) return;
    setIsSubmitting(true);
    try {
      await supportApi.submitCsat(surveyId, {
        score: selectedScore,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      toast.success(t("thankYouToast"));
    } catch (err: any) {
      toast.error(err?.message || t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mx-auto" />
          <p className="text-sm text-[var(--color-text-secondary)] mt-3">
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error === "expired") {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("expiredTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("expiredDescription")}
          </p>
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("notFoundTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("notFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
      >
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("thankYouTitle")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {survey?.alreadySubmitted || survey?.submittedAt
              ? t("alreadySubmittedMessage")
              : t("submittedMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-4"
    >
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 max-w-md w-full text-center">
        <h2 className="text-lg font-bold text-[var(--color-primary)]">
          PhysioGuidance
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] mb-6">
          {t("subtitle")}
        </p>

        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          {t("ratingPrompt")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8">
          {t("ratingSubprompt")}
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              onClick={() => setSelectedScore(score)}
              className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all ${
                selectedScore === score
                  ? scoreColors[score].active
                  : scoreColors[score].inactive
              }`}
            >
              <Star className="w-5 h-5 mb-0.5" />
              {score}
            </button>
          ))}
        </div>

        <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-6 px-2">
          <span>{t("scaleLow")}</span>
          <span>{t("scaleHigh")}</span>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t("commentPlaceholder")}
          className="w-full px-3.5 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm mb-4 resize-none focus:outline-none focus:border-[var(--color-input-focus)]"
        />

        <button
          onClick={handleSubmit}
          disabled={!selectedScore || isSubmitting}
          className="w-full py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("submitting")}
            </span>
          ) : (
            t("submit")
          )}
        </button>
      </div>
    </div>
  );
}
