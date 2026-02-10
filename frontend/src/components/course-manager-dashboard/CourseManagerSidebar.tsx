"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  FileCheck,
  ClipboardCheck,
  BarChart3,
  Settings,
  Pencil,
  Briefcase,
} from "lucide-react";

interface CourseManagerProfile {
  name: string;
  email: string;
  totalCourses: number;
  totalInstructors: number;
  nelcCompliance: number;
  avatar?: string;
}

interface CourseManagerSidebarProps {
  manager: CourseManagerProfile;
}

const CourseManagerSidebar = ({ manager }: CourseManagerSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("courseManagerDashboard");
  const isRTL = locale === "ar";

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/course-manager-dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.courses"),
      href: `/${locale}/course-manager-dashboard/courses`,
      icon: BookOpen,
      badge: manager.totalCourses,
    },
    {
      label: t("sidebar.sessions"),
      href: `/${locale}/course-manager-dashboard/sessions`,
      icon: Calendar,
    },
    {
      label: t("sidebar.instructors"),
      href: `/${locale}/course-manager-dashboard/instructors`,
      icon: Users,
    },
    {
      label: t("sidebar.contentReview"),
      href: `/${locale}/course-manager-dashboard/content-review`,
      icon: FileCheck,
      badge: 5,
    },
    {
      label: t("sidebar.assessments"),
      href: `/${locale}/course-manager-dashboard/assessments`,
      icon: ClipboardCheck,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/course-manager-dashboard/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/course-manager-dashboard/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center">
          {/* Avatar with edit button */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
              <Image
                src={manager.avatar || "/images/default-avatar.png"}
                alt={manager.name}
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            </div>
            <button
              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white`}
              aria-label={t("sidebar.editProfile")}
            >
              <Pencil className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {manager.name}
          </h3>
          <p className="text-sm text-[#6B7280] mb-2">{manager.email}</p>

          {/* Role Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#EDE9FE] rounded-full">
            <Briefcase className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-sm font-medium text-[#8B5CF6]">
              {t("sidebar.courseManager")}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex justify-around py-4 border-t border-[#E5E7EB]">
          <div className="text-center">
            <p className="text-xl font-bold text-[#1F2937]">{manager.totalCourses}</p>
            <p className="text-xs text-[#6B7280]">{t("sidebar.courses")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#1F2937]">{manager.totalInstructors}</p>
            <p className="text-xs text-[#6B7280]">{t("sidebar.instructors")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#16A34A]">{manager.nelcCompliance}%</p>
            <p className="text-xs text-[#6B7280]">{t("sidebar.nelc")}</p>
          </div>
        </div>

        {/* View Profile Button */}
        <button className="w-full mt-4 py-2.5 px-4 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB] transition-colors">
          {t("sidebar.viewProfile")}
        </button>
      </div>

      {/* Navigation Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-[#F0F7FF] text-[#002D87]"
                    : "text-[#4B5563] hover:bg-[#F9FAFB]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-[#002D87]" : "text-[#6B7280]"}`}
                />
                <span className={`text-sm flex-1 ${active ? "font-medium" : ""}`}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default CourseManagerSidebar;
