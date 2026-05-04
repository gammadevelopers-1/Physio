"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Copy, MoreVertical, Check } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";

interface Invite {
  id: string;
  email: string;
  status: "sent" | "accepted" | "pending";
}

// Mock invites data
const mockInvitesData: Invite[] = [
  {
    id: "inv-1",
    email: "olivia@untitledui.com",
    status: "sent",
  },
  {
    id: "inv-2",
    email: "phoenix@untitledui.com",
    status: "sent",
  },
  {
    id: "inv-3",
    email: "lana@untitledui.com",
    status: "sent",
  },
];

// Mock referral code
const referralCode = "Fazw3AO9oOi2qAWkuujmdm2UjxIKG";

const InviteFriendsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const invites = mockInvitesData;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock send invite functionality
    if (email) {
      setEmail("");
    }
  };

  const getStatusLabel = (status: Invite["status"]) => {
    switch (status) {
      case "sent":
        return t("inviteFriends.statusSent");
      case "accepted":
        return t("inviteFriends.statusAccepted");
      case "pending":
        return t("inviteFriends.statusPending");
      default:
        return status;
    }
  };

  const getStatusStyles = (status: Invite["status"]) => {
    switch (status) {
      case "sent":
        return "text-[#15803D] bg-[#15803D]/10";
      case "accepted":
        return "text-[#15803D] bg-[#15803D]/10";
      case "pending":
        return "text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]";
      default:
        return "text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]";
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1
                className={`text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                {t("inviteFriends.title")}
              </h1>

              {/* Invite Friends Section */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {/* Send Invite Card */}
                <div
                  className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 sm:p-6 mb-6"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Paper Airplane Icon */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4">
                      <Image
                        src="/student_dashboard/send 1.svg"
                        alt={t("inviteFriends.sendInvite")}
                        width={80}
                        height={80}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Title and Description */}
                    <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                      {t("inviteFriends.sendAnInvite")}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 max-w-md">
                      {t("inviteFriends.sendDescription")}
                    </p>

                    {/* Email Input and Send Button */}
                    <form
                      onSubmit={handleSendInvite}
                      className="w-full max-w-md mb-4"
                    >
                      <label
                        className={`block text-sm text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : "text-left"}`}
                      >
                        {t("inviteFriends.email")}
                      </label>
                      <div
                        className={`flex flex-col sm:flex-row gap-2 ${isRTL ? "sm:flex-row-reverse" : ""}`}
                      >
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("inviteFriends.emailPlaceholder")}
                          className={`flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                        />
                        <button
                          type="submit"
                          className="px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                          {t("inviteFriends.sendInvite")}
                        </button>
                      </div>
                    </form>

                    {/* Referral Code */}
                    <div
                      className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full max-w-md ${isRTL ? "sm:flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`flex-1 px-4 py-2.5 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] truncate w-full sm:w-auto ${isRTL ? "text-right" : "text-left"}`}
                      >
                        {referralCode}...
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className={`flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors whitespace-nowrap ${isRTL ? "flex-row-reverse" : ""}`}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-[#16A34A]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copied
                          ? t("inviteFriends.copied")
                          : t("inviteFriends.copy")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Invites List */}
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <h3
                    className={`text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-4 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("inviteFriends.invites")}
                  </h3>

                  {invites.length === 0 ? (
                    <p
                      className={`text-sm text-[var(--color-text-secondary)] ${isRTL ? "text-right" : ""}`}
                    >
                      {t("inviteFriends.noInvites")}
                    </p>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[var(--color-border)]">
                              <th
                                className={`py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}
                              >
                                {t("inviteFriends.emailAddress")}
                              </th>
                              <th
                                className={`py-3 px-4 text-sm font-medium text-[var(--color-text-primary)] ${isRTL ? "text-left" : "text-right"}`}
                              >
                                <span
                                  className={`inline-flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}
                                >
                                  {t("inviteFriends.status")}
                                  <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M4 6L8 10L12 6"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              </th>
                              <th className="py-3 px-4 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {invites.map((invite) => (
                              <tr
                                key={invite.id}
                                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-border-subtle)] transition-colors"
                              >
                                <td
                                  className={`py-4 px-4 text-sm text-[var(--color-text-primary)] ${isRTL ? "text-right" : "text-left"}`}
                                >
                                  {invite.email}
                                </td>
                                <td
                                  className={`py-4 px-4 ${isRTL ? "text-left" : "text-right"}`}
                                >
                                  <span
                                    className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusStyles(invite.status)}`}
                                  >
                                    {getStatusLabel(invite.status)}
                                  </span>
                                </td>
                                <td className="py-4 px-4 relative">
                                  <button
                                    onClick={() => toggleMenu(invite.id)}
                                    className="p-1 hover:bg-[var(--color-border-subtle)] rounded transition-colors"
                                    aria-label={t("inviteFriends.moreOptions")}
                                  >
                                    <MoreVertical className="w-5 h-5 text-[var(--color-text-secondary)]" />
                                  </button>
                                  {openMenuId === invite.id && (
                                    <div
                                      className={`absolute top-full ${isRTL ? "left-0" : "right-0"} mt-1 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 min-w-[140px]`}
                                    >
                                      <button
                                        className={`w-full px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        {t("inviteFriends.resend")}
                                      </button>
                                      <button
                                        className={`w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        {t("inviteFriends.cancel")}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-3">
                        {invites.map((invite) => (
                          <div
                            key={invite.id}
                            className="border border-[var(--color-border)] rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[var(--color-text-secondary)] truncate mb-1">
                                  {invite.email}
                                </p>
                                <span
                                  className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusStyles(invite.status)}`}
                                >
                                  {getStatusLabel(invite.status)}
                                </span>
                              </div>
                              <div className="relative">
                                <button
                                  onClick={() => toggleMenu(invite.id)}
                                  className="p-1 hover:bg-[var(--color-border-subtle)] rounded transition-colors"
                                  aria-label={t("inviteFriends.moreOptions")}
                                >
                                  <MoreVertical className="w-5 h-5 text-[var(--color-text-secondary)]" />
                                </button>
                                {openMenuId === invite.id && (
                                  <div
                                    className={`absolute top-full ${isRTL ? "left-0" : "right-0"} mt-1 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 min-w-[140px]`}
                                  >
                                    <button
                                      className={`w-full px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                      onClick={() => setOpenMenuId(null)}
                                    >
                                      {t("inviteFriends.resend")}
                                    </button>
                                    <button
                                      className={`w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                      onClick={() => setOpenMenuId(null)}
                                    >
                                      {t("inviteFriends.cancel")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InviteFriendsContent;
