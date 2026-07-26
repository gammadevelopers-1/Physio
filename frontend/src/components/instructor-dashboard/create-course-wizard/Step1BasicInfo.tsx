"use client";

import { useTranslations } from "next-intl";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { instructorApi } from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/ui/Select";
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
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          {t("basicInfo")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("courseTitle")} *
            </label>
            <input
              id="course-title"
              type="text"
              value={state.title}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-[var(--color-input-focus)] outline-none"
            />
          </div>
          <div>
            <label htmlFor="course-title-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("courseTitleAr")}
            </label>
            <input
              id="course-title-ar"
              type="text"
              value={state.titleAr}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "titleAr", value: e.target.value })}
              dir="rtl"
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-[var(--color-input-focus)] outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="course-description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("description")}
            </label>
            <textarea
              id="course-description"
              value={state.description}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-[var(--color-input-focus)] outline-none resize-none"
            />
          </div>
          <div>
            <label htmlFor="course-description-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("descriptionAr")}
            </label>
            <textarea
              id="course-description-ar"
              value={state.descriptionAr}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "descriptionAr", value: e.target.value })}
              rows={4}
              dir="rtl"
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-[var(--color-input-focus)] outline-none resize-none"
            />
          </div>
        </div>

        {/* Delivery Type — per spec, this belongs in Step 1 */}
        <div className="mt-4">
          <label htmlFor="delivery-type" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            {t("deliveryType")} *
          </label>
          <Select
            value={state.deliveryType}
            onChange={(v) =>
              dispatch({ type: "SET_FIELD", field: "deliveryType", value: v })
            }
            className="w-full max-w-xs"
            options={[
              { value: "zoom", label: "Zoom" },
              { value: "onsite", label: "On-site" },
              { value: "blended", label: "Blended" },
              { value: "self-paced", label: t("deliverySelfPaced") },
              { value: "webinar", label: t("deliveryWebinar") },
            ]}
          />
          {state.deliveryType === "webinar" && (
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] max-w-xl">
              {t("deliveryWebinarHint")}
            </p>
          )}
        </div>

        {/* Schedule fields for self-paced (since Step 2 is skipped) */}
        {state.deliveryType === "self-paced" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("startDate")}
              </label>
              <DatePicker
                id="start-date"
                value={state.startDate}
                onChange={(v) => dispatch({ type: "SET_FIELD", field: "startDate", value: v })}
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("maxEnrollment")}
              </label>
              <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
                {t("selfPacedUnlimited") || "Self-paced: unlimited enrollment"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          {t("courseImage")}
        </h2>

        {state.thumbnail ? (
          <div className="relative w-full max-w-md">
            <img
              src={state.thumbnail}
              alt="Course thumbnail"
              className="w-full h-48 object-cover rounded-lg border border-[var(--color-border)]"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_FIELD", field: "thumbnail", value: "" })}
              className="absolute top-2 end-2 p-1.5 bg-[var(--color-surface-card)] rounded-full shadow text-[#EF4444] hover:bg-[#FEE2E2] text-sm font-bold"
            >
              X
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailUpload}
              disabled={state.thumbnailUploading}
            />
            {state.thumbnailUploading ? (
              <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-[var(--color-text-secondary)] mb-2" />
                <span className="text-sm text-[var(--color-text-secondary)]">{t("uploadImage")}</span>
                <span className="text-xs text-[var(--color-text-secondary)] mt-1">{t("imageHint")}</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
};

export default Step1BasicInfo;
