"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Radio,
  X,
  Users,
  Check,
  Copy,
  Share2,
  ExternalLink,
  Loader2,
  Download,
} from "lucide-react";
import { courseManagerApi } from "@/lib/api";
import {
  openWebinarWhatsAppShare,
  openCoursePageWhatsAppShare,
} from "@/lib/webinar-share";

export interface RegistrantRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  nationalId: string | null;
  scfhsNumber: string | null;
  status: string;
  userId: string | null;
  attended: boolean;
  joinedAt: string | null;
  leftAt: string | null;
  attendedDurationMinutes: number;
  createdAt: string;
  source: "platform" | "external";
  /**
   * Whether this registrant currently has an active enrollment in the
   * parent course (joined by email). Only meaningful when coursePaid is
   * true — for free courses everyone is auto-enrolled from the Zoom form.
   */
  enrolled?: boolean;
}

interface WebinarRegistrantsDrawerProps {
  sessionId: string;
  sessionTitle: string;
  scheduledAt: string;
  registrationUrl: string | null;
  /**
   * Zoom webinar ID — surfaced inside the WhatsApp share message as
   * "Meeting ID: …" so registrants can keep it for reference.
   */
  zoomWebinarId?: string | null;
  /**
   * Course this webinar belongs to. Included in the WhatsApp share
   * message so recipients see the course name alongside the topic.
   */
  courseName?: string | null;
  /**
   * Course id — used to build the public course page URL when sharing
   * a PAID Webinar Course (the share UI hides the Zoom registration
   * URL and hands out the course page instead, so outsiders must go
   * through checkout before they can register on Zoom).
   */
  courseId?: string | null;
  /**
   * Session lifecycle status. Used to hide share actions once the
   * webinar is live/ended (registration is effectively closed).
   */
  sessionStatus?: string;
  /**
   * Read-only mode hides the Copy / WhatsApp / Open-page actions in the
   * drawer header. Used by instructor (manager keeps full controls).
   */
  readOnly?: boolean;
  onClose: () => void;
}

