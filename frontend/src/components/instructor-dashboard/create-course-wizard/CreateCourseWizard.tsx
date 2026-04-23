"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { instructorApi } from "@/lib/api";
import WizardStepIndicator from "./WizardStepIndicator";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Schedule from "./Step2Schedule";
import Step3Modules from "./Step3Modules";
import Step4Review from "./Step4Review";

// ─── Types ──────────────────────────────────────────────────

export interface WizardModule {
  tempId: string;
  title: string;
  titleAr: string;
  type: string;
  durationMinutes: number | "";
}

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  // Step 1 - Basic Info
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  deliveryType: "zoom" | "onsite" | "blended" | "self-paced";
  thumbnail: string;
  thumbnailUploading: boolean;
  // Step 2 - Schedule
  maxEnrollment: number | "";
  startDate: string;
  endDate: string;
  // Step 3 - Modules
  modules: WizardModule[];
  // Meta
  saving: boolean;
}

export type WizardAction =
  | { type: "SET_FIELD"; field: string; value: unknown }
  | { type: "SET_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "ADD_MODULE"; module: WizardModule }
  | { type: "UPDATE_MODULE"; tempId: string; data: Partial<WizardModule> }
  | { type: "REMOVE_MODULE"; tempId: string }
  | { type: "REORDER_MODULES"; modules: WizardModule[] }
  | { type: "SET_SAVING"; saving: boolean };

const initialState: WizardState = {
  step: 1,
  title: "",
  titleAr: "",
  description: "",
  descriptionAr: "",
  deliveryType: "zoom",
  thumbnail: "",
  thumbnailUploading: false,
  maxEnrollment: "",
  startDate: "",
  endDate: "",
  modules: [],
  saving: false,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "ADD_MODULE":
      return { ...state, modules: [...state.modules, action.module] };
    case "UPDATE_MODULE":
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.tempId === action.tempId ? { ...m, ...action.data } : m
        ),
      };
    case "REMOVE_MODULE":
      return {
        ...state,
        modules: state.modules.filter((m) => m.tempId !== action.tempId),
      };
    case "REORDER_MODULES":
      return { ...state, modules: action.modules };
    case "SET_SAVING":
      return { ...state, saving: action.saving };
    default:
      return state;
  }
}

// ─── Component ──────────────────────────────────────────────

const CreateCourseWizard = () => {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard.createCourse");

  const isSelfPaced = state.deliveryType === "self-paced";

  const handleNext = () => {
    if (state.step === 1) {
      if (!state.title.trim()) {
        toast.error(t("titleRequired"));
        return;
      }
      if (state.thumbnailUploading) return;
      if (state.endDate && state.startDate && new Date(state.endDate) <= new Date(state.startDate)) {
        toast.error(t("endDateError"));
        return;
      }
    }
    if (state.step === 2) {
      if (state.endDate && state.startDate && new Date(state.endDate) <= new Date(state.startDate)) {
        toast.error(t("endDateError"));
        return;
      }
    }
    if (state.step < 4) {
      let nextStep = (state.step + 1) as 1 | 2 | 3 | 4;
      // Skip Step 2 (Schedule) for self-paced courses
      if (isSelfPaced && nextStep === 2) nextStep = 3;
      dispatch({ type: "SET_STEP", step: nextStep });
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      let prevStep = (state.step - 1) as 1 | 2 | 3 | 4;
      // Skip Step 2 (Schedule) for self-paced courses
      if (isSelfPaced && prevStep === 2) prevStep = 1;
      dispatch({ type: "SET_STEP", step: prevStep });
    } else {
      router.back();
    }
  };

  const handleCreate = async () => {
    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const courseData: Record<string, unknown> = {
        title: state.title.trim(),
        deliveryType: state.deliveryType,
      };
      if (state.titleAr.trim()) courseData.titleAr = state.titleAr.trim();
      if (state.description.trim()) courseData.description = state.description.trim();
      if (state.descriptionAr.trim()) courseData.descriptionAr = state.descriptionAr.trim();
      if (state.thumbnail) courseData.thumbnail = state.thumbnail;
      if (state.maxEnrollment) courseData.maxEnrollment = Number(state.maxEnrollment);
      if (state.startDate) courseData.startDate = state.startDate;
      if (state.endDate) courseData.endDate = state.endDate;

      const course = await instructorApi.createCourse(
        courseData as Parameters<typeof instructorApi.createCourse>[0]
      );

      // Add modules sequentially
      let modulesFailed = false;
      for (const mod of state.modules) {
        try {
          const moduleData: { title: string; type: string; titleAr?: string; durationMinutes?: number } = {
            title: mod.title.trim(),
            type: mod.type,
          };
          if (mod.titleAr.trim()) moduleData.titleAr = mod.titleAr.trim();
          if (mod.durationMinutes) moduleData.durationMinutes = Number(mod.durationMinutes);
          await instructorApi.addModule(course.id, moduleData);
        } catch {
          modulesFailed = true;
        }
      }

      if (modulesFailed) {
        toast.warning(t("modulesPartialError"));
      } else {
        toast.success(t("success"));
      }
      router.push(`/${locale}/dashboard/instructor/courses/${course.id}`);
    } catch {
      toast.error(t("error"));
      dispatch({ type: "SET_SAVING", saving: false });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("cancel")}
      </button>

      {/* Title */}
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">{t("title")}</h1>

      {/* Step Indicator */}
      <WizardStepIndicator currentStep={state.step} skipStep2={isSelfPaced} />

      {/* Step Content */}
      {state.step === 1 && <Step1BasicInfo state={state} dispatch={dispatch} />}
      {state.step === 2 && <Step2Schedule state={state} dispatch={dispatch} />}
      {state.step === 3 && <Step3Modules state={state} dispatch={dispatch} />}
      {state.step === 4 && (
        <Step4Review
          state={state}
          dispatch={dispatch}
          onSubmit={handleCreate}
        />
      )}

      {/* Navigation */}
      {state.step < 4 && (
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
          >
            {state.step === 1 ? t("cancel") : t("back")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={state.thumbnailUploading}
            className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {t("next")}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateCourseWizard;
