"use client";

import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const t = useTranslations("studentDashboard");

  if (isOnline) return null;

  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-sm text-[#92400E]">
      <WifiOff className="w-5 h-5 flex-shrink-0" />
      <p>{t("offline.message")}</p>
    </div>
  );
};

export default OfflineBanner;
