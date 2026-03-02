"use client";

import { useTranslations } from "next-intl";
import { BadgeDollarSign } from "lucide-react";
import type { WizardState, WizardAction } from "./CreateCourseWizard";

interface Step2Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const Step2Schedule = ({ state, dispatch }: Step2Props) => {
  const t = useTranslations("instructorDashboard.createCourse");

  const inputClass =
    "w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none";

  return (
    <div className="space-y-4">
      {/* Schedule */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("wizardStep2")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-[#374151] mb-1">
              {t("startDate")}
            </label>
            <input
              id="start-date"
              type="date"
              value={state.startDate}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "startDate", value: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-[#374151] mb-1">
              {t("endDate")}
            </label>
            <input
              id="end-date"
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
          <label htmlFor="max-enrollment" className="block text-sm font-medium text-[#374151] mb-1">
            {t("maxEnrollment")}
          </label>
          <input
            id="max-enrollment"
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
            className={`max-w-xs ${inputClass}`}
          />
        </div>
      </div>

      {/* Pricing & CME */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-2 mb-4">
          <BadgeDollarSign className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-semibold text-[#1F2937]">
            {t("pricingTitle")}
          </h2>
        </div>

        {/* Free / Paid Toggle */}
        <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden mb-4 max-w-xs">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "SET_FIELD", field: "pricingType", value: "free" });
              dispatch({ type: "SET_FIELD", field: "price", value: "" });
            }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              state.pricingType === "free"
                ? "bg-[#22C55E] text-white"
                : "bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
            }`}
          >
            {t("pricingFree")}
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "SET_FIELD", field: "pricingType", value: "paid" })
            }
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              state.pricingType === "paid"
                ? "bg-[#3B82F6] text-white"
                : "bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
            }`}
          >
            {t("pricingPaid")}
          </button>
        </div>

        {/* Price Input (visible when Paid) */}
        {state.pricingType === "paid" && (
          <div className="mb-4">
            <label htmlFor="course-price" className="block text-sm font-medium text-[#374151] mb-1">
              {t("priceLabel")} *
            </label>
            <div className="relative max-w-xs">
              <input
                id="course-price"
                type="number"
                value={state.price}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "price",
                    value: e.target.value ? parseFloat(e.target.value) : "",
                  })
                }
                placeholder={t("pricePlaceholder")}
                step="0.01"
                min="1"
                className={`${inputClass} pr-14`}
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B7280]">
                SAR
              </span>
            </div>
          </div>
        )}

        {/* Enrollment Deadline & CME Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="enrollment-deadline" className="block text-sm font-medium text-[#374151] mb-1">
              {t("enrollmentDeadlineLabel")}
            </label>
            <input
              id="enrollment-deadline"
              type="datetime-local"
              value={state.enrollmentDeadline}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "enrollmentDeadline", value: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cme-hours" className="block text-sm font-medium text-[#374151] mb-1">
              {t("cmeHoursLabel")}
            </label>
            <input
              id="cme-hours"
              type="number"
              value={state.cmeHours}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "cmeHours",
                  value: e.target.value ? parseInt(e.target.value) : "",
                })
              }
              min={0}
              placeholder="0"
              className={`max-w-xs ${inputClass}`}
            />
          </div>
        </div>

        {/* CME Accredited Checkbox */}
        <label className="flex items-center justify-between p-3 mt-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
          <div>
            <p className="text-sm font-medium text-[#1F2937]">
              {t("cmeAccreditedLabel")}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {t("cmeAccreditedDesc")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={state.isCmeAccredited}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "isCmeAccredited", value: e.target.checked })
            }
            className="w-5 h-5 rounded border-[#D1D5DB] text-[#3B82F6] focus:ring-[#3B82F6]"
          />
        </label>
      </div>
    </div>
  );
};

export default Step2Schedule;
