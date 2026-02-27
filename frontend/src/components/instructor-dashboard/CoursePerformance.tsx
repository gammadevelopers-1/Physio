"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Download, ChevronDown, FileText, FileSpreadsheet } from "lucide-react";

interface ModuleProgress {
  name: string;
  percentage: number;
}

interface PassFailStats {
  totalStudents: number;
  passed: number;
  failed: number;
  passRate: number;
}

interface CoursePerformanceProps {
  attendanceData: number[];
  modules: ModuleProgress[];
  courses: { value: string; label: string }[];
  passFailStats?: PassFailStats | null;
}

const CoursePerformance = ({
  attendanceData,
  modules,
  courses,
  passFailStats,
}: CoursePerformanceProps) => {
  const t = useTranslations("instructorDashboard");
  const tA = useTranslations("accessibility");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.value || "all");
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = [
    t("performance.mon"),
    t("performance.tue"),
    t("performance.wed"),
    t("performance.thu"),
    t("performance.fri"),
    t("performance.sat"),
    t("performance.sun"),
  ];

  // Generate SVG path for line chart
  const generateLinePath = (data: number[]) => {
    const width = 100;
    const height = 100;
    const padding = 5;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...data, 100);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return { x, y };
    });

    // Create smooth curve path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + (cpx - prev.x) * 0.5} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${cpx + (curr.x - cpx) * 0.5} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Create area fill path
    const areaPath = path + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { linePath: path, areaPath, points };
  };

  const { linePath, areaPath, points } = generateLinePath(attendanceData);

  const handleExportCSV = () => {
    const headers = ["Day", "Attendance %"];
    const rows = days.map((day, i) => [day, `${attendanceData[i]}%`]);
    const moduleRows = modules.map((m) => [m.name, `${m.percentage}%`]);

    let csv = "Course Performance Report\n\n";
    csv += "Attendance Trend\n";
    csv += headers.join(",") + "\n";
    csv += rows.map((r) => r.join(",")).join("\n");
    csv += "\n\nModule Completion\nModule,Completion %\n";
    csv += moduleRows.map((r) => r.join(",")).join("\n");
    if (passFailStats) {
      csv += `\n\n${t("performance.passRate")}\n`;
      csv += `${t("performance.passed")},${passFailStats.passed}\n`;
      csv += `${t("performance.failed")},${passFailStats.failed}\n`;
      csv += `${t("performance.passRate")},${passFailStats.passRate}%\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "course-performance.csv";
    link.click();
    URL.revokeObjectURL(url);
    setShowExportDropdown(false);
  };

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let html = `<html><head><title>Course Performance Report</title>
    <style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%;margin:10px 0}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>`;
    html += `<h1>Course Performance Report</h1>`;
    html += `<h2>Attendance Trend</h2><table><tr><th>Day</th><th>Attendance %</th></tr>`;
    days.forEach((day, i) => { html += `<tr><td>${day}</td><td>${attendanceData[i]}%</td></tr>`; });
    html += `</table>`;
    html += `<h2>Module Completion</h2><table><tr><th>Module</th><th>Completion %</th></tr>`;
    modules.forEach((m) => { html += `<tr><td>${m.name}</td><td>${m.percentage}%</td></tr>`; });
    html += `</table>`;
    if (passFailStats) {
      html += `<h2>${t("performance.passRate")}</h2><table><tr><th>${t("performance.passed")}</th><th>${t("performance.failed")}</th><th>${t("performance.passRate")}</th></tr>`;
      html += `<tr><td>${passFailStats.passed}</td><td>${passFailStats.failed}</td><td>${passFailStats.passRate}%</td></tr></table>`;
    }
    html += `</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    setShowExportDropdown(false);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB] gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
          {t("performance.title")}
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Course Filter Dropdown */}
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="flex-1 sm:flex-none sm:min-w-[160px] px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#374151] bg-white hover:border-[#9CA3AF] transition-colors cursor-pointer"
          >
            {courses.map((course) => (
              <option key={course.value} value={course.value}>
                {course.label}
              </option>
            ))}
          </select>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              aria-label={tA("exportOptions")}
              aria-haspopup="true"
              aria-expanded={showExportDropdown}
            >
              <Download className="w-4 h-4" />
              {t("performance.export")}
              <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? "rotate-180" : ""}`} />
            </button>

            {/* Export Options Dropdown */}
            {showExportDropdown && (
              <div className="absolute end-0 top-full mt-1 w-40 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10" role="menu">
                <div className="py-1">
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                    role="menuitem"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#22C55E]" />
                    {t("performance.exportCSV")}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                    role="menuitem"
                  >
                    <FileText className="w-4 h-4 text-[#EF4444]" />
                    {t("performance.exportPDF")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Line Chart - Attendance Trend */}
          <div>
            <h4 className="text-sm text-[#4B5563] mb-3">
              {t("performance.attendanceTrend")}
            </h4>
            <div className="h-48 bg-gradient-to-b from-[#EFF6FF] to-transparent rounded-lg p-4 relative">
              {/* SVG Line Chart */}
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="5"
                    y1={5 + (90 * (100 - y)) / 100}
                    x2="95"
                    y2={5 + (90 * (100 - y)) / 100}
                    stroke="#E5E7EB"
                    strokeWidth="0.3"
                    strokeDasharray="2,2"
                  />
                ))}

                {/* Area fill */}
                <path
                  d={areaPath}
                  fill="url(#areaGradient)"
                />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Data points */}
                {points.map((point, index) => (
                  <g key={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill="white"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Hover tooltip area (invisible) */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill="transparent"
                      className="cursor-pointer"
                    >
                      <title>{`${days[index]}: ${attendanceData[index]}%`}</title>
                    </circle>
                  </g>
                ))}
              </svg>
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between mt-2 text-xs text-[#6B7280] px-1">
              {days.map((day, index) => (
                <span key={index} className="text-center">{day}</span>
              ))}
            </div>
          </div>

          {/* Module Completion - Progress Bars */}
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

        {/* Pass/Fail Rate */}
        {passFailStats && passFailStats.totalStudents > 0 && (
          <div className="col-span-1 lg:col-span-2 pt-4 border-t border-[#E5E7EB]">
            <h4 className="text-sm text-[#4B5563] mb-3">
              {t("performance.passRate")}
            </h4>
            <div className="flex items-center gap-4">
              {/* Stacked bar */}
              <div className="flex-1 h-6 bg-[#E5E7EB] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#22C55E] transition-all duration-300"
                  style={{ width: `${passFailStats.passRate}%` }}
                />
                <div
                  className="h-full bg-[#EF4444] transition-all duration-300"
                  style={{ width: `${100 - passFailStats.passRate}%` }}
                />
              </div>
              {/* Labels */}
              <div className="flex items-center gap-3 text-sm flex-shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                  <span className="text-[#374151] font-medium">{passFailStats.passed}</span>
                  <span className="text-[#6B7280]">{t("performance.passed")}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span className="text-[#374151] font-medium">{passFailStats.failed}</span>
                  <span className="text-[#6B7280]">{t("performance.failed")}</span>
                </span>
                <span className="text-[#6B7280] text-xs">
                  ({passFailStats.passRate}% {t("performance.ofStudents", { total: passFailStats.totalStudents })})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursePerformance;
