"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  FileText,
  Check,
  X,
  AlertTriangle,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const ComplianceContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Mock Compliance Data with translations
  const complianceCategories = [
    {
      id: "accessibility",
      name: t("compliancePage.categories.accessibility"),
      clauses: [
        { id: "A1", title: t("compliancePage.clauses.A1"), status: "pass", evidence: true },
        { id: "A2", title: t("compliancePage.clauses.A2"), status: "pass", evidence: true },
        { id: "A3", title: t("compliancePage.clauses.A3"), status: "pass", evidence: true },
        { id: "A4", title: t("compliancePage.clauses.A4"), status: "pass", evidence: true },
      ],
    },
    {
      id: "dataProtection",
      name: t("compliancePage.categories.dataProtection"),
      clauses: [
        { id: "D1", title: t("compliancePage.clauses.D1"), status: "pass", evidence: true },
        { id: "D2", title: t("compliancePage.clauses.D2"), status: "pass", evidence: true },
        { id: "D3", title: t("compliancePage.clauses.D3"), status: "pass", evidence: true },
        { id: "D4", title: t("compliancePage.clauses.D4"), status: "review", evidence: false },
      ],
    },
    {
      id: "governance",
      name: t("compliancePage.categories.governance"),
      clauses: [
        { id: "G1", title: t("compliancePage.clauses.G1"), status: "pass", evidence: true },
        { id: "G2", title: t("compliancePage.clauses.G2"), status: "pass", evidence: true },
        { id: "G3", title: t("compliancePage.clauses.G3"), status: "pass", evidence: true },
        { id: "G4", title: t("compliancePage.clauses.G4"), status: "review", evidence: false },
      ],
    },
    {
      id: "content",
      name: t("compliancePage.categories.content"),
      clauses: [
        { id: "C1", title: t("compliancePage.clauses.C1"), status: "pass", evidence: true },
        { id: "C2", title: t("compliancePage.clauses.C2"), status: "review", evidence: false },
        { id: "C3", title: t("compliancePage.clauses.C3"), status: "pass", evidence: true },
        { id: "C4", title: t("compliancePage.clauses.C4"), status: "pass", evidence: true },
      ],
    },
    {
      id: "assessment",
      name: t("compliancePage.categories.assessment"),
      clauses: [
        { id: "AS1", title: t("compliancePage.clauses.AS1"), status: "pass", evidence: true },
        { id: "AS2", title: t("compliancePage.clauses.AS2"), status: "pass", evidence: true },
        { id: "AS3", title: t("compliancePage.clauses.AS3"), status: "review", evidence: false },
      ],
    },
    {
      id: "certification",
      name: t("compliancePage.categories.certification"),
      clauses: [
        { id: "CE1", title: t("compliancePage.clauses.CE1"), status: "pass", evidence: true },
        { id: "CE2", title: t("compliancePage.clauses.CE2"), status: "pass", evidence: true },
        { id: "CE3", title: t("compliancePage.clauses.CE3"), status: "fail", evidence: false },
        { id: "CE4", title: t("compliancePage.clauses.CE4"), status: "fail", evidence: false },
      ],
    },
  ];

  const [expandedCategory, setExpandedCategory] = useState<string | null>("accessibility");

  const allClauses = complianceCategories.flatMap((cat) => cat.clauses);
  const stats = {
    total: allClauses.length,
    passed: allClauses.filter((c) => c.status === "pass").length,
    review: allClauses.filter((c) => c.status === "review").length,
    failed: allClauses.filter((c) => c.status === "fail").length,
  };
  const percentage = Math.round((stats.passed / stats.total) * 100);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <Check className="w-5 h-5 text-[#16A34A]" />;
      case "review":
        return <AlertTriangle className="w-5 h-5 text-[#D97706]" />;
      case "fail":
        return <X className="w-5 h-5 text-[#DC2626]" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pass":
        return <span className="px-2 py-1 text-xs font-medium rounded bg-[#DCFCE7] text-[#16A34A]">{t("compliance.pass")}</span>;
      case "review":
        return <span className="px-2 py-1 text-xs font-medium rounded bg-[#FEF3C7] text-[#D97706]">{t("compliance.review")}</span>;
      case "fail":
        return <span className="px-2 py-1 text-xs font-medium rounded bg-[#FEE2E2] text-[#DC2626]">{t("compliance.fail")}</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("compliancePage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("compliancePage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors">
                  <Download className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("compliancePage.exportReport")}</span>
                </button>
              </div>

              {/* Compliance Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Score Card */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                  <div className="text-center">
                    <p
                      className={`text-6xl font-bold ${
                        percentage >= 80
                          ? "text-[#16A34A]"
                          : percentage >= 60
                            ? "text-[#D97706]"
                            : "text-[#DC2626]"
                      }`}
                    >
                      {percentage}%
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-2">{t("compliance.overallCompliance")}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-4 bg-[#F3F4F6] rounded-full overflow-hidden mt-6">
                    <div className="h-full flex">
                      <div
                        className="bg-[#16A34A] transition-all"
                        style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                      />
                      <div
                        className="bg-[#F59E0B] transition-all"
                        style={{ width: `${(stats.review / stats.total) * 100}%` }}
                      />
                      <div
                        className="bg-[#EF4444] transition-all"
                        style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
                      <span className="text-sm text-[var(--color-text-secondary)]">{stats.passed} {t("compliance.pass")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                      <span className="text-sm text-[var(--color-text-secondary)]">{stats.review} {t("compliance.review")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                      <span className="text-sm text-[var(--color-text-secondary)]">{stats.failed} {t("compliance.fail")}</span>
                    </div>
                  </div>
                </div>

                {/* Category Summary */}
                <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("compliancePage.categorySummary")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {complianceCategories.map((category) => {
                      const passed = category.clauses.filter((c) => c.status === "pass").length;
                      const total = category.clauses.length;
                      const catPercentage = Math.round((passed / total) * 100);

                      return (
                        <div
                          key={category.id}
                          className="p-4 bg-[var(--color-surface-page)] rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-lg font-bold ${
                                catPercentage === 100
                                  ? "text-[#16A34A]"
                                  : catPercentage >= 75
                                    ? "text-[#D97706]"
                                    : "text-[#DC2626]"
                              }`}
                            >
                              {catPercentage}%
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {passed}/{total}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1">{category.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Compliance Matrix */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="p-5 border-b border-[var(--color-border)]">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t("compliancePage.complianceMatrix")}
                  </h3>
                </div>

                <div className="divide-y divide-[var(--color-border)]">
                  {complianceCategories.map((category) => (
                    <div key={category.id}>
                      {/* Category Header */}
                      <button
                        className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-surface-page)] transition-colors"
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === category.id ? null : category.id
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-[#002D87]" />
                          <span className="font-medium text-[var(--color-text-primary)]">{category.name}</span>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            ({category.clauses.filter((c) => c.status === "pass").length}/{category.clauses.length})
                          </span>
                        </div>
                        {expandedCategory === category.id ? (
                          <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                        ) : (
                          <ChevronRight className={`w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`} />
                        )}
                      </button>

                      {/* Clauses */}
                      {expandedCategory === category.id && (
                        <div className="bg-[var(--color-surface-page)] px-5 pb-5">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[var(--color-border)]">
                                <th className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("compliancePage.table.clause")}
                                </th>
                                <th className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("compliancePage.table.status")}
                                </th>
                                <th className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("compliancePage.table.evidence")}
                                </th>
                                <th className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("compliancePage.table.actions")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {category.clauses.map((clause) => (
                                <tr key={clause.id} className="border-b border-[var(--color-border)] last:border-b-0">
                                  <td className="py-3">
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(clause.status)}
                                      <span className="text-sm text-[var(--color-text-primary)]">
                                        {clause.id}: {clause.title}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3">{getStatusBadge(clause.status)}</td>
                                  <td className="py-3">
                                    {clause.evidence ? (
                                      <span className="text-sm text-[#16A34A]">{t("compliancePage.uploaded")}</span>
                                    ) : (
                                      <span className="text-sm text-[#DC2626]">{t("compliancePage.missing")}</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <button className="flex items-center gap-1 text-sm text-[#0066FF] hover:underline">
                                      <Upload className="w-4 h-4" />
                                      {t("compliancePage.uploadEvidence")}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ComplianceContent;
