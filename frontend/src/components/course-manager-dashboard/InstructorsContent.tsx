"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import type { InstructorListItem } from "@/lib/api";
import {
  Search,
  Mail,
  ChevronRight,
  User,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const InstructorsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstructors = () => {
    setLoading(true);
    setError(null);
    courseManagerApi
      .getInstructors()
      .then((data) => setInstructors(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load instructors")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  const filteredInstructors = instructors.filter((inst) => {
    const name = [inst.firstName, inst.lastName].filter(Boolean).join(" ");
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getInitials = (inst: InstructorListItem) => {
    if (inst.firstName && inst.lastName) {
      return `${inst.firstName[0]}${inst.lastName[0]}`.toUpperCase();
    }
    return inst.email.substring(0, 2).toUpperCase();
  };

  const getName = (inst: InstructorListItem) => {
    return [inst.firstName, inst.lastName].filter(Boolean).join(" ") || inst.email;
  };

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">{t("instructorsPage.title")}</h1>
                  <p className="text-sm text-[#6B7280] mt-1">{t("instructorsPage.subtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{instructors.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.available")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">{instructors.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder={t("instructorsPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280] mb-4">{error}</p>
                  <button onClick={fetchInstructors} className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg">
                    <RefreshCw className="w-4 h-4" />{t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredInstructors.map((instructor) => (
                    <div key={instructor.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-[#EFF6FF] rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-[#3B82F6]">{getInitials(instructor)}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#1F2937]">{getName(instructor)}</h3>
                          <p className="text-xs text-[#6B7280]">{instructor.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                        <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button className="inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:underline">
                          {t("instructorsPage.viewProfile")}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && !error && filteredInstructors.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{t("instructorsPage.noInstructors")}</h3>
                  <p className="text-sm text-[#6B7280]">{t("instructorsPage.noInstructorsDesc")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorsContent;
