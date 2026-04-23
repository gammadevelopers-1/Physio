"use client";

import { useTranslations } from "next-intl";
import DatePicker from "@/components/ui/DatePicker";
import type { WizardState, WizardAction } from "./CreateCourseWizard";

interface Step2Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const Step2Schedule = ({ state, dispatch }: Step2Props) => {
  const t = useTranslations("instructorDashboard.createCourse");

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
        {t("wizardStep2")}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-[#374151] mb-1">
            {t("startDate")}
          </label>
          <DatePicker
            id="start-date"
            value={state.startDate}
            onChange={(v) =>
              dispatch({ type: "SET_FIELD", field: "startDate", value: v })
            }
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-[#374151] mb-1">
            {t("endDate")}
          </label>
          <DatePicker
            id="end-date"
            value={state.endDate}
            onChange={(v) =>
              dispatch({ type: "SET_FIELD", field: "endDate", value: v })
            }
            min={state.startDate || undefined}
          />
          {state.endDate && state.startDate && new Date(state.endDate) <= new Date(state.startDate) && (
            <p className="text-xs text-[#EF4444] mt-1">{t("endDateError")}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-[#374151] mb-1">
          {t("maxEnrollment")}
        </label>
        <p className="text-sm text-[#6B7280] bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg px-3 py-2.5 max-w-xs">
          {t("syncDefaultMax") || "Default: up to 2000 students"}
        </p>
      </div>
    </div>
  );
};

export default Step2Schedule;
