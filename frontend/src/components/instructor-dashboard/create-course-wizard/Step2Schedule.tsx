"use client";

import { useTranslations } from "next-intl";
import type { WizardState, WizardAction } from "./CreateCourseWizard";

interface Step2Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const Step2Schedule = ({ state, dispatch }: Step2Props) => {
  const t = useTranslations("instructorDashboard.createCourse");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
        {t("wizardStep2")}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1">
            {t("startDate")}
          </label>
          <input
            type="date"
            value={state.startDate}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "startDate", value: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1">
            {t("endDate")}
          </label>
          <input
            type="date"
            value={state.endDate}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "endDate", value: e.target.value })
            }
            min={state.startDate || undefined}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none ${
              state.endDate && state.startDate && new Date(state.endDate) <= new Date(state.startDate)
                ? "border-[#EF4444]"
                : "border-[#E5E7EB]"
            }`}
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
        <input
          type="number"
          value={state.maxEnrollment}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "maxEnrollment",
              value: e.target.value ? parseInt(e.target.value) : "",
            })
          }
          min={1}
          className="w-full max-w-xs px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
        />
      </div>
    </div>
  );
};

export default Step2Schedule;
