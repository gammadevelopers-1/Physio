"use client";

import { useTranslations } from "next-intl";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { instructorApi } from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import type { WizardState, WizardAction } from "./CreateCourseWizard";

interface Step1Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const Step1BasicInfo = ({ state, dispatch }: Step1Props) => {
  const t = useTranslations("instructorDashboard.createCourse");

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    dispatch({ type: "SET_FIELD", field: "thumbnailUploading", value: true });
    try {
      const result = await instructorApi.uploadThumbnail(file);
      dispatch({ type: "SET_FIELD", field: "thumbnail", value: result.url });
    } catch {
      toast.error(t("thumbnailError"));
    } finally {
      dispatch({ type: "SET_FIELD", field: "thumbnailUploading", value: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("basicInfo")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-[#374151] mb-1">
              {t("courseTitle")} *
            </label>
            <input
              id="course-title"
              type="text"
              value={state.title}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
            />
          </div>
          <div>
            <label htmlFor="course-title-ar" className="block text-sm font-medium text-[#374151] mb-1">
              {t("courseTitleAr")}
            </label>
            <input
              id="course-title-ar"
              type="text"
              value={state.titleAr}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "titleAr", value: e.target.value })}
              dir="rtl"
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="course-description" className="block text-sm font-medium text-[#374151] mb-1">
              {t("description")}
            </label>
            <textarea
              id="course-description"
              value={state.description}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none resize-none"
            />
          </div>
          <div>
            <label htmlFor="course-description-ar" className="block text-sm font-medium text-[#374151] mb-1">
              {t("descriptionAr")}
            </label>
            <textarea
              id="course-description-ar"
              value={state.descriptionAr}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "descriptionAr", value: e.target.value })}
              rows={4}
              dir="rtl"
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none resize-none"
            />
          </div>
        </div>

        {/* Delivery Type — per spec, this belongs in Step 1 */}
        <div className="mt-4">
          <label htmlFor="delivery-type" className="block text-sm font-medium text-[#374151] mb-1">
            {t("deliveryType")} *
          </label>
          <select
            id="delivery-type"
            value={state.deliveryType}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "deliveryType", value: e.target.value })
            }
            className="w-full max-w-xs px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none bg-white"
          >
            <option value="zoom">Zoom</option>
            <option value="onsite">On-site</option>
            <option value="blended">Blended</option>
            <option value="self-paced">{t("deliverySelfPaced")}</option>
          </select>
        </div>

        {/* Schedule fields for self-paced (since Step 2 is skipped) */}
        {state.deliveryType === "self-paced" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-[#374151] mb-1">
                {t("startDate")}
              </label>
              <DatePicker
                id="start-date"
                value={state.startDate}
                onChange={(v) => dispatch({ type: "SET_FIELD", field: "startDate", value: v })}
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-[#374151] mb-1">
                {t("endDate")}
              </label>
              <DatePicker
                id="end-date"
                value={state.endDate}
                onChange={(v) => dispatch({ type: "SET_FIELD", field: "endDate", value: v })}
                min={state.startDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {t("maxEnrollment")}
              </label>
              <p className="text-sm text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                {t("selfPacedUnlimited") || "Self-paced: unlimited enrollment"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("courseImage")}
        </h2>

        {state.thumbnail ? (
          <div className="relative w-full max-w-md">
            <img
              src={state.thumbnail}
              alt="Course thumbnail"
              className="w-full h-48 object-cover rounded-lg border border-[#E5E7EB]"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_FIELD", field: "thumbnail", value: "" })}
              className="absolute top-2 end-2 p-1.5 bg-white rounded-full shadow text-[#EF4444] hover:bg-[#FEE2E2] text-sm font-bold"
            >
              X
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-[#D1D5DB] rounded-lg cursor-pointer hover:border-[#3B82F6] hover:bg-[#F9FAFB] transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailUpload}
              disabled={state.thumbnailUploading}
            />
            {state.thumbnailUploading ? (
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-[#9CA3AF] mb-2" />
                <span className="text-sm text-[#6B7280]">{t("uploadImage")}</span>
                <span className="text-xs text-[#9CA3AF] mt-1">{t("imageHint")}</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
};

export default Step1BasicInfo;
