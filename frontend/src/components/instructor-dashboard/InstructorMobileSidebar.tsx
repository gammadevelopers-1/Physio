"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  ClipboardCheck,
  Award,
  Upload,
  BarChart3,
  Settings,
  X,
  Pencil,
  Star,
} from "lucide-react";

interface InstructorProfile {
  name: string;
  email: string;
  rating: number;
  courseCompletion: number;
  avatar?: string;
}

interface InstructorMobileSidebarProps {
  instructor: InstructorProfile;
}

const InstructorMobileSidebar = ({
  instructor,
}: InstructorMobileSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("instructorDashboard");
  const isRTL = locale === "ar";

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/instructor`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.myCourses"),
      href: `/${locale}/dashboard/instructor/courses`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.sessions"),
      href: `/${locale}/dashboard/instructor/sessions`,
      icon: Calendar,
    },
    {
      label: t("sidebar.students"),
      href: `/${locale}/dashboard/instructor/students`,
      icon: Users,
    },
    {
      label: t("sidebar.assessments"),
      href: `/${locale}/dashboard/instructor/assessments`,
      icon: ClipboardCheck,
    },
    {
      label: t("sidebar.certificates"),
      href: `/${locale}/dashboard/instructor/certificates`,
      icon: Award,
    },
    {
      label: t("sidebar.content"),
      href: `/${locale}/dashboard/instructor/content`,
      icon: Upload,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/instructor/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/instructor/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`lg:hidden fixed top-0 ${isRTL ? "right-0" : "left-0"} h-full w-[300px] bg-[#F9FAFB] z-50 transform transition-transform duration-300 overflow-y-auto ${
          isOpen
            ? "translate-x-0"
            : isRTL
              ? "translate-x-full"
              : "-translate-x-full"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} w-8 h-8 flex items-center justify-center`}
          aria-label="Close menu"
        >
          <X className="w-6 h-6 text-[#6B7280]" />
        </button>

        <div className="p-4 pt-14 flex flex-col gap-4">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            {/* Profile Section */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
                  <Image
                    src={instructor.avatar || "/images/default-avatar.png"}
                    alt={instructor.name}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                </div>
                <button
                  className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white`}
                >
                  <Pencil className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-[#1F2937]">
                {instructor.name}
              </h3>
              <p className="text-sm text-[#6B7280] mb-2">{instructor.email}</p>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FEF3C7] rounded-full">
                <Star className="w-4 h-4 text-[#D4A520] fill-[#D4A520]" />
                <span className="text-sm font-medium text-[#D4A520]">
                  {instructor.rating} {t("sidebar.rating")}
                </span>
              </div>
            </div>

            {/* Course Completion */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#4B5563]">
                  {t("sidebar.courseCompletion")}
                </span>
                <span className="text-sm font-medium text-[#1F2937]">
                  {instructor.courseCompletion}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D4A520] rounded-full"
                  style={{ width: `${instructor.courseCompletion}%` }}
                />
              </div>
            </div>

            {/* View Profile Button */}
            <button className="w-full mt-4 py-2.5 px-4 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937]">
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
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? "bg-[#F0F7FF] text-[#002D87]"
                        : "text-[#4B5563] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${active ? "text-[#002D87]" : "text-[#6B7280]"}`}
                    />
                    <span className={`text-sm ${active ? "font-medium" : ""}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorMobileSidebar;
