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
import DatePicker from "@/components/ui/DatePicker";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { fromRiyadhLocal } from "@/lib/riyadh-time";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { normalizeAndValidateUrl } from "@/lib/url-validation";
import { useCalendarPreference } from "@/contexts/CalendarContext";

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
    { number: 2, label: t("createCourse.wizardStepContent") },
    { number: 3, label: t("createCourse.wizardStep2") },
    { number: 4, label: t("createCourse.wizardStep3") },
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
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium text-center whitespace-nowrap hidden sm:block ${
                  isCurrent
                    ? "text-[var(--color-primary)]"
                    : isCompleted
                      ? "text-[#22C55E]"
                      : "text-[var(--color-text-secondary)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mt-[-1rem] sm:mt-0 ${
                  currentStep > step.number ? "bg-[#22C55E]" : "bg-[var(--color-border)]"
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
  const tToasts = useTranslations("toasts");
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();

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

  // Step 2: Content Details
  const [overview, setOverview] = useState("");
  const [overviewAr, setOverviewAr] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectivesAr, setObjectivesAr] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [featuresAr, setFeaturesAr] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [targetAudienceAr, setTargetAudienceAr] = useState<string[]>([]);
  const [requirements, setRequirements] = useState("");
  const [requirementsAr, setRequirementsAr] = useState("");
  const [notices, setNotices] = useState("");
  const [noticesAr, setNoticesAr] = useState("");
  // FAQs — only rendered for zoom (online) courses on the student detail
  // page. Each item is bilingual; missing translations fall back to the
  // counterpart locale at render time.
  type FaqDraft = { question: string; questionAr: string; answer: string; answerAr: string };
  const [faqs, setFaqs] = useState<FaqDraft[]>([]);

  // Step 3: Schedule & Pricing
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [cmeHours, setCmeHours] = useState("");
  const [cohort, setCohort] = useState("");
  const [accreditationNumber, setAccreditationNumber] = useState("");
  const [nelcReviewLink, setNelcReviewLink] = useState("");
  const [nelcReviewLinkError, setNelcReviewLinkError] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [venue, setVenue] = useState("");
  const [venueAr, setVenueAr] = useState("");
  const [enrollmentDeadline, setEnrollmentDeadline] = useState("");
  const [language, setLanguage] = useState("en");
  const [showContents, setShowContents] = useState(true);
  const [visibleOnPublicSite, setVisibleOnPublicSite] = useState(true);
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
      .catch(() => toast.error(tToasts("failedLoadInstructors")))
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
        // Content Details — all optional
        return true;
      case 3: {
        const today = new Date().toISOString().split("T")[0];
        if (!startDate) {
          toast.error(t("createCourse.startDate") + " is required");
          return false;
        }
        if (!endDate) {
          toast.error(t("createCourse.endDate") + " is required");
          return false;
        }
        if (Number(price) > 0 && !cmeHours) {
          toast.error(t("createCourse.cmeHours") + " is required");
          return false;
        }
        if (startDate < today) {
          toast.error(t("createCourse.startDate") + " must not be in the past");
          return false;
        }
        // Allow same-day courses (endDate === startDate) — single-session
        // workshops are common. Only reject when end is strictly before start.
        if (endDate < startDate) {
          toast.error(t("createCourse.endDate") + " cannot be before " + t("createCourse.startDate"));
          return false;
        }
        return true;
      }
      case 4:
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
    if (validateStep(currentStep) && currentStep < 5) {
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
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;

    // NELC evaluation link — optional, but if filled must be a valid URL.
    const nelcLinkResult = normalizeAndValidateUrl(nelcReviewLink);
    if (!nelcLinkResult.valid) {
      setNelcReviewLinkError(t("createCourse.nelcReviewLinkInvalid"));
      toast.error(t("createCourse.nelcReviewLinkInvalid"));
      return;
    }
    setNelcReviewLinkError(null);

    const cleanArray = (arr: string[]) => arr.filter(s => s.trim()).map(s => s.trim());

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
      if (accreditationNumber.trim()) payload.accreditationNumber = accreditationNumber.trim();
      if (nelcLinkResult.normalized) payload.nelcReviewLink = nelcLinkResult.normalized;

      // Content Details fields
      if (overview.trim()) payload.overview = overview.trim();
      if (overviewAr.trim()) payload.overviewAr = overviewAr.trim();
      const objList = cleanArray(objectives);
      if (objList.length) payload.objectives = objList;
      const objListAr = cleanArray(objectivesAr);
      if (objListAr.length) payload.objectivesAr = objListAr;
      const featList = cleanArray(features);
      if (featList.length) payload.features = featList;
      const featListAr = cleanArray(featuresAr);
      if (featListAr.length) payload.featuresAr = featListAr;
      const taList = cleanArray(targetAudience);
      if (taList.length) payload.targetAudience = taList;
      const taListAr = cleanArray(targetAudienceAr);
      if (taListAr.length) payload.targetAudienceAr = taListAr;
      if (requirements.trim()) payload.requirements = requirements.trim();
      if (requirementsAr.trim()) payload.requirementsAr = requirementsAr.trim();
      if (notices.trim()) payload.notices = notices.trim();
      if (noticesAr.trim()) payload.noticesAr = noticesAr.trim();
      // Only persist FAQs for zoom courses; drop empty rows.
      if (deliveryType === 'zoom') {
        const cleanedFaqs = faqs
          .map((f) => ({
            question: f.question.trim(),
            questionAr: f.questionAr.trim(),
            answer: f.answer.trim(),
            answerAr: f.answerAr.trim(),
          }))
          .filter((f) => (f.question || f.questionAr) && (f.answer || f.answerAr));
        if (cleanedFaqs.length) payload.faqs = cleanedFaqs;
      }

      // Pricing & venue fields
      if (venue.trim()) payload.venue = venue.trim();
      if (venueAr.trim()) payload.venueAr = venueAr.trim();
      if (price) payload.price = Number(price);
      // Convert the picker's local "YYYY-MM-DDTHH:mm" Riyadh string to a
      // proper UTC ISO so the backend's `new Date()` parses the exact
      // moment intended (otherwise it would treat the value as the
      // runtime's local zone — usually UTC — and close enrollment hours
      // earlier than the manager picked).
      if (enrollmentDeadline) {
        payload.enrollmentDeadline = fromRiyadhLocal(enrollmentDeadline);
      }
      if (language !== 'en') payload.language = language;
      // Only send showContents for self-paced/blended courses
      if (deliveryType === 'self-paced' || deliveryType === 'blended') {
        payload.showContents = showContents;
      }
      payload.visibleOnPublicSite = visibleOnPublicSite;

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
    "w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]";
  const selectClass = `${inputClass} bg-[var(--color-surface-card)]`;

  const formatDate = (dateStr: string) => {
    return formatDateHijri(dateStr, calendarFormat, { locale });
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

      <div className="bg-[var(--color-surface-page)] min-h-screen">
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
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {t("createCourse.backToCourses")}
                </button>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("createCourse.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("createCourse.subtitle")}
                </p>
              </div>

              {/* Step Indicator */}
              <StepIndicator currentStep={currentStep} t={t} />

              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      {t("createCourse.basicInfo")}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="course-title" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <label htmlFor="course-title-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <label htmlFor="course-description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <label htmlFor="course-description-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <label htmlFor="delivery-type" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
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
                      <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden border border-[var(--color-border)]">
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
                          className="absolute top-2 right-2 p-1 bg-[var(--color-surface-card)]/90 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] hover:text-red-500 transition-colors"
                          aria-label={tA("removeImage")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-md h-48 border-2 border-dashed border-[var(--color-border)] rounded-lg flex flex-col items-center justify-center text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
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

              {/* Step 2: Content Details */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      {t("createCourse.wizardStepContent")}
                    </h2>
                    <div className="space-y-4">
                      {/* Overview */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsOverviewEn")}</label>
                        <RichTextEditor
                          value={overview}
                          onChange={setOverview}
                          placeholder={t("createCourse.courseOverviewPlaceholder")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsOverviewAr")}</label>
                        <RichTextEditor
                          value={overviewAr}
                          onChange={setOverviewAr}
                          placeholder="..."
                          dir="rtl"
                        />
                      </div>

                      {/* Objectives */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsObjectivesEn")}</label>
                        {objectives.map((obj, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={obj}
                              onChange={(e) => {
                                const next = [...objectives];
                                next[i] = e.target.value;
                                setObjectives(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              placeholder={`${t("createCourse.objectivePlaceholder")} ${i + 1}`}
                            />
                            <button type="button" onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setObjectives([...objectives, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addObjective")}</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsObjectivesAr")}</label>
                        {objectivesAr.map((obj, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={obj}
                              onChange={(e) => {
                                const next = [...objectivesAr];
                                next[i] = e.target.value;
                                setObjectivesAr(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              dir="rtl"
                              placeholder={`${i + 1}`}
                            />
                            <button type="button" onClick={() => setObjectivesAr(objectivesAr.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setObjectivesAr([...objectivesAr, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addObjective")}</button>
                      </div>

                      {/* Features */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsFeaturesEn")}</label>
                        {features.map((feat, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={feat}
                              onChange={(e) => {
                                const next = [...features];
                                next[i] = e.target.value;
                                setFeatures(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              placeholder={`${t("createCourse.featurePlaceholder")} ${i + 1}`}
                            />
                            <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setFeatures([...features, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addFeature")}</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsFeaturesAr")}</label>
                        {featuresAr.map((feat, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={feat}
                              onChange={(e) => {
                                const next = [...featuresAr];
                                next[i] = e.target.value;
                                setFeaturesAr(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              dir="rtl"
                              placeholder={`${i + 1}`}
                            />
                            <button type="button" onClick={() => setFeaturesAr(featuresAr.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setFeaturesAr([...featuresAr, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addFeature")}</button>
                      </div>

                      {/* Target Audience */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsTargetAudienceEn")}</label>
                        {targetAudience.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => {
                                const next = [...targetAudience];
                                next[i] = e.target.value;
                                setTargetAudience(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              placeholder={`${t("createCourse.audiencePlaceholder")} ${i + 1}`}
                            />
                            <button type="button" onClick={() => setTargetAudience(targetAudience.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setTargetAudience([...targetAudience, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addAudience")}</button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsTargetAudienceAr")}</label>
                        {targetAudienceAr.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => {
                                const next = [...targetAudienceAr];
                                next[i] = e.target.value;
                                setTargetAudienceAr(next);
                              }}
                              className="flex-1 rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm"
                              dir="rtl"
                              placeholder={`${i + 1}`}
                            />
                            <button type="button" onClick={() => setTargetAudienceAr(targetAudienceAr.filter((_, j) => j !== i))}
                              className="text-red-500 text-sm px-2">{"\u2715"}</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setTargetAudienceAr([...targetAudienceAr, ""])}
                          className="text-sm text-blue-600 hover:underline">{t("createCourse.addAudience")}</button>
                      </div>

                      {/* Requirements — only for onsite/blended */}
                      {(deliveryType === 'onsite' || deliveryType === 'blended') && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsRequirementsEn")}</label>
                            <textarea
                              value={requirements}
                              onChange={(e) => setRequirements(e.target.value)}
                              rows={3}
                              className={`${inputClass} resize-none`}
                              placeholder={t("createCourse.requirementsPlaceholder")}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsRequirementsAr")}</label>
                            <textarea
                              value={requirementsAr}
                              onChange={(e) => setRequirementsAr(e.target.value)}
                              rows={3}
                              className={`${inputClass} resize-none`}
                              dir="rtl"
                              placeholder="..."
                            />
                          </div>
                        </>
                      )}

                      {/* Notices */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsNoticesEn")}</label>
                        <textarea
                          value={notices}
                          onChange={(e) => setNotices(e.target.value)}
                          rows={3}
                          className={`${inputClass} resize-none`}
                          placeholder={t("createCourse.noticesPlaceholder")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsNoticesAr")}</label>
                        <textarea
                          value={noticesAr}
                          onChange={(e) => setNoticesAr(e.target.value)}
                          rows={3}
                          className={`${inputClass} resize-none`}
                          dir="rtl"
                          placeholder="..."
                        />
                      </div>

                      {/* FAQs — zoom (online) courses only */}
                      {deliveryType === 'zoom' && (
                        <div className="pt-3 border-t border-[var(--color-border)]">
                          <div className="flex items-baseline justify-between mb-2">
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {t("createCourse.faqsTitle")}
                            </h4>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("createCourse.faqsHint")}
                            </p>
                          </div>
                          {faqs.map((faq, i) => (
                            <div key={i} className="mb-4 rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-page)]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                  {t("createCourse.faqItemLabel")} {i + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                                  className="text-red-500 text-xs hover:underline"
                                >
                                  {t("createCourse.removeFaq")}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                <input
                                  type="text"
                                  value={faq.question}
                                  onChange={(e) => {
                                    const next = [...faqs];
                                    next[i] = { ...next[i], question: e.target.value };
                                    setFaqs(next);
                                  }}
                                  placeholder={t("createCourse.faqQuestionEnPlaceholder")}
                                  className={inputClass}
                                />
                                <input
                                  type="text"
                                  value={faq.questionAr}
                                  onChange={(e) => {
                                    const next = [...faqs];
                                    next[i] = { ...next[i], questionAr: e.target.value };
                                    setFaqs(next);
                                  }}
                                  placeholder={t("createCourse.faqQuestionArPlaceholder")}
                                  dir="rtl"
                                  className={inputClass}
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <textarea
                                  value={faq.answer}
                                  onChange={(e) => {
                                    const next = [...faqs];
                                    next[i] = { ...next[i], answer: e.target.value };
                                    setFaqs(next);
                                  }}
                                  placeholder={t("createCourse.faqAnswerEnPlaceholder")}
                                  rows={3}
                                  className={`${inputClass} resize-none`}
                                />
                                <textarea
                                  value={faq.answerAr}
                                  onChange={(e) => {
                                    const next = [...faqs];
                                    next[i] = { ...next[i], answerAr: e.target.value };
                                    setFaqs(next);
                                  }}
                                  placeholder={t("createCourse.faqAnswerArPlaceholder")}
                                  rows={3}
                                  dir="rtl"
                                  className={`${inputClass} resize-none`}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setFaqs([...faqs, { question: "", questionAr: "", answer: "", answerAr: "" }])}
                            className="text-sm text-[var(--color-primary)] hover:underline"
                          >
                            {t("createCourse.addFaq")}
                          </button>
                        </div>
                      )}

                      {/* Show Contents toggle — only for self-paced and blended */}
                      {(deliveryType === 'self-paced' || deliveryType === 'blended') && (
                        <div className="pt-3 border-t border-[var(--color-border)]">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showContents}
                              onChange={(e) => setShowContents(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)]"
                            />
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("createCourse.showContentsLabel")}</p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                {t("createCourse.showContentsDesc")}
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Visible on public site toggle */}
                      <div className="pt-3 border-t border-[var(--color-border)]">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleOnPublicSite}
                            onChange={(e) => setVisibleOnPublicSite(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)]"
                          />
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("createCourse.visibleOnPublicLabel")}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {t("createCourse.visibleOnPublicDesc")}
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Schedule & Pricing */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  {/* Schedule */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      {t("createCourse.scheduleTitle")}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.startDate")} *
                        </label>
                        <DatePicker
                          id="start-date"
                          value={startDate}
                          onChange={setStartDate}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.endDate")} *
                        </label>
                        <DatePicker
                          id="end-date"
                          value={endDate}
                          onChange={setEndDate}
                          min={startDate || new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div>
                        <label htmlFor="max-enrollment" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
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
                        <label htmlFor="cme-hours" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.cmeHours")}{Number(price) > 0 ? " *" : ""}
                        </label>
                        <input
                          id="cme-hours"
                          type="number"
                          value={cmeHours}
                          onChange={(e) => setCmeHours(e.target.value)}
                          placeholder="5"
                          min={Number(price) > 0 ? 1 : 0}
                          required={Number(price) > 0}
                          className={inputClass}
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {Number(price) > 0
                            ? t("createCourse.cmeHoursHint")
                            : (t("createCourse.cmeHoursOptionalHint") || "Optional for free courses — leave empty if not applicable")}
                        </p>
                      </div>
                      <div>
                        <label htmlFor="cohort" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {t("createCourse.cohortHint")}
                        </p>
                      </div>
                      <div>
                        <label
                          htmlFor="accreditation-number"
                          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
                        >
                          {t("createCourse.accreditationNumber")}
                        </label>
                        <input
                          id="accreditation-number"
                          type="text"
                          value={accreditationNumber}
                          onChange={(e) => setAccreditationNumber(e.target.value)}
                          placeholder={t("createCourse.accreditationNumberPlaceholder")}
                          maxLength={100}
                          className={inputClass}
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {t("createCourse.accreditationNumberHint")}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor="nelc-review-link"
                          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
                        >
                          {t("createCourse.nelcReviewLink")}
                        </label>
                        <input
                          id="nelc-review-link"
                          type="url"
                          value={nelcReviewLink}
                          onChange={(e) => {
                            setNelcReviewLink(e.target.value);
                            if (nelcReviewLinkError) setNelcReviewLinkError(null);
                          }}
                          onBlur={() => {
                            const result = normalizeAndValidateUrl(nelcReviewLink);
                            if (result.valid && result.normalized && result.normalized !== nelcReviewLink) {
                              setNelcReviewLink(result.normalized);
                            }
                            setNelcReviewLinkError(
                              result.valid ? null : t("createCourse.nelcReviewLinkInvalid"),
                            );
                          }}
                          placeholder={t("createCourse.nelcReviewLinkPlaceholder")}
                          maxLength={500}
                          className={`${inputClass} ${nelcReviewLinkError ? "border-red-500 focus:ring-red-500" : ""}`}
                          dir="ltr"
                          aria-invalid={!!nelcReviewLinkError}
                          aria-describedby={nelcReviewLinkError ? "nelc-review-link-error" : undefined}
                        />
                        {nelcReviewLinkError ? (
                          <p id="nelc-review-link-error" className="text-xs text-red-600 mt-1">
                            {nelcReviewLinkError}
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                            {t("createCourse.nelcReviewLinkHint")}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="price" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.priceLabel")}
                        </label>
                        <input
                          id="price"
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="0"
                          min={0}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="enrollment-deadline" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.enrollmentDeadlineLabel")}
                        </label>
                        <DateTimePicker
                          id="enrollment-deadline"
                          value={enrollmentDeadline}
                          onChange={setEnrollmentDeadline}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div>
                        <label htmlFor="language" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                          {t("createCourse.languageLabel")}
                        </label>
                        <select
                          id="language"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className={selectClass}
                        >
                          <option value="en">{t("createCourse.languageEn")}</option>
                          <option value="ar">{t("createCourse.languageAr")}</option>
                          <option value="both">{t("createCourse.languageBoth")}</option>
                        </select>
                      </div>
                      {(deliveryType === 'onsite' || deliveryType === 'blended') && (
                        <>
                          <div>
                            <label htmlFor="venue" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                              {t("createCourse.venueEn")}
                            </label>
                            <input
                              id="venue"
                              type="text"
                              value={venue}
                              onChange={(e) => setVenue(e.target.value)}
                              placeholder={t("createCourse.venuePlaceholder")}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label htmlFor="venue-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                              {t("createCourse.venueAr")}
                            </label>
                            <input
                              id="venue-ar"
                              type="text"
                              value={venueAr}
                              onChange={(e) => setVenueAr(e.target.value)}
                              placeholder="..."
                              className={inputClass}
                              dir="rtl"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* NELC Configuration */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-5 h-5 text-[var(--color-primary-dark)]" />
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
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
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{item.label}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                        {isRTL ? "هذه المتطلبات مطبقة تلقائياً على جميع الدورات." : "These requirements are automatically enforced for all courses."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Team Assignment (Instructor + TA) */}
              {currentStep === 4 && (() => {
                const statusDot: Record<string, string> = { available: "bg-[#22C55E]", busy: "bg-[#F59E0B]", overloaded: "bg-[#EF4444]" };
                const statusBadgeBg: Record<string, string> = { available: "bg-[#DCFCE7] text-[#065F46]", busy: "bg-[#FEF3C7] text-[#92400E]", overloaded: "bg-[#FEE2E2] text-[#991B1B]" };
                return (
                <div className="space-y-6">
                  {/* Instructor Section */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                      {t("createCourse.instructor")} *
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("createCourse.selectInstructor")}</p>

                    {loadingInstructors ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Selected display / trigger */}
                        <button
                          type="button"
                          onClick={() => setInstructorDropdownOpen(!instructorDropdownOpen)}
                          className="w-full flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-card)] hover:border-[var(--color-primary)] transition-colors text-start"
                        >
                          {selectedInstructor ? (
                            <>
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {selectedInstructor.firstName && selectedInstructor.lastName
                                  ? `${selectedInstructor.firstName[0]}${selectedInstructor.lastName[0]}`.toUpperCase()
                                  : (selectedInstructor.email || "").substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                  {[selectedInstructor.firstName, selectedInstructor.lastName].filter(Boolean).join(" ") || selectedInstructor.email}
                                </p>
                                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{selectedInstructor.email}</p>
                              </div>
                              {selectedInstructor.status && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadgeBg[selectedInstructor.status] || "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}>
                                  {t(`instructorsPage.status.${selectedInstructor.status}` as Parameters<typeof t>[0])}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-[var(--color-text-secondary)]">{t("createCourse.chooseInstructor")}</span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-[var(--color-text-secondary)] ms-auto transition-transform ${instructorDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {/* Dropdown */}
                        {instructorDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl shadow-lg max-h-[280px] overflow-hidden">
                            {/* Search */}
                            <div className="p-2 border-b border-[var(--color-border)]">
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                                <input
                                  type="text"
                                  value={instructorSearch}
                                  onChange={(e) => setInstructorSearch(e.target.value)}
                                  placeholder={isRTL ? "بحث..." : "Search..."}
                                  className="w-full ps-8 pe-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
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
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors ${isSelected ? "bg-[var(--color-border-subtle)]" : "hover:bg-[var(--color-border-subtle)]"}`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{name}</p>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{inst.email}</p>
                                      </div>
                                      {inst.status && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-secondary)] flex-shrink-0">
                                          <span className={`w-2 h-2 rounded-full ${statusDot[inst.status] || "bg-[var(--color-text-secondary)]"}`} />
                                          {t(`instructorsPage.status.${inst.status}` as Parameters<typeof t>[0])}
                                        </span>
                                      )}
                                      {isSelected && <Check className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />}
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
                      <div className="w-full border-t border-[var(--color-border)]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[var(--color-surface-page)] px-3 text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                        {t("createCourse.taAssignment")}
                      </span>
                    </div>
                  </div>

                  {/* TA Section */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-[var(--color-primary-dark)]" />
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {t("createCourse.taAssignment")}
                      </h2>
                      <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded-full">
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
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{[selectedTA.firstName, selectedTA.lastName].filter(Boolean).join(" ")}</p>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">{selectedTA.email}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedTAId("")} className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : loadingTAs ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-[var(--color-primary-dark)] animate-spin" />
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setTaDropdownOpen(!taDropdownOpen)}
                          className="w-full flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-card)] hover:border-[#D97706] transition-colors text-start"
                        >
                          <span className="text-sm text-[var(--color-text-secondary)]">{t("createCourse.noneSelected")}</span>
                          <ChevronDown className={`w-4 h-4 text-[var(--color-text-secondary)] ms-auto transition-transform ${taDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {taDropdownOpen && (
                          <div className="absolute z-20 mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl shadow-lg max-h-[280px] overflow-hidden">
                            <div className="p-2 border-b border-[var(--color-border)]">
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                                <input
                                  type="text"
                                  value={taSearch}
                                  onChange={(e) => setTaSearch(e.target.value)}
                                  placeholder={isRTL ? "بحث..." : "Search..."}
                                  className="w-full ps-8 pe-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-[220px]">
                              {availableTAs.length === 0 ? (
                                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">{isRTL ? "لا يوجد مساعدو تدريس" : "No TAs available"}</p>
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
                                      className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-[var(--color-border-subtle)] transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[11px] font-semibold text-[#92400E] flex-shrink-0">
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{name}</p>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{ta.email}</p>
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

              {/* Step 5: Review & Submit */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      {t("createCourse.reviewTitle")}
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                      {t("createCourse.reviewDescription")}
                    </p>

                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div className="border border-[var(--color-border)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                          {t("createCourse.basicInfo")}
                        </h3>

                        {/* Thumbnail preview */}
                        {thumbnailPreview && (
                          <div className="relative w-full max-w-xs h-36 rounded-lg overflow-hidden border border-[var(--color-border)] mb-4">
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
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.courseTitle")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {title || "\u2014"}
                            </dd>
                          </div>
                          {titleAr && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">
                                {t("createCourse.courseTitleAr")}
                              </dt>
                              <dd className="font-medium text-[var(--color-text-primary)]" dir="rtl">
                                {titleAr}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.deliveryType")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {getDeliveryTypeLabel(deliveryType)}
                            </dd>
                          </div>
                          {description && (
                            <div className="sm:col-span-2">
                              <dt className="text-[var(--color-text-secondary)]">
                                {t("createCourse.description")}
                              </dt>
                              <dd className="font-medium text-[var(--color-text-primary)] line-clamp-2">
                                {description}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Content Details */}
                      {(overview || overviewAr || objectives.some(s => s.trim()) || objectivesAr.some(s => s.trim()) || features.some(s => s.trim()) || featuresAr.some(s => s.trim()) || targetAudience.some(s => s.trim()) || targetAudienceAr.some(s => s.trim()) || requirements || requirementsAr || notices || noticesAr) && (
                        <div className="border border-[var(--color-border)] rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                            {t("createCourse.wizardStepContent")}
                          </h3>
                          <dl className="space-y-3 text-sm">
                            {overview && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsOverviewEn")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line">{overview}</dd>
                              </div>
                            )}
                            {overviewAr && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsOverviewAr")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line" dir="rtl">{overviewAr}</dd>
                              </div>
                            )}
                            {objectives.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsObjectivesEn")}</dt>
                                <dd>
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {objectives.filter(s => s.trim()).map((o, i) => <li key={i}>{o}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {objectivesAr.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsObjectivesAr")}</dt>
                                <dd dir="rtl">
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {objectivesAr.filter(s => s.trim()).map((o, i) => <li key={i}>{o}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {features.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsFeaturesEn")}</dt>
                                <dd>
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {features.filter(s => s.trim()).map((f, i) => <li key={i}>{f}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {featuresAr.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsFeaturesAr")}</dt>
                                <dd dir="rtl">
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {featuresAr.filter(s => s.trim()).map((f, i) => <li key={i}>{f}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {targetAudience.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsTargetAudienceEn")}</dt>
                                <dd>
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {targetAudience.filter(s => s.trim()).map((a, i) => <li key={i}>{a}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {targetAudienceAr.some(s => s.trim()) && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsTargetAudienceAr")}</dt>
                                <dd dir="rtl">
                                  <ul className="list-disc list-inside text-[var(--color-text-primary)]">
                                    {targetAudienceAr.filter(s => s.trim()).map((a, i) => <li key={i}>{a}</li>)}
                                  </ul>
                                </dd>
                              </div>
                            )}
                            {requirements && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsRequirementsEn")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line">{requirements}</dd>
                              </div>
                            )}
                            {requirementsAr && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsRequirementsAr")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line" dir="rtl">{requirementsAr}</dd>
                              </div>
                            )}
                            {notices && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsNoticesEn")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line">{notices}</dd>
                              </div>
                            )}
                            {noticesAr && (
                              <div>
                                <dt className="text-[var(--color-text-secondary)]">{t("createCourse.contentDetailsNoticesAr")}</dt>
                                <dd className="font-medium text-[var(--color-text-primary)] whitespace-pre-line" dir="rtl">{noticesAr}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}

                      {/* Schedule & NELC */}
                      <div className="border border-[var(--color-border)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                          {t("createCourse.scheduleTitle")} &{" "}
                          {t("createCourse.nelcConfig")}
                        </h3>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.startDate")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {formatDate(startDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.endDate")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {formatDate(endDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.cmeHours")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {cmeHours || "\u2014"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--color-text-secondary)]">
                              {t("createCourse.maxEnrollment")}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">
                              {maxEnrollment || "\u2014"}
                            </dd>
                          </div>
                          {cohort && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">
                                {t("createCourse.cohort")}
                              </dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">
                                {cohort}
                              </dd>
                            </div>
                          )}
                          {accreditationNumber && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">
                                {t("createCourse.accreditationNumber")}
                              </dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">
                                {accreditationNumber}
                              </dd>
                            </div>
                          )}
                          {nelcReviewLink && (
                            <div className="sm:col-span-2">
                              <dt className="text-[var(--color-text-secondary)]">
                                {t("createCourse.nelcReviewLink")}
                              </dt>
                              <dd className="font-medium text-[var(--color-text-primary)] break-all">
                                {nelcReviewLink}
                              </dd>
                            </div>
                          )}
                          {price && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">{t("createCourse.priceLabel")}</dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">{price}</dd>
                            </div>
                          )}
                          {enrollmentDeadline && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">{t("createCourse.enrollmentDeadlineLabel")}</dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">{formatDate(enrollmentDeadline)}</dd>
                            </div>
                          )}
                          {language !== 'en' && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">{t("createCourse.languageLabel")}</dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">{language === 'ar' ? t("createCourse.languageAr") : language === 'both' ? t("createCourse.languageBoth") : t("createCourse.languageEn")}</dd>
                            </div>
                          )}
                          {(deliveryType === 'onsite' || deliveryType === 'blended') && venue && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">{t("createCourse.venueEn")}</dt>
                              <dd className="font-medium text-[var(--color-text-primary)]">{venue}</dd>
                            </div>
                          )}
                          {(deliveryType === 'onsite' || deliveryType === 'blended') && venueAr && (
                            <div>
                              <dt className="text-[var(--color-text-secondary)]">Venue (Arabic)</dt>
                              <dd className="font-medium text-[var(--color-text-primary)]" dir="rtl">{venueAr}</dd>
                            </div>
                          )}
                          <div className="sm:col-span-2 flex items-center gap-4 flex-wrap">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${nelcAccreditation ? "bg-green-50 text-green-700" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
                            >
                              {nelcAccreditation ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.nelcAccreditation")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${bilingualContent ? "bg-green-50 text-green-700" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
                            >
                              {bilingualContent ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.bilingualContent")}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${wcagCompliant ? "bg-green-50 text-green-700" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
                            >
                              {wcagCompliant ? "\u2713" : "\u2717"}{" "}
                              {t("createCourse.wcagCompliant")}
                            </span>
                          </div>
                        </dl>
                      </div>

                      {/* Instructor */}
                      <div className="border border-[var(--color-border)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                          {t("createCourse.instructor")}
                        </h3>
                        {selectedInstructor ? (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                              {[
                                selectedInstructor.firstName,
                                selectedInstructor.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ")}{" "}
                              ({selectedInstructor.email})
                            </p>
                            {selectedInstructor.status && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-page)] border border-[var(--color-border)]">
                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedInstructor.status)}`} />
                                {getInstructorStatusLabel(selectedInstructor.status, t)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--color-text-secondary)]">{"\u2014"}</p>
                        )}
                      </div>

                      {/* Teaching Assistant */}
                      <div className="border border-[var(--color-border)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                          {t("createCourse.taAssignment")}
                        </h3>
                        {selectedTA ? (
                          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {[selectedTA.firstName, selectedTA.lastName]
                              .filter(Boolean)
                              .join(" ")}{" "}
                            ({selectedTA.email})
                          </p>
                        ) : (
                          <p className="text-sm text-[var(--color-text-secondary)]">
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
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                >
                  {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {currentStep === 1
                    ? t("createCourse.cancel")
                    : t("createCourse.back")}
                </button>

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                  >
                    {t("createCourse.next")}
                    {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