export default function WebinarRegistrantsDrawer({
  sessionId,
  sessionTitle,
  scheduledAt,
  registrationUrl,
  zoomWebinarId,
  courseName,
  courseId,
  sessionStatus,
  readOnly = false,
  onClose,
}: WebinarRegistrantsDrawerProps) {
  // Share actions only make sense before the webinar starts. Once it's
  // live/ended/cancelled/missed, registration is closed so sharing the
  // link is meaningless.
  const shareableStatus = !sessionStatus || sessionStatus === "scheduled";
  const t = useTranslations("courseManagerDashboard.sessionsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalRegistered: number;
    totalAttended: number;
    coursePaid: boolean;
    rows: RegistrantRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    courseManagerApi
      .getWebinarRegistrants(sessionId)
      .then((res) => {
        if (cancelled) return;
        setData({
          totalRegistered: res.totalRegistered,
          totalAttended: res.totalAttended,
          coursePaid: !!(res as { coursePaid?: boolean }).coursePaid,
          rows: res.registrants as RegistrantRow[],
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(isRTL ? "تعذر تحميل المسجلين" : "Failed to load registrants");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, isRTL]);

  // For paid Webinar Courses we deliberately hide the Zoom registration
  // URL — sharing goes through the public course page so outsiders must
  // complete checkout before they can register on Zoom. Free webinars
  // keep the existing direct-Zoom-link behavior.
  const coursePaid = !!data?.coursePaid;
  const coursePageUrl =
    coursePaid && courseId
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/courses/${courseId}`
      : null;
  const shareUrl = coursePaid ? coursePageUrl : registrationUrl;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success(
      isRTL
        ? coursePaid
          ? "تم نسخ رابط صفحة الدورة"
          : "تم نسخ الرابط"
        : coursePaid
          ? "Course page link copied"
          : "Registration link copied",
    );
  };

  const handleWhatsApp = () => {
    if (!shareUrl) return;
    if (coursePaid && coursePageUrl) {
      openCoursePageWhatsAppShare({
        webinarTitle: sessionTitle,
        scheduledAt,
        courseName: courseName ?? null,
        courseUrl: coursePageUrl,
      });
      return;
    }
    if (!registrationUrl) return;
    openWebinarWhatsAppShare({
      title: sessionTitle,
      scheduledAt,
      registrationUrl,
      zoomWebinarId: zoomWebinarId ?? null,
      courseName: courseName ?? null,
      locale,
    });
  };

  const handleDownloadCsv = () => {
    if (!data || data.rows.length === 0) return;

    // ISO-ish, Excel-friendly; empty when null
    const fmtDateTime = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const escape = (val: unknown): string => {
      if (val == null) return "";
      const s = String(val);
      // Quote when the field contains comma, quote, CR, or LF; escape inner quotes.
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headers = [
      "First name",
      "Last name",
      "Email",
      "Phone",
      "National ID / Iqama",
      "SCFHS number",
      "Source",
      ...(data.coursePaid ? ["Payment status"] : []),
      "Registration status",
      "Registered at",
      "Attended",
      "Joined at",
      "Left at",
      "Attended duration (min)",
    ];

    const lines = data.rows.map((r) =>
      [
        r.firstName,
        r.lastName,
        r.email,
        r.phone,
        r.nationalId,
        r.scfhsNumber,
        r.source === "platform" ? "Student" : "External",
        ...(data.coursePaid ? [r.enrolled ? "Paid" : "Not paid"] : []),
        r.status,
        fmtDateTime(r.createdAt),
        r.attended ? "Yes" : "No",
        fmtDateTime(r.joinedAt),
        fmtDateTime(r.leftAt),
        r.attendedDurationMinutes ?? 0,
      ]
        .map(escape)
        .join(",")
    );

    // BOM so Excel opens UTF-8 (Arabic names) correctly. CRLF for Excel.
    const csv = "﻿" + [headers.map(escape).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const slug =
      sessionTitle
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "webinar";
    const datePart = new Date(scheduledAt).toISOString().slice(0, 10);
    const fname = `webinar-registrants_${slug}_${datePart}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(
      isRTL
        ? `تم تنزيل ${data.rows.length} مسجل`
        : `Downloaded ${data.rows.length} registrants`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`fixed top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-2xl bg-[var(--color-surface-card)] shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-4 h-4 text-[#A855F7]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">
                {isRTL ? "ندوة" : "Webinar"}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
              {sessionTitle}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {new Date(scheduledAt).toLocaleString(isRTL ? "ar-SA" : "en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors flex-shrink-0"
            aria-label={isRTL ? "إغلاق" : "Close"}
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-border-subtle)] flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF5FF] border border-[#E9D5FF] rounded-full">
            <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span className="text-xs font-semibold text-[#7C3AED]">
              {data?.totalRegistered ?? "…"} {isRTL ? "مسجل" : "registered"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#DCFCE7] border border-[#86EFAC] rounded-full">
            <Check className="w-3.5 h-3.5 text-[#16A34A]" />
            <span className="text-xs font-semibold text-[#16A34A]">
              {data?.totalAttended ?? "…"} {isRTL ? "حضر" : "attended"}
            </span>
          </div>
          {data?.coursePaid && (() => {
            const notPaid = data.rows.filter((r) => !r.enrolled).length;
            if (notPaid === 0) return null;
            return (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF7ED] border border-[#FDBA74] rounded-full">
                <span className="text-xs font-semibold text-[#9A3412]">
                  {notPaid} {isRTL ? "غير مدفوع" : "not paid"}
                </span>
              </div>
            );
          })()}
          <div className="flex-1" />
          {/* CSV export — manager only, but available in both pre- and
              post-webinar states (lead list before, attendance report after). */}
          {!readOnly && data && data.rows.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface-card)] border border-[var(--color-border)] hover:border-[#A855F7] hover:text-[#7C3AED] text-xs font-medium text-[var(--color-text-primary)] transition-colors"
              aria-label={isRTL ? "تنزيل CSV" : "Download CSV"}
            >
              <Download className="w-3.5 h-3.5" />
              {isRTL ? "تنزيل CSV" : "Download CSV"}
            </button>
          )}
          {!readOnly && shareUrl && shareableStatus && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface-card)] border border-[var(--color-border)] hover:border-[#A855F7] hover:text-[#7C3AED] text-xs font-medium text-[var(--color-text-primary)] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {isRTL
                  ? coursePaid
                    ? "نسخ رابط الدورة"
                    : "نسخ الرابط"
                  : coursePaid
                    ? "Copy course link"
                    : "Copy link"}
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] hover:bg-[#1FAB55] text-white text-xs font-medium transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                {isRTL ? "واتساب" : "WhatsApp"}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface-card)] border border-[var(--color-border)] hover:border-[#A855F7] hover:text-[#7C3AED] text-xs font-medium text-[var(--color-text-primary)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {isRTL
                  ? coursePaid
                    ? "فتح صفحة الدورة"
                    : "فتح صفحة التسجيل"
                  : coursePaid
                    ? "Open course page"
                    : "Open page"}
              </a>
            </>
          )}
          {!readOnly && shareUrl && !shareableStatus && (
            <span className="text-xs text-[var(--color-text-secondary)] italic">
              {isRTL ? "التسجيل مغلق" : "Registration closed"}
            </span>
          )}
        </div>

        {/* Paid Webinar Course — explain why the share link is the course
            page, not the Zoom registration form. */}
        {!readOnly && coursePaid && shareableStatus && (
          <div className="px-5 py-2.5 border-b border-[var(--color-border)] bg-[#FFF7ED] text-xs text-[#7C2D12] leading-relaxed">
            {isRTL
              ? "هذه دورة مدفوعة. مشاركة الرابط توجه المستخدمين إلى صفحة الدورة لإتمام الدفع والتسجيل — يتم إضافتهم تلقائيًا إلى ندوة Zoom بعد إتمام الدفع."
              : "Paid Webinar Course — the share buttons hand out the course page link, not the Zoom registration link. Outsiders go through checkout, then we auto-register them in Zoom."}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Users className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto opacity-30 mb-3" />
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {isRTL ? "لا يوجد مسجلون بعد" : "No registrants yet"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {readOnly
                  ? isRTL
                    ? "سيظهر المسجلون هنا فور تسجيلهم عبر صفحة Zoom"
                    : "Registrants will appear here as they sign up on the Zoom page"
                  : isRTL
                    ? "شارك رابط التسجيل عبر واتساب لبدء استقبال التسجيلات"
                    : "Share the registration link via WhatsApp to start collecting sign-ups"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-surface-card)] border-b border-[var(--color-border)] z-10">
                <tr className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "الاسم" : "Name"}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "البريد" : "Email"}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "الهاتف" : "Phone"}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "الهوية" : "ID/Iqama"}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">SCFHS</th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "المصدر" : "Source"}
                  </th>
                  {data.coursePaid && (
                    <th className="px-4 py-2.5 text-start font-medium">
                      {isRTL ? "الدفع" : "Payment"}
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-start font-medium">
                    {isRTL ? "الحضور" : "Attended"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  // Highlight rows that haven't paid on a paid Webinar Course
                  // so the manager can quickly spot leads to follow up with.
                  const unpaidHighlight = data.coursePaid && !r.enrolled;
                  return (
                  <tr
                    key={r.id}
                    className={`border-b border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] ${
                      unpaidHighlight ? "bg-[#FFF7ED]/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-[var(--color-text-primary)]">
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)] text-xs">
                      {r.email}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)] text-xs">
                      {r.phone || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)] text-xs">
                      {r.nationalId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)] text-xs">
                      {r.scfhsNumber || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          r.source === "platform"
                            ? "bg-[#DBEAFE] text-[#1D4ED8]"
                            : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {r.source === "platform"
                          ? isRTL
                            ? "طالب مسجل"
                            : "Student"
                          : isRTL
                            ? "خارجي"
                            : "External"}
                      </span>
                    </td>
                    {data.coursePaid && (
                      <td className="px-4 py-2.5">
                        {r.enrolled ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                            {isRTL ? "مدفوع" : "Paid"}
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FED7AA] text-[#9A3412]">
                            {isRTL ? "غير مدفوع" : "Not paid"}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      {r.attended ? (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] text-xs font-medium">
                          <Check className="w-3.5 h-3.5" />
                          {r.attendedDurationMinutes > 0 &&
                            `${r.attendedDurationMinutes}m`}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)] text-xs">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
