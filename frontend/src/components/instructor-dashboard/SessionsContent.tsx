"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import {
  Plus,
  Calendar,
  List,
  Video,
  MapPin,
  Users,
  Clock,
  Play,
  ClipboardCheck,
  Upload,
  Edit,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  MoreVertical,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  course: string;
  date: string;
  time: string;
  duration: string;
  type: "zoom" | "onsite" | "hybrid";
  venue?: string;
  enrolled: number;
  status: "upcoming" | "live" | "completed" | "cancelled";
  zoomLink?: string;
}

const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const SessionsContent = () => {
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSessionType, setSelectedSessionType] = useState<"zoom" | "onsite" | "hybrid">("zoom");

  // Mock sessions data
  const sessions: Session[] = [
    {
      id: "ses-1",
      title: "Module 2: ECG Recognition",
      course: "Advanced Cardiovascular Life Support",
      date: "2026-02-06",
      time: "2:00 PM - 3:30 PM",
      duration: "90 mins",
      type: "zoom",
      enrolled: 25,
      status: "upcoming",
      zoomLink: "https://zoom.us/j/123456789",
    },
    {
      id: "ses-2",
      title: "Module 2: Rhythm Analysis",
      course: "Advanced Cardiovascular Life Support",
      date: "2026-02-08",
      time: "2:00 PM - 3:30 PM",
      duration: "90 mins",
      type: "zoom",
      enrolled: 25,
      status: "upcoming",
      zoomLink: "https://zoom.us/j/123456789",
    },
    {
      id: "ses-3",
      title: "Basic First Aid - Practical",
      course: "Basic First Aid Training",
      date: "2026-02-06",
      time: "4:00 PM - 6:00 PM",
      duration: "120 mins",
      type: "onsite",
      venue: "Room 204, Training Center",
      enrolled: 18,
      status: "upcoming",
    },
    {
      id: "ses-4",
      title: "CPR Hands-on Practice",
      course: "CPR Certification",
      date: "2026-02-10",
      time: "10:00 AM - 12:00 PM",
      duration: "120 mins",
      type: "hybrid",
      venue: "Main Hall + Zoom",
      enrolled: 32,
      status: "upcoming",
      zoomLink: "https://zoom.us/j/987654321",
    },
    {
      id: "ses-5",
      title: "Introduction Session",
      course: "Advanced Cardiovascular Life Support",
      date: "2026-02-01",
      time: "2:00 PM - 3:30 PM",
      duration: "90 mins",
      type: "zoom",
      enrolled: 25,
      status: "completed",
    },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      upcoming: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("sessions.statusUpcoming") },
      live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessions.statusLive") },
      completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessions.statusCompleted") },
      cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: t("sessions.statusCancelled") },
    };
    return styles[status] || styles.upcoming;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "zoom":
        return <Video className="w-4 h-4" />;
      case "onsite":
        return <MapPin className="w-4 h-4" />;
      case "hybrid":
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    const styles: Record<string, string> = {
      zoom: "bg-[#EFF6FF] text-[#3B82F6]",
      onsite: "bg-[#DCFCE7] text-[#22C55E]",
      hybrid: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.zoom;
  };

  // Calendar helpers
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSessionsForDate = (day: number) => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return sessions.filter((s) => s.date === dateStr);
  };

  return (
    <>
      <InstructorNavbar instructor={mockInstructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={mockInstructor} />
            </div>
            <InstructorMobileSidebar instructor={mockInstructor} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("sessionsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("sessionsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Toggle */}
                  <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "list"
                          ? "btn-gold text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      }`}
                    >
                      <List className="w-4 h-4" />
                      {t("sessionsPage.listView")}
                    </button>
                    <button
                      onClick={() => setViewMode("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "calendar"
                          ? "btn-gold text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      {t("sessionsPage.calendarView")}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("sessionsPage.scheduleSession")}
                  </button>
                </div>
              </div>

              {/* List View */}
              {viewMode === "list" && (
                <div className="space-y-4">
                  {/* Today's Sessions */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB]">
                    <div className="p-4 border-b border-[#E5E7EB]">
                      <h2 className="text-base font-semibold text-[#1F2937]">
                        {t("sessionsPage.today")}
                      </h2>
                    </div>
                    <div className="divide-y divide-[#E5E7EB]">
                      {sessions.filter((s) => s.date === "2026-02-06").map((session) => (
                        <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeBadgeStyle(session.type)}`}>
                                {getTypeIcon(session.type)}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-[#1F2937]">{session.title}</h3>
                                <p className="text-xs text-[#6B7280] mt-0.5">{session.course}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#6B7280]">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {session.time}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    {session.enrolled} {t("sessionsPage.enrolled")}
                                  </span>
                                  {session.venue && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5" />
                                      {session.venue}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>
                                {getStatusBadge(session.status).label}
                              </span>
                              {session.status === "upcoming" && (
                                <>
                                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors">
                                    <Play className="w-3.5 h-3.5" />
                                    {t("sessionsPage.start")}
                                  </button>
                                  <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors" title={t("sessionsPage.attendance")}>
                                    <ClipboardCheck className="w-4 h-4" />
                                  </button>
                                  <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors" title={t("sessionsPage.share")}>
                                    <Upload className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming Sessions */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB]">
                    <div className="p-4 border-b border-[#E5E7EB]">
                      <h2 className="text-base font-semibold text-[#1F2937]">
                        {t("sessionsPage.upcoming")}
                      </h2>
                    </div>
                    <div className="divide-y divide-[#E5E7EB]">
                      {sessions.filter((s) => s.date !== "2026-02-06" && s.status === "upcoming").map((session) => (
                        <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeBadgeStyle(session.type)}`}>
                                {getTypeIcon(session.type)}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-[#1F2937]">{session.title}</h3>
                                <p className="text-xs text-[#6B7280] mt-0.5">{session.course}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#6B7280]">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {session.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {session.time}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    {session.enrolled} {t("sessionsPage.enrolled")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadgeStyle(session.type)}`}>
                                {t(`sessionsPage.type.${session.type}`)}
                              </span>
                              <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors" title={t("sessionsPage.edit")}>
                                <Edit className="w-4 h-4" />
                              </button>
                              <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Past Sessions */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB]">
                    <div className="p-4 border-b border-[#E5E7EB]">
                      <h2 className="text-base font-semibold text-[#1F2937]">
                        {t("sessionsPage.past")}
                      </h2>
                    </div>
                    <div className="divide-y divide-[#E5E7EB]">
                      {sessions.filter((s) => s.status === "completed").map((session) => (
                        <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors opacity-75">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]">
                                {getTypeIcon(session.type)}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-[#6B7280]">{session.title}</h3>
                                <p className="text-xs text-[#9CA3AF] mt-0.5">{session.course}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-[#9CA3AF]">
                                  <span>{session.date}</span>
                                  <span>{session.time}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>
                                {getStatusBadge(session.status).label}
                              </span>
                              <button className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3.5 h-3.5" />
                                {t("sessionsPage.viewRecording")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar View */}
              {viewMode === "calendar" && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
                    <button
                      onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
                    </button>
                    <h2 className="text-lg font-semibold text-[#1F2937]">
                      {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </h2>
                    <button
                      onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7">
                    {/* Day Headers */}
                    {dayNames.map((day) => (
                      <div key={day} className="p-3 text-center text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB]">
                        {day}
                      </div>
                    ))}

                    {/* Empty cells for days before the first day of month */}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[#E5E7EB] bg-[#F9FAFB]" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const daySessions = getSessionsForDate(day);
                      const isToday = new Date().getDate() === day && new Date().getMonth() === selectedDate.getMonth();

                      return (
                        <div
                          key={day}
                          className={`min-h-[100px] p-2 border-b border-r border-[#E5E7EB] ${isToday ? "bg-[#EFF6FF]" : ""}`}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                            isToday ? "bg-[#3B82F6] text-white rounded-full font-semibold" : "text-[#1F2937]"
                          }`}>
                            {day}
                          </span>
                          <div className="mt-1 space-y-1">
                            {daySessions.slice(0, 2).map((session) => (
                              <div
                                key={session.id}
                                className={`px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer ${getTypeBadgeStyle(session.type)}`}
                                title={session.title}
                              >
                                {session.title}
                              </div>
                            ))}
                            {daySessions.length > 2 && (
                              <div className="text-[10px] text-[#6B7280] px-1.5">
                                +{daySessions.length - 2} {t("sessionsPage.more")}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Session Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#1F2937]">
                {t("sessionsPage.scheduleSessionTitle")}
              </h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("sessionsPage.form.course")}
                </label>
                <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm">
                  <option>{t("sessionsPage.form.selectCourse")}</option>
                  <option>Advanced Cardiovascular Life Support</option>
                  <option>Basic First Aid Training</option>
                  <option>CPR Certification</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("sessionsPage.form.sessionTitle")}
                </label>
                <input type="text" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm" placeholder={t("sessionsPage.form.sessionTitlePlaceholder")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    {t("sessionsPage.form.date")}
                  </label>
                  <input type="date" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    {t("sessionsPage.form.time")}
                  </label>
                  <input type="time" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("sessionsPage.form.duration")}
                </label>
                <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm" defaultValue="90">
                  <option value="30">30 {t("sessionsPage.form.minutes")}</option>
                  <option value="60">60 {t("sessionsPage.form.minutes")}</option>
                  <option value="90">90 {t("sessionsPage.form.minutes")}</option>
                  <option value="120">2 {t("sessionsPage.form.hours")}</option>
                  <option value="custom">{t("sessionsPage.form.custom")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("sessionsPage.form.sessionType")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSessionType("zoom")}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                      selectedSessionType === "zoom"
                        ? "border-2 border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]"
                        : "border border-[#E5E7EB] text-[#6B7280] hover:border-[#3B82F6] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
                    }`}
                  >
                    <Video className="w-5 h-5" />
                    <span className="text-xs font-medium">Zoom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionType("onsite")}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                      selectedSessionType === "onsite"
                        ? "border-2 border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]"
                        : "border border-[#E5E7EB] text-[#6B7280] hover:border-[#3B82F6] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-xs font-medium">{t("sessionsPage.form.onsite")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionType("hybrid")}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                      selectedSessionType === "hybrid"
                        ? "border-2 border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]"
                        : "border border-[#E5E7EB] text-[#6B7280] hover:border-[#3B82F6] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
                    }`}
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span className="text-xs font-medium">{t("sessionsPage.form.hybrid")}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-[#3B82F6] border-[#E5E7EB] rounded focus:ring-[#3B82F6]" defaultChecked />
                  <span className="text-sm text-[#374151]">{t("sessionsPage.form.notifyStudents")}</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E5E7EB]">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                {t("sessionsPage.form.cancel")}
              </button>
              <button className="px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                {t("sessionsPage.form.schedule")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionsContent;
