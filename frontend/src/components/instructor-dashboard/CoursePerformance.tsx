"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

interface ModuleProgress {
  name: string;
  percentage: number;
}

interface CoursePerformanceProps {
  attendanceData: number[];
  modules: ModuleProgress[];
  courses: { value: string; label: string }[];
}

const CoursePerformance = ({
  attendanceData,
  modules,
  courses,
}: CoursePerformanceProps) => {
  const t = useTranslations("instructorDashboard");

  const days = [
    t("performance.mon"),
    t("performance.tue"),
    t("performance.wed"),
    t("performance.thu"),
    t("performance.fri"),
    t("performance.sat"),
    t("performance.sun"),
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-[#E5E7EB] gap-3">
        <h2 className="text-lg font-semibold text-[#1F2937]">
          {t("performance.title")}
        </h2>
        <div className="flex items-center gap-2">
          <select className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#374151] bg-white hover:border-[#9CA3AF] transition-colors">
            {courses.map((course) => (
              <option key={course.value} value={course.value}>
                {course.label}
              </option>
            ))}
          </select>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            <Download className="w-4 h-4" />
            {t("performance.export")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Chart */}
          <div>
            <h4 className="text-sm text-[#4B5563] mb-3">
              {t("performance.attendanceTrend")}
            </h4>
            <div className="h-44 bg-gradient-to-b from-[#EFF6FF] to-transparent rounded-lg p-4 relative">
              <div className="flex items-end gap-2 h-full">
                {attendanceData.map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-[#3B82F6] rounded-t transition-all duration-300"
                    style={{ height: `${value}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-[#6B7280]">
              {days.map((day, index) => (
                <span key={index}>{day}</span>
              ))}
            </div>
          </div>

          {/* Module Completion */}
          <div>
            <h4 className="text-sm text-[#4B5563] mb-3">
              {t("performance.moduleCompletion")}
            </h4>
            <div className="space-y-3">
              {modules.map((module, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#374151]">{module.name}</span>
                    <span className="font-semibold text-[#1F2937]">
                      {module.percentage}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22C55E] rounded-full transition-all duration-300"
                      style={{ width: `${module.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePerformance;
