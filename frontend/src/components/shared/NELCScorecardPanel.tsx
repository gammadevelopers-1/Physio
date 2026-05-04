"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
  Eye,
  Video,
  FileText,
  Shield,
  Lock,
  GraduationCap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { nelcComplianceApi } from "@/lib/api";

const STATUS_STYLES = {
  passed: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", icon: CheckCircle2, ring: "ring-[#10B981]" },
  review: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: AlertCircle, ring: "ring-[#F59E0B]" },
  failed: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", icon: XCircle, ring: "ring-[#EF4444]" },
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  course_structure: BookOpen,
  accessibility: Eye,
  virtual_classes: Video,
  assessment_quality: FileText,
  policies: Shield,
  data_protection: Lock,
  instructor_qualifications: GraduationCap,
};

interface ScorecardCategory {
  category: string;
  label: string;
  icon: string;
  status: "passed" | "review" | "failed";
  checks: Array<{ rule: string; status: "passed" | "review" | "failed"; detail: string }>;
}

interface Props {
  courseId: string;
  compact?: boolean;
}

export default function NELCScorecardPanel({ courseId, compact = false }: Props) {
  const t = useTranslations("instructorDashboard.nelcScorecard");
  const statusLabels = { passed: t("passed"), review: t("needsReview"), failed: t("missing") };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<{
    overallStatus: "passed" | "review" | "failed";
    overallScore: number;
    categories: ScorecardCategory[];
  } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    nelcComplianceApi
      .getCourseScorecard(courseId)
      .then((data) => {
        if (!cancelled) setScorecard(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-sm text-[#DC2626]">
        {error || t("loadErrorFallback")}
      </div>
    );
  }

  const overallCfg = STATUS_STYLES[scorecard.overallStatus];
  const OverallIcon = overallCfg.icon;

  const passedCount = scorecard.categories.filter((c) => c.status === "passed").length;
  const totalCount = scorecard.categories.length;

  return (
    <div className={`bg-white rounded-xl border border-[var(--color-border)] overflow-hidden ${compact ? "" : "shadow-sm"}`}>
      {/* Header — clickable to toggle */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="w-full p-4 text-start hover:bg-[var(--color-border-subtle)] transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#6366F1]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("title")}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${overallCfg.bg} ${overallCfg.text}`}>
              <OverallIcon className="w-3.5 h-3.5" />
              {scorecard.overallScore}%
            </div>
            {panelOpen ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
            <span>{t("categoriesPassed", { passed: passedCount, total: totalCount })}</span>
            <span className={`font-medium ${overallCfg.text}`}>{statusLabels[scorecard.overallStatus]}</span>
          </div>
          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                scorecard.overallStatus === "passed"
                  ? "bg-[#10B981]"
                  : scorecard.overallStatus === "review"
                  ? "bg-[#F59E0B]"
                  : "bg-[#EF4444]"
              }`}
              style={{ width: `${scorecard.overallScore}%` }}
            />
          </div>
        </div>
      </button>

      {/* Categories — collapsible */}
      {panelOpen && <div className="divide-y divide-[#F3F4F6] border-t border-[var(--color-border)]">
        {scorecard.categories.map((cat) => {
          const cfg = STATUS_STYLES[cat.status];
          const CatIcon = CATEGORY_ICONS[cat.category] || BookOpen;
          const StatusIcon = cfg.icon;
          const isExpanded = expandedCategory === cat.category;
          const passedChecks = cat.checks.filter((c) => c.status === "passed").length;

          return (
            <div key={cat.category}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-border-subtle)] transition-colors text-start"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <CatIcon className={`w-3.5 h-3.5 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{t.has(`cat_${cat.category}`) ? t(`cat_${cat.category}`) : cat.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("checks", { passed: passedChecks, total: cat.checks.length })}</p>
                </div>
                <StatusIcon className={`w-4 h-4 flex-shrink-0 ${cfg.text}`} />
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {cat.checks.map((check, i) => {
                    const checkCfg = STATUS_STYLES[check.status];
                    const CheckIcon = checkCfg.icon;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 py-1.5 px-3 rounded-lg bg-[var(--color-surface-page)]"
                      >
                        <CheckIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${checkCfg.text}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t.has(`rule_${check.rule}`) ? t(`rule_${check.rule}`) : check.rule}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{check.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}
