"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Star, Loader2, X, CheckCircle2 } from "lucide-react";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";

// Per-session dismissal so "Not now" doesn't keep firing the modal
// on every dashboard navigation in the same browser tab. Resets
// on next login (or page reload after sessionStorage clears).
const DISMISS_KEY_PREFIX = "csat-dismissed-";

type PendingCsat = {
  surveyId: string;
  ticketId: string;
  ticketReferenceNumber: string;
  ticketSubject: string;
  resolvedAt: string | null;
  agentName: string | null;
};

export default function CsatPromptModal() {
  const t = useTranslations("supportDashboard.csatPrompt");
  const [queue, setQueue] = useState<PendingCsat[]>([]);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supportApi
      .getPendingCsat()
      .then((rows) => {
        if (cancelled) return;
        const filtered = rows.filter(
          (r) =>
            typeof window === "undefined" ||
            sessionStorage.getItem(DISMISS_KEY_PREFIX + r.surveyId) !== "1",
        );
        setQueue(filtered);
      })
      .catch(() => {
        // Silent — the modal is a nice-to-have, never block dashboard load
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[0];

  const handleDismiss = () => {
    if (!current) return;
    try {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + current.surveyId, "1");
    } catch {
      // private mode / quota — fall through, modal will re-open on next mount
    }
    advance();
  };

  const handleSubmit = async () => {
    if (!current || !selectedScore) return;
    setSubmitting(true);
    try {
      await supportApi.submitCsat(current.surveyId, {
        score: selectedScore,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      toast.success(t("submittedToast"));
      // Brief pause so the user sees the success confirmation
      setTimeout(() => {
        advance();
      }, 1400);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("errorToast");
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const advance = () => {
    setQueue((prev) => prev.slice(1));
    setSelectedScore(null);
    setHoverScore(null);
    setComment("");
    setSubmitting(false);
    setSubmitted(false);
  };

  if (!current) return null;

  const displayScore = hoverScore ?? selectedScore ?? 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csat-prompt-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {t("thanksTitle")}
            </h2>
            <p className="text-sm text-slate-500">{t("thanksBody")}</p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100">
              <div className="min-w-0">
                <h2
                  id="csat-prompt-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {t("title")}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {current.ticketReferenceNumber} · {current.ticketSubject}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={t("dismissAria")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                {current.agentName
                  ? t("bodyWithAgent", { agent: current.agentName })
                  : t("body")}
              </p>

              {/* 5 stars */}
              <div
                className="flex items-center justify-center gap-2 mb-4"
                onMouseLeave={() => setHoverScore(null)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedScore(n)}
                    onMouseEnter={() => setHoverScore(n)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={t("starAria", { n })}
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        n <= displayScore
                          ? "fill-amber-400 text-amber-400"
                          : "fill-transparent text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>

              {selectedScore !== null && (
                <p className="text-xs text-center text-slate-500 mb-3">
                  {t(`scoreLabel.${selectedScore}` as const)}
                </p>
              )}

              <label
                htmlFor="csat-comment"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {t("commentLabel")}
              </label>
              <textarea
                id="csat-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("commentPlaceholder")}
                rows={3}
                maxLength={500}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            <div className="px-6 pb-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={submitting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                {t("notNow")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedScore || submitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
