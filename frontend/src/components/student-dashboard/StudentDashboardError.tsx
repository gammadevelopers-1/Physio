"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw } from "lucide-react";

interface StudentDashboardErrorProps {
  message?: string;
  onRetry: () => void;
}

const StudentDashboardError = ({
  message,
  onRetry,
}: StudentDashboardErrorProps) => {
  const t = useTranslations("studentDashboard");

  return (
    <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-[#FEE2E2] rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-[#EF4444]" />
      </div>
      <h3 className="text-lg font-semibold text-[#991B1B] mb-2">
        {t("error.title")}
      </h3>
      <p className="text-sm text-[#DC2626] mb-4 max-w-md">
        {message || t("error.message")}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#EF4444] rounded-lg hover:bg-[#DC2626] transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        {t("error.retry")}
      </button>
    </div>
  );
};

export default StudentDashboardError;
