"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  Download,
  ChevronDown,
  ChevronRight,
  FileText,
  Accessibility,
  Video,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { nelcComplianceApi } from "@/lib/api";

type Status = "passed" | "review" | "failed";

interface ScorecardCategory {
  category: string;
  label: string;
  icon: string;
  status: Status;
  checks: Array<{ rule: string; status: Status; detail: string }>;
}

interface Scorecard {
  courseId: string;
  overallStatus: Status;
  overallScore: number;
  categories: ScorecardCategory[];
}

interface Props {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onClose: () => void;
}

const ICON_FOR_CATEGORY: Record<string, typeof FileText> = {
  structure: FileText,
  accessibility: Accessibility,
  virtual: Video,
  assessment: ClipboardCheck,
  instructor: GraduationCap,
};

function StatusPill({ status }: { status: Status }) {
  const t = useTranslations("adminDashboard.compliance");
  const style =
    status === "passed"
      ? "bg-[#DCFCE7] text-[#16A34A]"
      : status === "review"
        ? "bg-[#FEF3C7] text-[#D97706]"
        : "bg-[#FEE2E2] text-[#DC2626]";
  const label = status === "passed" ? t("pass") : status === "review" ? t("review") : t("fail");
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${style}`}>{label}</span>;
}

function StatusIcon({ status, className = "w-4 h-4" }: { status: Status; className?: string }) {
  if (status === "passed") return <Check className={`${className} text-[#16A34A]`} />;
  if (status === "review") return <AlertTriangle className={`${className} text-[#D97706]`} />;
  return <X className={`${className} text-[#DC2626]`} />;
}

const ComplianceScorecardDrawer = ({ courseId, courseTitle, open, onClose }: Props) => {
  const t = useTranslations("adminDashboard.compliancePage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    setLoading(true);
    setScorecard(null);
    nelcComplianceApi
      .getCourseScorecard(courseId)
      .then((res) => {
        if (cancelled) return;
        setScorecard(res as Scorecard);
        // Auto-expand the first non-passing category so the admin
        // lands on the issue they need to look at.
        const firstAlert = res.categories.find((c) => c.status !== "passed");
        if (firstAlert) setExpanded({ [firstAlert.category]: true });
      })
      .catch(() => {
        if (!cancelled) setScorecard(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, courseId]);

  const handleEvidenceDownload = async () => {
    setDownloading(true);
    try {
      await nelcComplianceApi.downloadEvidence(courseId);
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                {t("scorecard")}
              </p>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {courseTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-border-subtle)]"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {scorecard && (
            <div className="mt-4 flex items-center gap-4">
              <div
                className={`text-3xl font-bold ${
                  scorecard.overallScore >= 80
                    ? "text-[#16A34A]"
                    : scorecard.overallScore >= 60
                      ? "text-[#D97706]"
                      : "text-[#DC2626]"
                }`}
              >
                {scorecard.overallScore}%
              </div>
              <StatusPill status={scorecard.overallStatus} />
              <button
                type="button"
                onClick={handleEvidenceDownload}
                disabled={downloading}
                className="ms-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] disabled:opacity-60"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t("evidenceZip")}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {!loading && scorecard && scorecard.categories.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">
              {t("noCategories")}
            </p>
          )}

          {!loading &&
            scorecard?.categories.map((cat) => {
              const Icon = ICON_FOR_CATEGORY[cat.icon] || FileText;
              const isOpen = !!expanded[cat.category];
              const passed = cat.checks.filter((c) => c.status === "passed").length;
              return (
                <div
                  key={cat.category}
                  className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-border-subtle)] transition-colors"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [cat.category]: !prev[cat.category] }))
                    }
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {cat.label}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {passed} / {cat.checks.length} {t("rulesPassing")}
                      </p>
                    </div>
                    <StatusPill status={cat.status} />
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    ) : (
                      <ChevronRight
                        className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                      {cat.checks.map((chk, i) => (
                        <div
                          key={`${cat.category}-${chk.rule}-${i}`}
                          className="px-4 py-3 flex items-start gap-3"
                        >
                          <StatusIcon status={chk.status} className="w-4 h-4 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {chk.rule.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {chk.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default ComplianceScorecardDrawer;
