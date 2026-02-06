"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MoreVertical,
  FileVideo,
  FileText,
  Check,
  AlertCircle,
  FolderOpen,
  BarChart3,
  ClipboardList,
  Clock,
} from "lucide-react";

interface ContentFile {
  id: string;
  type: "video" | "pdf";
  name: string;
  version: string;
  status: "live" | "processing";
  wcagCompliant: boolean | "warning";
}

interface AssessmentItem {
  id: string;
  title: string;
  questions: number;
  submissions: number;
  avgScore: number;
}

interface ReportItem {
  id: string;
  title: string;
  description: string;
  lastGenerated: string;
}

interface InstructorTabsProps {
  contentFiles: ContentFile[];
  assessments: AssessmentItem[];
  reports: ReportItem[];
}

const InstructorTabs = ({
  contentFiles,
  assessments,
  reports,
}: InstructorTabsProps) => {
  const [activeTab, setActiveTab] = useState<
    "content" | "reports" | "assessments"
  >("content");
  const t = useTranslations("instructorDashboard");

  const tabs = [
    { id: "content" as const, label: t("tabs.contentManagement"), icon: FolderOpen },
    { id: "reports" as const, label: t("tabs.reports"), icon: BarChart3 },
    { id: "assessments" as const, label: t("tabs.assessments"), icon: ClipboardList },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Tab Headers */}
      <div className="flex border-b border-[#E5E7EB]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium relative transition-colors ${
              activeTab === tab.id
                ? "text-[#3B82F6]"
                : "text-[#6B7280] hover:text-[#374151]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {/* Content Management Tab */}
        {activeTab === "content" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.type")}
                  </th>
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.fileName")}
                  </th>
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.version")}
                  </th>
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.status")}
                  </th>
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.wcag")}
                  </th>
                  <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                    {t("content.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {contentFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]"
                  >
                    <td className="py-3.5">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold ${
                          file.type === "video"
                            ? "bg-[#FEE2E2] text-[#EF4444]"
                            : "bg-[#FFEDD5] text-[#F97316]"
                        }`}
                      >
                        {file.type === "video" ? (
                          <FileVideo className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-sm text-[#374151]">
                      {file.name}
                    </td>
                    <td className="py-3.5 text-sm text-[#374151]">
                      {file.version}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          file.status === "live"
                            ? "bg-[#DCFCE7] text-[#22C55E]"
                            : "bg-[#FEF9C3] text-[#EAB308]"
                        }`}
                      >
                        {file.status === "live" ? (
                          <>
                            <Check className="w-3 h-3" />
                            {t("content.live")}
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            {t("content.processing")}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          file.wcagCompliant === true
                            ? "bg-[#DCFCE7] text-[#22C55E]"
                            : file.wcagCompliant === "warning"
                              ? "bg-[#FEF9C3] text-[#EAB308]"
                              : "bg-[#FEE2E2] text-[#EF4444]"
                        }`}
                      >
                        {file.wcagCompliant === true ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-4 border border-[#E5E7EB] rounded-xl hover:shadow-sm transition-shadow"
              >
                <h4 className="text-sm font-semibold text-[#1F2937] mb-1">
                  {report.title}
                </h4>
                <p className="text-xs text-[#6B7280] mb-3">
                  {report.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9CA3AF]">
                    {t("reports.lastGenerated")}: {report.lastGenerated}
                  </span>
                  <button className="text-xs font-medium text-[#3B82F6] hover:underline">
                    {t("reports.export")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assessments Tab */}
        {activeTab === "assessments" && (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-[#1F2937]">
                    {assessment.title}
                  </h4>
                  <p className="text-xs text-[#6B7280]">
                    {assessment.questions} {t("assessments.questions")} •{" "}
                    {assessment.submissions} {t("assessments.submissions")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#1F2937]">
                    {assessment.avgScore}%
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {t("assessments.avgScore")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorTabs;
