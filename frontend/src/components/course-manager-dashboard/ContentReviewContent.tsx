"use client";

import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { FileText } from "lucide-react";

const ContentReviewContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#1F2937]">{t("contentReviewPage.title")}</h1>
                <p className="text-sm text-[#6B7280] mt-1">{t("contentReviewPage.subtitle")}</p>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-[#9CA3AF]" />
                </div>
                <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{t("contentReviewPage.emptyTitle")}</h3>
                <p className="text-sm text-[#6B7280] max-w-md mx-auto">{t("contentReviewPage.emptyDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContentReviewContent;
