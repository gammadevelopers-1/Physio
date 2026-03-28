"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const getScoreColor = (n: number) => {
  if (n <= 2) return "red";
  if (n <= 4) return "orange";
  if (n <= 6) return "yellow";
  if (n <= 8) return "blue";
  return "green";
};

const colorMap: Record<string, { active: string; inactive: string }> = {
  red: {
    active: "bg-red-500 text-white",
    inactive: "bg-red-50 text-red-600 hover:bg-red-100",
  },
  orange: {
    active: "bg-orange-500 text-white",
    inactive: "bg-orange-50 text-orange-600 hover:bg-orange-100",
  },
  yellow: {
    active: "bg-yellow-500 text-white",
    inactive: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100",
  },
  blue: {
    active: "bg-blue-500 text-white",
    inactive: "bg-blue-50 text-blue-600 hover:bg-blue-100",
  },
  green: {
    active: "bg-green-500 text-white",
    inactive: "bg-green-50 text-green-600 hover:bg-green-100",
  },
};

export default function NpsRatingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.surveyId as string;

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
      if (parsed >= 0 && parsed <= 10) {
        setSelectedScore(parsed);
      }
    }

    const fetchSurvey = async () => {
      try {
        const data = await supportApi.getNpsSurvey(surveyId);
        setSurvey(data);

        if (data.respondedAt) {
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
    if (selectedScore === null) return;
    setIsSubmitting(true);
    try {
      await supportApi.submitNps(surveyId, {
        score: selectedScore,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#002D87] mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error === "expired") {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Survey Expired
          </h1>
          <p className="text-sm text-gray-500">
            This survey has expired. NPS surveys are valid for 7 days after
            being sent.
          </p>
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Survey Not Found
          </h1>
          <p className="text-sm text-gray-500">
            We couldn&apos;t find this survey. It may have been removed or the
            link is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Thank You for Your Feedback!
          </h1>
          <p className="text-sm text-gray-500">
            {survey?.respondedAt
              ? "You've already submitted your rating. Thank you!"
              : "Your response has been recorded. We appreciate your time."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8 max-w-lg w-full text-center">
        <h2 className="text-lg font-bold text-[#002D87]">PhysioGuidance</h2>
        <p className="text-xs text-gray-400 mb-6">Support Feedback</p>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          How likely would you recommend PhysioGuidance?
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Rate on a scale of 0 to 10
        </p>

        <div className="flex justify-center gap-1.5 sm:gap-2 mb-6">
          {Array.from({ length: 11 }, (_, i) => i).map((score) => {
            const color = getScoreColor(score);
            const colors = colorMap[color];
            return (
              <button
                key={score}
                onClick={() => setSelectedScore(score)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                  selectedScore === score ? colors.active : colors.inactive
                }`}
              >
                {score}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between text-xs text-gray-400 mb-6 px-2">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Optional: Tell us more about your experience..."
          className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-sm mb-4 resize-none focus:outline-none focus:border-[#002D87]"
        />

        <button
          onClick={handleSubmit}
          disabled={selectedScore === null || isSubmitting}
          className="w-full py-2.5 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </span>
          ) : (
            "Submit Rating"
          )}
        </button>
      </div>
    </div>
  );
}
