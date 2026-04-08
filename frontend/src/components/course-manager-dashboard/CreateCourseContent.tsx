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
  ChevronDown,
  Search,
} from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4;

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
    { number: 4, label: t("createCourse.wizardStep5") },
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

function getInstructorStatusLabel(
  status: InstructorListItem["status"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case "available":
      return t("instructorsPage.status.available");
    case "busy":
      return t("instructorsPage.status.busy");
    case "overloaded":
      return t("instructorsPage.status.overloaded");
    case "on_leave":
      return t("instructorsPage.status.on_leave");
    default:
      return "";
  }
}

function getStatusColor(status: InstructorListItem["status"]): string {
  switch (status) {
    case "available":
      return "bg-green-500";
    case "busy":
      return "bg-amber-500";
    case "overloaded":
      return "bg-red-500";
    case "on_leave":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
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
    "zoom" | "onsite" | "blended" | "self-paced"
  >("zoom");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Schedule & NELC Config
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [cmeHours, setCmeHours] = useState("");
  const [cohort, setCohort] = useState("");
  // NELC compliance flags — always enabled, shown as static indicators
  const nelcAccreditation = true;
  const bilingualContent = true;
  const wcagCompliant = true;

  // Step 3: Team Assignment (Instructor + TA)
  const [instructorId, setInstructorId] = useState("");
  const [availableTAs, setAvailableTAs] = useState<
    Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>
  >([]);
  const [loadingTAs, setLoadingTAs] = useState(true);
  const [selectedTAId, setSelectedTAId] = useState("");
  const [instructorDropdownOpen, setInstructorDropdownOpen] = useState(false);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [taDropdownOpen, setTaDropdownOpen] = useState(false);
  const [taSearch, setTaSearch] = useState("");

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
    return 2000;
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
      case 2: {
        const today = new Date().toISOString().split("T")[0];
        if (!startDate) {
          toast.error(t("createCourse.startDate") + " is required");
          return false;
        }
        if (!endDate) {
          toast.error(t("createCourse.endDate") + " is required");
          return false;
        }
        if (!cmeHours) {
          toast.error(t("createCourse.cmeHours") + " is required");
          return false;
        }
        if (startDate < today) {
          toast.error(t("createCourse.startDate") + " must not be in the past");
          return false;
        }
        if (endDate <= startDate) {
          toast.error(t("createCourse.endDate") + " must be after " + t("createCourse.startDate"));
          return false;
        }
        return true;
      }
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

  const isSelfPaced = deliveryType === "self-paced";

  // Reset maxEnrollment when delivery type changes
  useEffect(() => {
    setMaxEnrollment("");
  }, [deliveryType]);

  const goNext = () => {
    if (validateStep(currentStep) && currentStep < 4) {
      const next = (currentStep + 1) as WizardStep;
      setCurrentStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      const prev = (currentStep - 1) as WizardStep;
      setCurrentStep(prev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

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
      if (cmeHours) {
        payload.cmeHours = Number(cmeHours);
        payload.isCmeAccredited = true;
      }
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "\u2014";
    try {
      return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDeliveryTypeLabel = (dt: string) => {
    switch (dt) {
      case "zoom":
        return t("createCourse.deliveryZoom");
      case "onsite":
        return t("createCourse.deliveryOnsite");
      case "blended":
        return t("createCourse.deliveryBlended");
      case "self-paced":
        return t("createCourse.deliverySelfPaced");
      default:
        return dt;
    }
  };

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
                              e.target.value as "zoom" | "onsite" | "blended" | "self-paced",
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
                          <option value="self-paced">
                            {t("createCourse.deliverySelfPaced")}
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
                          {t("createCourse.startDate")} *
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.endDate")} *
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || new Date().toISOString().split("T")[0]}
                          className={inputClass}
                          required
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
                          placeholder={isSelfPaced ? t("createCourse.unlimited") || "Unlimited" : "2000"}
                          min={1}
                          className={inputClass}
                        />
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          {isSelfPaced
                            ? t("createCourse.selfPacedNoLimit") || "Self-paced: unlimited enrollment. Leave empty for no limit."
                            : t("createCourse.syncDefaultLimit") || "Synchronous: default max 2000. Leave empty for default."}
                        </p>
                        {!isSelfPaced && maxEnrollment && Number(maxEnrollment) > 2000 && (
                            <p className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              {t("createCourse.syncCapacityNote") || "Exceeds default 2000 limit. Requires committee approval."}
                            </p>
                          )}
                      </div>
                      <div>
                        <label htmlFor="cme-hours" className="block text-sm font-medium text-[#374151] mb-1">
                          {t("createCourse.cmeHours")} *
                        </label>
                        <input
                          id="cme-hours"
                          type="number"
                          value={cmeHours}
                          onChange={(e) => setCmeHours(e.target.value)}
                          placeholder="5"
                          min={1}
                          required
                          className={inputClass}
                        />
                        <p className="text-xs text-[#9CA3AF] mt-1">{t("createCourse.cmeHoursHint")}</p>
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


                    <div className="space-y-3">
                      {[
                        { label: t("createCourse.nelcAccreditation"), desc: t("createCourse.nelcAccreditationDesc"), icon: "🏅" },
                        { label: t("createCourse.bilingualContent"), desc: t("createCourse.bilingualContentDesc"), icon: "🌐" },
                        { label: t("createCourse.wcagCompliant"), desc: t("createCourse.wcagCompliantDesc"), icon: "♿" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                          <div className="w-8 h-8 bg-[#DCFCE7] rounded-lg flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-[#22C55E]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1F2937]">{item.label}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-[#9CA3AF] mt-2">
                        {isRTL ? "هذه المتطلبات مطبقة تلقائياً على جميع الدورات." : "These requirements are automatically enforced for all courses."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Team Assignment (Instructor + TA) */}
              {currentStep === 3 && (() => {
                const statusDot: Record<string, string> = { available: "bg-[#22C55E]", busy: "bg-[#F59E0B]", overloaded: "bg-[#EF4444]" };
                const statusBadgeBg: Record<string, string> = { available: "bg-[#DCFCE7] text-[#065F46]", busy: "bg-[#FEF3C7] text-[#92400E]", overloaded: "bg-[#FEE2E2] text-[#991B1B]" };
                return (
                <div className="space-y-6">
                  {/* Instructor Section */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-1">
                      {t("createCourse.instructor")} *
                    </h2>
                    <p className="text-sm text-[#6B7280] mb-4">{t("createCourse.selectInstructor")}</p>

                    {loadingInstructors ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Selected display / trigger */}
                        <button
                          type="button"
                          onClick={() => setInstructorDropdownOpen(!instructorDropdownOpen)}
                          className="w-full flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-xl bg-white hover:border-[#3B82F6] transition-colors text-start"
                        >
                          {selectedInstructor ? (
                            <>
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {selectedInstructor.firstName && selectedInstructor.lastName
                                  ? `${selectedInstructor.firstName[0]}${selectedInstructor.lastName[0]}`.toUpperCase()
                                  : (selectedInstructor.email || "").substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1F2937] truncate">
                                  {[selectedInstructor.firstName, selectedInstructor.lastName].filter(Boolean).join(" ") || selectedInstructor.email}
                                </p>
                                <p className="text-[11px] text-[#6B7280] truncate">{selectedInstructor.email}</p>
                              </div>
                              {selectedInstructor.status && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadgeBg[selectedInstructor.status] || "bg-[#F3F4F6] text-[#6B7280]"}`}>
                                  {t(`instructorsPage.status.${selectedInstructor.status}` as Parameters<typeof t>[0])}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-[#9CA3AF]">{t("createCourse.chooseInstructor")}</span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-[#6B7280] ms-auto transition-transform ${instructorDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {/* Dropdown */}
                        {instructorDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-[#E5E7EB] rounded-xl shadow-lg max-h-[280px] overflow-hidden">
                            {/* Search */}
                            <div className="p-2 border-b border-[#E5E7EB]">
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                                <input
                                  type="text"
                                  value={instructorSearch}
                                  onChange={(e) => setInstructorSearch(e.target.value)}
                                  placeholder={isRTL ? "بحث..." : "Search..."}
                                  className="w-full ps-8 pe-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-[220px]">
                              {instructors
                                .filter((inst) => {
                                  if (!instructorSearch) return true;
                                  const q = instructorSearch.toLowerCase();
                                  const name = [inst.firstName, inst.lastName].filter(Boolean).join(" ").toLowerCase();
                                  return name.includes(q) || inst.email.toLowerCase().includes(q);
                                })
                                .map((inst) => {
                                  const name = [inst.firstName, inst.lastName].filter(Boolean).join(" ") || inst.email;
                                  const initials = inst.firstName && inst.lastName
                                    ? `${inst.firstName[0]}${inst.lastName[0]}`.toUpperCase()
                                    : name.substring(0, 2).toUpperCase();
                                  const isSelected = instructorId === inst.id;
                                  return (
                                    <button
                                      key={inst.id}
                                      type="button"
                                      onClick={() => { setInstructorId(inst.id); setInstructorDropdownOpen(false); setInstructorSearch(""); }}
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors ${isSelected ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[#1F2937] truncate">{name}</p>
                                        <p className="text-[11px] text-[#6B7280] truncate">{inst.email}</p>
                                      </div>
                                      {inst.status && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6B7280] flex-shrink-0">
                                          <span className={`w-2 h-2 rounded-full ${statusDot[inst.status] || "bg-[#9CA3AF]"}`} />
                                          {t(`instructorsPage.status.${inst.status}` as Parameters<typeof t>[0])}
                                        </span>
                                      )}
                                      {isSelected && <Check className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E5E7EB]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#F9FAFB] px-3 text-xs text-[#9CA3AF] uppercase tracking-wider">
                        {t("createCourse.taAssignment")}
                      </span>
                    </div>
                  </div>

                  {/* TA Section */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-[#6b4e24]" />
                      <h2 className="text-lg font-semibold text-[#1F2937]">
                        {t("createCourse.taAssignment")}
                      </h2>
                      <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                        {t("createCourse.optional")}
                      </span>
                    </div>

                    {selectedTA ? (
                      <div className="p-3 bg-[#FFF8E6] border border-[#FDE68A] rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#FEF3C7] flex items-center justify-center text-xs font-semibold text-[#92400E] flex-shrink-0">
                            {selectedTA.firstName && selectedTA.lastName
                              ? `${selectedTA.firstName[0]}${selectedTA.lastName[0]}`.toUpperCase()
                              : (selectedTA.email || "").substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1F2937]">{[selectedTA.firstName, selectedTA.lastName].filter(Boolean).join(" ")}</p>
                            <p className="text-[11px] text-[#6B7280]">{selectedTA.email}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedTAId("")} className="p-1.5 text-[#6B7280] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : loadingTAs ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-[#6b4e24] animate-spin" />
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setTaDropdownOpen(!taDropdownOpen)}
                          className="w-full flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-xl bg-white hover:border-[#D97706] transition-colors text-start"
                        >
                          <span className="text-sm text-[#9CA3AF]">{t("createCourse.noneSelected")}</span>
                          <ChevronDown className={`w-4 h-4 text-[#6B7280] ms-auto transition-transform ${taDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {taDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-[#E5E7EB] rounded-xl shadow-lg max-h-[280px] overflow-hidden">
                            <div className="p-2 border-b border-[#E5E7EB]">
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                                <input
                                  type="text"
                                  value={taSearch}
                                  onChange={(e) => setTaSearch(e.target.value)}
                                  placeholder={isRTL ? "بحث..." : "Search..."}
                                  className="w-full ps-8 pe-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-[220px]">
                              {availableTAs.length === 0 ? (
                                <p className="text-sm text-[#9CA3AF] text-center py-4">{isRTL ? "لا يوجد مساعدو تدريس" : "No TAs available"}</p>
                              ) : availableTAs
                                .filter((ta) => {
                                  if (!taSearch) return true;
                                  const q = taSearch.toLowerCase();
                                  const name = [ta.firstName, ta.lastName].filter(Boolean).join(" ").toLowerCase();
                                  return name.includes(q) || ta.email.toLowerCase().includes(q);
                                })
                                .map((ta) => {
                                  const name = [ta.firstName, ta.lastName].filter(Boolean).join(" ") || ta.email;
                                  const initials = ta.firstName && ta.lastName
                                    ? `${ta.firstName[0]}${ta.lastName[0]}`.toUpperCase()
                                    : name.substring(0, 2).toUpperCase();
                                  return (
                                    <button
                                      key={ta.id}
                                      type="button"
                                      onClick={() => { setSelectedTAId(ta.id); setTaDropdownOpen(false); setTaSearch(""); }}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-[#F9FAFB] transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[11px] font-semibold text-[#92400E] flex-shrink-0">
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[#1F2937] truncate">{name}</p>
                                        <p className="text-[11px] text-[#6B7280] truncate">{ta.email}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}

              {/* Step 4: Review & Submit */}
              {currentStep === 4 && (
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

                        {/* Thumbnail preview */}
                        {thumbnailPreview && (
                          <div className="relative w-full max-w-xs h-36 rounded-lg overflow-hidden border border-[#E5E7EB] mb-4">
                            <Image
                              src={thumbnailPreview}
                              alt="Course thumbnail"
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.courseTitle")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {title || "\u2014"}
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
                            <dd className="font-medium text-[#1F2937]">
                              {getDeliveryTypeLabel(deliveryType)}
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
                              {formatDate(startDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.endDate")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {formatDate(endDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.cmeHours")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {cmeHours || "\u2014"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#6B7280]">
                              {t("createCourse.maxEnrollment")}
                            </dt>
                            <dd className="font-medium text-[#1F2937]">
                              {maxEnrollment || "\u2014"}
                            </dd>
                          </div>
                          {cohort && (
                            <div>
                              <dt className="text-[#6B7280]">
                                {t("createCourse.cohort")}
                              </dt>
                              <dd className="font-medium text-[#1F2937]">
                                {cohort}
                              </dd>
                            </div>
                          )}
                          <div className="sm:col-span-2 flex items-center gap-4 flex-wrap">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${nelcAccreditation ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {nelcAccreditation ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.nelcAccreditation")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${bilingualContent ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {bilingualContent ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.bilingualContent")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${wcagCompliant ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {wcagCompliant ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.wcagCompliant")}
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#1F2937]">
                              {[
                                selectedInstructor.firstName,
                                selectedInstructor.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ")}{" "}
                              ({selectedInstructor.email})
                            </p>
                            {selectedInstructor.status && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-50 border border-[#E5E7EB]">
                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedInstructor.status)}`} />
                                {getInstructorStatusLabel(selectedInstructor.status, t)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-[#6B7280]">{"\u2014"}</p>
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

                {currentStep < 4 ? (
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
