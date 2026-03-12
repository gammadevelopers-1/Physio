"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi, courseAssistantsApi } from "@/lib/api";
import type { InstructorListItem, CreateCourseManagerData } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Loader2,
  ImagePlus,
  X,
  ShieldCheck,
  AlertTriangle,
  Users,
} from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4 | 5;

function StepIndicator({
  currentStep,
  t,
}: {
  currentStep: WizardStep;
  t: ReturnType<typeof useTranslations>;
}) {
  const steps = [
    { number: 1, label: t("createCourse.wizardStep1") },
    { number: 2, label: t("createCourse.wizardStep2") },
    { number: 3, label: t("createCourse.wizardStep3") },
    { number: 4, label: t("createCourse.wizardStep4") },
    { number: 5, label: t("createCourse.wizardStep5") },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;

        return (
          <div
            key={step.number}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "bg-[#22C55E] text-white"
                    : isCurrent
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#E5E7EB] text-[#9CA3AF]"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium text-center whitespace-nowrap hidden sm:block ${
                  isCurrent
                    ? "text-[#3B82F6]"
                    : isCompleted
                      ? "text-[#22C55E]"
                      : "text-[#9CA3AF]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mt-[-1rem] sm:mt-0 ${
                  currentStep > step.number ? "bg-[#22C55E]" : "bg-[#E5E7EB]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const CreateCourseContent = () => {
  const manager = useManagerProfile();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const tA = useTranslations("accessibility");
  const isRTL = locale === "ar";

  // Wizard step
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Instructor list
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  // Step 1: Basic Info
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [deliveryType, setDeliveryType] = useState<
    "zoom" | "onsite" | "blended"
  >("zoom");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Schedule & NELC Config
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [minimumHours, setMinimumHours] = useState("");
  const [cohort, setCohort] = useState("");
  const [nelcAccreditation, setNelcAccreditation] = useState(true);
  const [bilingualContent, setBilingualContent] = useState(true);
  const [wcagCompliant, setWcagCompliant] = useState(true);

  // Step 3: Instructor Assignment
  const [instructorId, setInstructorId] = useState("");

  // Step 4: TA Assignment (optional)
  const [availableTAs, setAvailableTAs] = useState<
    Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>
  >([]);
  const [loadingTAs, setLoadingTAs] = useState(true);
  const [selectedTAId, setSelectedTAId] = useState("");

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // NELC computed fields
  const courseClassification = useMemo(() => {
    if (!startDate || !endDate) return null;
    const days =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24);
    return days > 5 ? "long" : "short";
  }, [startDate, endDate]);

  const nelcCapacityLimit = useMemo(() => {
    if (!courseClassification) return null;
    return courseClassification === "long" ? 40 : 50;
  }, [courseClassification]);

  // Fetch instructors and TAs on mount
  useEffect(() => {
    courseManagerApi
      .getInstructors()
      .then((data) => setInstructors(data))
      .catch(() => toast.error("Failed to load instructors"))
      .finally(() => setLoadingInstructors(false));

    courseManagerApi
      .getAvailableTAs()
      .then((data) => setAvailableTAs(data))
      .catch(() => setAvailableTAs([]))
      .finally(() => setLoadingTAs(false));
  }, []);

  const handleThumbnailSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingThumbnail(true);
    try {
      const result = await courseManagerApi.uploadThumbnail(file);
      setThumbnailUrl(result.url);
      toast.success(t("createCourse.imageUploaded"));
    } catch {
      toast.error(t("createCourse.thumbnailError"));
      setThumbnailPreview(null);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const removeThumbnail = () => {
    setThumbnailUrl("");
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateStep = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
        if (!title.trim()) {
          toast.error(t("createCourse.titleRequired"));
          return false;
        }
        return true;
      case 2:
        return true; // Schedule fields are optional
      case 3:
        if (!instructorId) {
          toast.error(t("createCourse.instructorRequired"));
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (validateStep(currentStep) && currentStep < 5) {
      setCurrentStep((currentStep + 1) as WizardStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(3)) return;

    setSubmitting(true);
    try {
      const payload: CreateCourseManagerData = {
        title: title.trim(),
        deliveryType,
        instructorId,
      };
      if (titleAr.trim()) payload.titleAr = titleAr.trim();
      if (description.trim()) payload.description = description.trim();
      if (descriptionAr.trim()) payload.descriptionAr = descriptionAr.trim();
      if (thumbnailUrl) payload.thumbnail = thumbnailUrl;
      if (maxEnrollment) payload.maxEnrollment = Number(maxEnrollment);
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (cohort.trim()) payload.cohort = cohort.trim();

      const created = await courseManagerApi.createCourse(payload);

      // Assign TA if selected
      if (selectedTAId) {
        try {
          await courseAssistantsApi.assignTA(created.id, { userId: selectedTAId });
        } catch {
          toast.error(t("createCourse.taAssignError"));
        }
      }

      toast.success(t("createCourse.success"));
      router.push(`/${locale}/dashboard/manager/courses/${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("createCourse.error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInstructor = instructors.find((i) => i.id === instructorId);
  const selectedTA = availableTAs.find((ta) => ta.id === selectedTAId);

  const inputClass =
    "w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";
  const selectClass = `${inputClass} bg-white`;

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Back + Header */}
              <div className="mb-6">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("createCourse.backToCourses")}
                </button>
                <h1 className="text-2xl font-bold text-[#1F2937]">
                  {t("createCourse.title")}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">
                  {t("createCourse.subtitle")}
                </p>
              </div>

              {/* Step Indicator */}
              <StepIndicator currentStep={currentStep} t={t} />

              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                      {t("createCourse.basicInfo")}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="course-title" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.courseTitle")} *
                        </label>
                        <input
                          id="course-title"
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={t("createCourse.courseTitlePlaceholder")}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="course-title-ar" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.courseTitleAr")}
                        </label>
                        <input
                          id="course-title-ar"
                          type="text"
                          value={titleAr}
                          onChange={(e) => setTitleAr(e.target.value)}
                          placeholder={t(
                            "createCourse.courseTitleArPlaceholder",
                          )}
                          className={inputClass}
                          dir="rtl"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="course-description" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.description")}
                        </label>
                        <textarea
                          id="course-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t(
                            "createCourse.descriptionPlaceholder",
                          )}
                          rows={3}
                          className={`${inputClass} resize-none`}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="course-description-ar" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.descriptionAr")}
                        </label>
                        <textarea
                          id="course-description-ar"
                          value={descriptionAr}
                          onChange={(e) => setDescriptionAr(e.target.value)}
                          placeholder={t(
                            "createCourse.descriptionArPlaceholder",
                          )}
                          rows={3}
                          className={`${inputClass} resize-none`}
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label htmlFor="delivery-type" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.deliveryType")}
                        </label>
                        <select
                          id="delivery-type"
                          value={deliveryType}
                          onChange={(e) =>
                            setDeliveryType(
                              e.target.value as "zoom" | "onsite" | "blended",
                            )
                          }
                          className={selectClass}
                        >
                          <option value="zoom">
                            {t("createCourse.deliveryZoom")}
                          </option>
                          <option value="onsite">
                            {t("createCourse.deliveryOnsite")}
                          </option>
                          <option value="blended">
                            {t("createCourse.deliveryBlended")}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Course Image */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                      {t("createCourse.courseImage")}
                    </h2>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailSelect}
                      className="hidden"
                    />
                    {thumbnailPreview ? (
                      <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden border border-[#E5E7EB]">
                        <Image
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          fill
                          className="object-cover"
                        />
                        {uploadingThumbnail && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={removeThumbnail}
                          className="absolute top-2 right-2 p-1 bg-white/90 rounded-full text-[#6B7280] hover:bg-white hover:text-red-500 transition-colors"
                          aria-label={tA("removeImage")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-md h-48 border-2 border-dashed border-[#E5E7EB] rounded-lg flex flex-col items-center justify-center text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                      >
                        <ImagePlus className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">
                          {t("createCourse.uploadImage")}
                        </span>
                        <span className="text-xs mt-1">
                          {t("createCourse.imageHint")}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Schedule & NELC Config */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  {/* Schedule */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                      {t("createCourse.scheduleTitle")}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.startDate")}
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.endDate")}
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="max-enrollment" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.maxEnrollment")}
                        </label>
                        <input
                          id="max-enrollment"
                          type="number"
                          value={maxEnrollment}
                          onChange={(e) => setMaxEnrollment(e.target.value)}
                          placeholder="50"
                          min={1}
                          className={inputClass}
                        />
                        {nelcCapacityLimit &&
                          maxEnrollment &&
                          Number(maxEnrollment) > nelcCapacityLimit && (
                            <p className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              {t("createCourse.nelcCapacityWarning", {
                                limit: nelcCapacityLimit,
                                type: deliveryType,
                              })}
                            </p>
                          )}
                      </div>
                      <div>
                        <label htmlFor="minimum-hours" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.minimumHours")}
                        </label>
                        <input
                          id="minimum-hours"
                          type="number"
                          value={minimumHours}
                          onChange={(e) => setMinimumHours(e.target.value)}
                          placeholder="20"
                          min={1}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="cohort" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.cohort")}
                        </label>
                        <input
                          id="cohort"
                          type="text"
                          value={cohort}
                          onChange={(e) => setCohort(e.target.value)}
                          placeholder={t("createCourse.cohortPlaceholder")}
                          maxLength={100}
                          className={inputClass}
                        />
                        <p className="text-xs text-[#6B7280] mt-1">
                          {t("createCourse.cohortHint")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* NELC Configuration */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-5 h-5 text-[#6b4e24]" />
                      <h2 className="text-lg font-semibold text-[#1F2937]">
                        {t("createCourse.nelcConfig")}
                      </h2>
                    </div>

                    {/* Auto-computed NELC info */}
                    {courseClassification && (
                      <div className="mb-4 p-3 bg-[#FFF8E6] border border-[#BFDBFE] rounded-lg">
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-[#6B7280]">
                              {t("createCourse.nelcClassification")}:
                            </span>{" "}
                            <span className="font-medium text-[#1F2937]">
                              {courseClassification === "long"
                                ? t("createCourse.longCourse")
                                : t("createCourse.shortCourse")}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6B7280]">
                              {t("createCourse.nelcMaxCapacity")}:
                            </span>{" "}
                            <span className="font-medium text-[#1F2937]">
                              {nelcCapacityLimit}{" "}
                              {t("createCourse.nelcLearners")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* NELC Accreditation */}
                      <label className="flex items-center justify-between p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {t("createCourse.nelcAccreditation")}
                          </p>
                          <p className="text-xs text-[#6B7280] mt-0.5">
                            {t("createCourse.nelcAccreditationDesc")}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={nelcAccreditation}
                          onChange={(e) =>
                            setNelcAccreditation(e.target.checked)
                          }
                          className="w-5 h-5 rounded border-[#D1D5DB] text-[#a37f49] focus:ring-[#d4a520]"
                        />
                      </label>

                      {/* Bilingual Content */}
                      <label className="flex items-center justify-between p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {t("createCourse.bilingualContent")}
                          </p>
                          <p className="text-xs text-[#6B7280] mt-0.5">
                            {t("createCourse.bilingualContentDesc")}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={bilingualContent}
                          onChange={(e) =>
                            setBilingualContent(e.target.checked)
                          }
                          className="w-5 h-5 rounded border-[#D1D5DB] text-[#a37f49] focus:ring-[#d4a520]"
                        />
                      </label>

                      {/* WCAG Compliance */}
                      <label className="flex items-center justify-between p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {t("createCourse.wcagCompliant")}
                          </p>
                          <p className="text-xs text-[#6B7280] mt-0.5">
                            {t("createCourse.wcagCompliantDesc")}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={wcagCompliant}
                          onChange={(e) => setWcagCompliant(e.target.checked)}
                          className="w-5 h-5 rounded border-[#D1D5DB] text-[#a37f49] focus:ring-[#d4a520]"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Instructor Assignment */}
              {currentStep === 3 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.instructor")}
                  </h2>
                  <div>
                    <label htmlFor="instructor-select" className="block text-sm font-medium text-[#374151] mb-1">
                      {t("createCourse.selectInstructor")} *
                    </label>
                    <select
                      id="instructor-select"
                      value={instructorId}
                      onChange={(e) => setInstructorId(e.target.value)}
                      className={`max-w-md ${selectClass}`}
                      required
                    >
                      <option value="">
                        {loadingInstructors
                          ? t("createCourse.loadingInstructors")
                          : t("createCourse.chooseInstructor")}
                      </option>
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {[inst.firstName, inst.lastName]
                            .filter(Boolean)
                            .join(" ") || inst.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected instructor preview */}
                  {selectedInstructor && (
                    <div className="mt-4 p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg max-w-md">
                      <p className="text-sm font-medium text-[#1F2937]">
                        {[
                          selectedInstructor.firstName,
                          selectedInstructor.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {selectedInstructor.email}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: TA Assignment (Optional) */}
              {currentStep === 4 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-[#6b4e24]" />
                    <h2 className="text-lg font-semibold text-[#1F2937]">
                      {t("createCourse.taAssignment")}
                    </h2>
                  </div>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {t("createCourse.taAssignmentDesc")}
                  </p>

                  <div>
                    <label htmlFor="ta-select" className="block text-sm font-medium text-[#374151] mb-1">
                      {t("createCourse.selectTA")}
                    </label>
                    <select
                      id="ta-select"
                      value={selectedTAId}
                      onChange={(e) => setSelectedTAId(e.target.value)}
                      className={`max-w-md ${selectClass}`}
                    >
                      <option value="">
                        {loadingTAs
                          ? t("createCourse.loadingTAs")
                          : t("createCourse.chooseTA")}
                      </option>
                      {availableTAs.map((ta) => (
                        <option key={ta.id} value={ta.id}>
                          {[ta.firstName, ta.lastName]
                            .filter(Boolean)
                            .join(" ") || ta.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected TA preview */}
                  {selectedTA && (
                    <div className="mt-4 p-4 bg-[#FFF8E6] border border-[#E5E7EB] rounded-lg max-w-md flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1F2937]">
                          {[selectedTA.firstName, selectedTA.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          {selectedTA.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTAId("")}
                        className="p-1 text-[#6B7280] hover:text-red-500 transition-colors"
                        aria-label={tA("removeImage")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!selectedTAId && (
                    <p className="mt-3 text-xs text-[#9CA3AF]">
                      {t("createCourse.taSkipNote")}
                    </p>
                  )}
                </div>
              )}

              {/* Step 5: Review & Submit */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                      {t("createCourse.reviewTitle")}
                    </h2>
                    <p className="text-sm text-[#6B7280] mb-6">
                      {t("createCourse.reviewDescription")}
                    </p>

                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div className="border border-[#E5E7EB] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[#374151] mb-3">
                          {t("createCourse.basicInfo")}
                        </h3>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.courseTitle")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {title || "—"}
                            </dd>
                          </div>
                          {titleAr && (
                            <div>
                              <dt className="text-[#6B7280]">
                                {t("createCourse.courseTitleAr")}
                              </dt>
                              <dd className="font-medium text-[#1F2937]" dir="rtl">
                                {titleAr}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.deliveryType")}
                            </dt>
                            <dd className="font-medium text-[#1F2937] capitalize">
                              {deliveryType}
                            </dd>
                          </div>
                          {description && (
                            <div className="sm:col-span-2">
                              <dt className="text-[#6B7280]">
                                {t("createCourse.description")}
                              </dt>
                              <dd className="font-medium text-[#1F2937] line-clamp-2">
                                {description}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Schedule & NELC */}
                      <div className="border border-[#E5E7EB] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[#374151] mb-3">
                          {t("createCourse.scheduleTitle")} &{" "}
                          {t("createCourse.nelcConfig")}
                        </h3>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.startDate")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {startDate || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.endDate")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {endDate || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.maxEnrollment")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {maxEnrollment || "—"}
                            </dd>
                          </div>
                          {courseClassification && (
                            <div>
                              <dt className="text-[#6B7280]">
                                {t("createCourse.nelcClassification")}
                              </dt>
                              <dd className="font-medium text-[#1F2937]">
                                {courseClassification === "long"
                                  ? t("createCourse.longCourse")
                                  : t("createCourse.shortCourse")}{" "}
                                (max {nelcCapacityLimit})
                              </dd>
                            </div>
                          )}
                          <div className="sm:col-span-2 flex items-center gap-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${nelcAccreditation ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {nelcAccreditation ? "✓" : "✗"}{" "}
                              {t("createCourse.nelcAccreditation")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${bilingualContent ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {bilingualContent ? "✓" : "✗"}{" "}
                              {t("createCourse.bilingualContent")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${wcagCompliant ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {wcagCompliant ? "✓" : "✗"} WCAG 2.1 AA
                            </span>
                          </div>
                        </dl>
                      </div>

                      {/* Instructor */}
                      <div className="border border-[#E5E7EB] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[#374151] mb-3">
                          {t("createCourse.instructor")}
                        </h3>
                        {selectedInstructor ? (
                          <p className="text-sm font-medium text-[#1F2937]">
                            {[
                              selectedInstructor.firstName,
                              selectedInstructor.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ")}{" "}
                            ({selectedInstructor.email})
                          </p>
                        ) : (
                          <p className="text-sm text-[#6B7280]">—</p>
                        )}
                      </div>

                      {/* Teaching Assistant */}
                      <div className="border border-[#E5E7EB] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[#374151] mb-3">
                          {t("createCourse.taAssignment")}
                        </h3>
                        {selectedTA ? (
                          <p className="text-sm font-medium text-[#1F2937]">
                            {[selectedTA.firstName, selectedTA.lastName]
                              .filter(Boolean)
                              .join(" ")}{" "}
                            ({selectedTA.email})
                          </p>
                        ) : (
                          <p className="text-sm text-[#6B7280]">
                            {t("createCourse.noTASelected")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6">
                <button
                  type="button"
                  onClick={currentStep === 1 ? () => router.back() : goBack}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {currentStep === 1
                    ? t("createCourse.cancel")
                    : t("createCourse.back")}
                </button>

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t("createCourse.next")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t("createCourse.createButton")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateCourseContent;
