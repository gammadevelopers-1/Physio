"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import HelpCenterManager from "./HelpCenterManager";

const KnowledgeBaseContent = () => {
  const t = useTranslations("supportDashboard");
  const { user } = useAuth();
  const profile = useSupportProfile();

  // Agents see the Help Center for self-service reference while talking
  // to customers — they can browse and preview but not author. Editing
  // is reserved for supervisors and admins.
  const canEdit =
    user?.supportSubRole === "supervisor" ||
    !!user?.roles?.includes("ADMIN") ||
    !!user?.roles?.includes("SUPER_ADMIN");

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("kbPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {canEdit
                      ? t("kbPage.subtitle")
                      : t("kbPage.agentSubtitle")}
                  </p>
                </div>
                {!canEdit && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium whitespace-nowrap">
                    {t("kbPage.viewOnlyBadge")}
                  </span>
                )}
              </div>

              <HelpCenterManager canEdit={canEdit} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default KnowledgeBaseContent;
