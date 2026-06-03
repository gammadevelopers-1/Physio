"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

function isWithinBusinessHours(): boolean {
  // AST = UTC+3 (Arabia Standard Time, no DST)
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const astHours = (utcHours + 3) % 24;

  // Get AST day — if UTC time + 3 crosses midnight, day shifts forward
  const astDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const astDay = astDate.getUTCDay(); // 0=Sunday

  // Business days: Sunday(0) through Thursday(4)
  const isBusinessDay = astDay >= 0 && astDay <= 4;

  // Business hours: 9:00 AM to 6:00 PM
  const astTimeInMinutes = astHours * 60 + utcMinutes;
  const isBusinessTime =
    astTimeInMinutes >= 9 * 60 && astTimeInMinutes < 18 * 60;

  return isBusinessDay && isBusinessTime;
}

export default function BusinessHoursIndicator() {
  const t = useTranslations("supportPublicPage");
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOnline(isWithinBusinessHours());

    const interval = setInterval(() => {
      setIsOnline(isWithinBusinessHours());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  // Placeholder during SSR / first render to avoid hydration mismatch
  if (isOnline === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Clock className="w-4 h-4" />
        <span>{t("businessHoursSchedule")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
          }`}
        />
        <span
          className={`text-sm font-semibold ${
            isOnline ? "text-green-600" : "text-gray-500"
          }`}
        >
          {isOnline ? t("statusOnline") : t("statusOffline")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>{t("businessHoursSchedule")}</span>
      </div>
      {!isOnline && (
        <p className="text-sm text-gray-500 mt-1">{t("offlineMessage")}</p>
      )}
    </div>
  );
}
