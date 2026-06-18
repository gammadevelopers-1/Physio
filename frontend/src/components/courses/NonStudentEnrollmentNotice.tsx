"use client";

import { Info, Mail, GraduationCap } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface NonStudentEnrollmentNoticeProps {
  /** The role label shown in the notice body (e.g. "Finance Manager"). */
  roleLabel: string;
  /** Show the "Switch to Student" button only if the user actually has the
   *  STUDENT role available — single-role accounts can't switch. */
  canSwitchToStudent: boolean;
  /** Where to find us. Pulled from system settings at the page level. */
  supportEmail?: string;
}

const NonStudentEnrollmentNotice = ({
  roleLabel,
  canSwitchToStudent,
  supportEmail = "enroll@physioguidance.org",
}: NonStudentEnrollmentNoticeProps) => {
  const t = useTranslations("nonStudentNotice");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { refreshUser } = useAuth();
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      await authApi.switchRole("STUDENT");
      await refreshUser();
      toast.success(t("switchedToast"));
      // Hard reload so the entire app state (sidebar, dashboards, gates)
      // re-renders against the new active role.
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("switchError"));
      setSwitching(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4"
      dir={isRTL ? "rtl" : "ltr"}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#1E3A8A] mb-1">
            {t("title")}
          </h3>
          <p className="text-sm text-[#1E40AF] leading-relaxed">
            {t("body", { role: roleLabel })}
          </p>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              {t("contactCta")}
            </a>

            {canSwitchToStudent && (
              <button
                type="button"
                onClick={handleSwitch}
                disabled={switching}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#BFDBFE] hover:bg-[#EFF6FF] text-[#1E3A8A] text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <GraduationCap className="w-4 h-4" aria-hidden="true" />
                {switching ? t("switching") : t("switchToStudent")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NonStudentEnrollmentNotice;
