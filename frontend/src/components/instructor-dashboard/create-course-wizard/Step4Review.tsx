"use client";

import { useTranslations } from "next-intl";
import { Loader2, Pencil, Video, FileText, HelpCircle, Layers } from "lucide-react";
import type { WizardState, WizardAction } from "./CreateCourseWizard";

interface Step4Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onSubmit: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  mixed: <Layers className="w-4 h-4" />,
};

const deliveryLabels: Record<string, string> = {
  zoom: "Zoom",
  onsite: "On-site",
  blended: "Blended",
  "self-paced": "Self-paced",
};

const Step4Review = ({ state, dispatch, onSubmit }: Step4Props) => {
  const t = useTranslations("instructorDashboard.createCourse");

  const goToStep = (step: 1 | 2 | 3) => {
    dispatch({ type: "SET_STEP", step });
  };

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("reviewBasicInfo")}
          </h3>
          <button
            type="button"
            onClick={() => goToStep(1)}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("editStep")}
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("courseTitle")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">{state.title || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("courseTitleAr")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]" dir="rtl">
              {state.titleAr || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("description")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)] line-clamp-2">
              {state.description || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("descriptionAr")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)] line-clamp-2" dir="rtl">
              {state.descriptionAr || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("deliveryType")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {deliveryLabels[state.deliveryType]}
            </dd>
          </div>
        </dl>
        {state.thumbnail && (
          <div className="mt-3">
            <dt className="text-sm text-[var(--color-text-secondary)] mb-1">{t("courseImage")}</dt>
            <img
              src={state.thumbnail}
              alt="Course thumbnail"
              className="w-40 h-24 object-cover rounded-lg border border-[var(--color-border)]"
            />
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("reviewSchedule")}
          </h3>
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("editStep")}
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("startDate")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {state.startDate || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("endDate")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {state.endDate || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-secondary)]">{t("maxEnrollment")}</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {state.maxEnrollment || "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Modules */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("reviewModules")} ({state.modules.length})
          </h3>
          <button
            type="button"
            onClick={() => goToStep(3)}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("editStep")}
          </button>
        </div>
        {state.modules.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("noModulesAdded")}</p>
        ) : (
          <div className="space-y-2">
            {state.modules.map((mod, idx) => (
              <div
                key={mod.tempId}
                className="flex items-center gap-3 p-2.5 border border-[var(--color-border)] rounded-lg"
              >
                <span className="text-sm font-medium text-[var(--color-text-secondary)] w-6 text-center">
                  {idx + 1}
                </span>
                <span className="text-[var(--color-text-secondary)]">{typeIcons[mod.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                    {mod.title}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t(`moduleTypes.${mod.type}`)}
                    {mod.durationMinutes ? ` \u00B7 ${mod.durationMinutes} min` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
          className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
        >
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={state.saving}
          className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {state.saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {state.saving ? t("creatingCourse") : t("submit")}
        </button>
      </div>
    </div>
  );
};

export default Step4Review;
