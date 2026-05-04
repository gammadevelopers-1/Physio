"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi, ApiError } from "@/lib/api";
import type { InstructorListItem } from "@/lib/api";
import type { CourseDetailResponse } from "@/types/instructor-dashboard";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  ImagePlus,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

interface EditCourseContentProps {
  courseId: string;
}

const EditCourseContent = ({ courseId }: EditCourseContentProps) => {
  const manager = useManagerProfile();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");

  // Loading states
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Instructor list
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [deliveryType, setDeliveryType] = useState<"zoom" | "onsite" | "blended" | "self-paced">("zoom");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [originalInstructorId, setOriginalInstructorId] = useState("");
  const [cohort, setCohort] = useState("");

  // Content Details
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

  // Pricing & venue
  const [price, setPrice] = useState("");
  const [cmeHours, setCmeHours] = useState("");
  const [venue, setVenue] = useState("");
  const [venueAr, setVenueAr] = useState("");
  const [enrollmentDeadline, setEnrollmentDeadline] = useState("");
  const [language, setLanguage] = useState("en");
  const [showContents, setShowContents] = useState(true);
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(["overview", "objectives", "contents", "requirements", "reviews"]);
  const [visibleOnPublicSite, setVisibleOnPublicSite] = useState(true);

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Fetch course data and instructors on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [courseData, instructorData] = await Promise.all([
          courseManagerApi.getCourseDetail(courseId),
          courseManagerApi.getInstructors(),
        ]);

        // Pre-fill form
        setTitle(courseData.title);
        setTitleAr(courseData.titleAr || "");
        setDescription(courseData.description || "");
        setDescriptionAr(courseData.descriptionAr || "");
        setDeliveryType(courseData.deliveryType as "zoom" | "onsite" | "blended" | "self-paced");
        setMaxEnrollment(courseData.maxEnrollment?.toString() || "");
        setInstructorId(courseData.instructorId);
        setOriginalInstructorId(courseData.instructorId);
        setCohort(courseData.cohort || "");

        // Content Details
        setOverview((courseData as any).overview || "");
        setOverviewAr((courseData as any).overviewAr || "");
        setObjectives((courseData as any).objectives || []);
        setObjectivesAr((courseData as any).objectivesAr || []);
        setFeatures((courseData as any).features || []);
        setFeaturesAr((courseData as any).featuresAr || []);
        setTargetAudience((courseData as any).targetAudience || []);
        setTargetAudienceAr((courseData as any).targetAudienceAr || []);
        setRequirements((courseData as any).requirements || "");
        setRequirementsAr((courseData as any).requirementsAr || "");
        setNotices((courseData as any).notices || "");
        setNoticesAr((courseData as any).noticesAr || "");

        // Pricing & venue
        setPrice((courseData as any).price?.toString() || "");
        setCmeHours(courseData.cmeHours != null ? courseData.cmeHours.toString() : "");
        setVenue((courseData as any).venue || "");
        setVenueAr((courseData as any).venueAr || "");
        if ((courseData as any).enrollmentDeadline) {
          setEnrollmentDeadline((courseData as any).enrollmentDeadline.split("T")[0]);
        }
        setLanguage((courseData as any).language || "en");
        setShowContents((courseData as any).showContents !== false);
        setVisibleOnPublicSite((courseData as any).visibleOnPublicSite !== false);
        const savedOrder = (courseData as any).sectionsOrder;
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
          setSectionsOrder(savedOrder);
        }

        if (courseData.startDate) {
          setStartDate(courseData.startDate.split("T")[0]);
        }
        if (courseData.endDate) {
          setEndDate(courseData.endDate.split("T")[0]);
        }
        if (courseData.thumbnail) {
          setThumbnailUrl(courseData.thumbnail);
          setThumbnailPreview(courseData.thumbnail);
        }

        setInstructors(instructorData);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load course"
        );
      } finally {
        setLoadingCourse(false);
        setLoadingInstructors(false);
      }
    };
    loadData();
  }, [courseId]);

  const handleThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setThumbnailPreview(thumbnailUrl || null);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const removeThumbnail = () => {
    setThumbnailUrl("");
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t("createCourse.titleRequired"));
      return;
    }
    if (!instructorId) {
      toast.error(t("createCourse.instructorRequired"));
      return;
    }
    if (Number(price) > 0 && !cmeHours) {
      toast.error(t("createCourse.cmeHours") + " is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        deliveryType,
        thumbnail: thumbnailUrl || undefined,
        maxEnrollment: maxEnrollment ? Number(maxEnrollment) : undefined,
      };
      if (titleAr.trim()) payload.titleAr = titleAr.trim();
      if (description.trim()) payload.description = description.trim();
      if (descriptionAr.trim()) payload.descriptionAr = descriptionAr.trim();
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (cohort.trim()) payload.cohort = cohort.trim();

      // Content Details
      const cleanArray = (arr: string[]) => arr.filter(s => s.trim()).map(s => s.trim());
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

      // Pricing & venue
      if (venue.trim()) payload.venue = venue.trim();
      if (venueAr.trim()) payload.venueAr = venueAr.trim();
      if (price) payload.price = Number(price);
      if (cmeHours) {
        payload.cmeHours = Number(cmeHours);
        payload.isCmeAccredited = true;
      } else {
        payload.cmeHours = 0;
        payload.isCmeAccredited = false;
      }
      if (enrollmentDeadline) payload.enrollmentDeadline = enrollmentDeadline;
      if (language !== 'en') payload.language = language;
      // Only send showContents for self-paced/blended courses
      if (deliveryType === 'self-paced' || deliveryType === 'blended') {
        payload.showContents = showContents;
      }
      payload.sectionsOrder = sectionsOrder;
      payload.visibleOnPublicSite = visibleOnPublicSite;

      await courseManagerApi.updateCourse(courseId, payload);

      // If instructor changed, reassign (also updates all scheduled sessions)
      if (instructorId !== originalInstructorId) {
        await courseManagerApi.assignInstructor(courseId, instructorId);
      }

      toast.success(t("editCourse.success"));
      router.push(`/${locale}/dashboard/manager/courses/${courseId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code) {
        const codeMap: Record<string, string> = {
          ENROLLMENT_DEADLINE_NOT_FORWARD: "editCourse.errors.deadlineNotForward",
          ENROLLMENT_DEADLINE_AFTER_START: "editCourse.errors.deadlineAfterStart",
          ENROLLMENT_DEADLINE_PASSED: "editCourse.errors.deadlinePassed",
          ENROLLMENT_CAPACITY_DECREASE: "editCourse.errors.capacityDecrease",
          ENROLLMENT_CAPACITY_BELOW_ENROLLED: "editCourse.errors.capacityBelowEnrolled",
        };
        const key = codeMap[err.code];
        if (key) {
          const meta = err.meta as { capacity?: number; enrolled?: number } | undefined;
          toast.error(t(key, meta as any));
          return;
        }
      }
      toast.error(
        err instanceof Error ? err.message : t("editCourse.error")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCourse) {
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
              <div className="flex-1 min-w-0 animate-pulse space-y-4">
                <div className="h-8 w-48 bg-[var(--color-border)] rounded" />
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 space-y-4">
                  <div className="h-6 w-32 bg-[var(--color-border)] rounded" />
                  <div className="h-10 w-full bg-[var(--color-border)] rounded" />
                  <div className="h-10 w-full bg-[var(--color-border)] rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
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
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#D97706] mx-auto mb-4" />
                  <p className="text-[var(--color-text-secondary)] mb-4">{loadError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("dashboard.retry")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

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
                  {locale === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {t("editCourse.backToCourse")}
                </button>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("editCourse.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("editCourse.subtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("createCourse.basicInfo")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-course-title" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.courseTitle")} *
                      </label>
                      <input
                        id="edit-course-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-course-title-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.courseTitleAr")}
                      </label>
                      <input
                        id="edit-course-title-ar"
                        type="text"
                        value={titleAr}
                        onChange={(e) => setTitleAr(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        dir="rtl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="edit-course-description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.description")}
                      </label>
                      <textarea
                        id="edit-course-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="edit-course-description-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.descriptionAr")}
                      </label>
                      <textarea
                        id="edit-course-description-ar"
                        value={descriptionAr}
                        onChange={(e) => setDescriptionAr(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                        dir="rtl"
                      />
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
                        unoptimized
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
                    </button>
                  )}
                </div>

                {/* Course Content */}
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
                          <label htmlFor="edit-requirements" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsRequirementsEn")}</label>
                          <textarea
                            id="edit-requirements"
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                            placeholder={t("createCourse.requirementsPlaceholder")}
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-requirements-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsRequirementsAr")}</label>
                          <textarea
                            id="edit-requirements-ar"
                            value={requirementsAr}
                            onChange={(e) => setRequirementsAr(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                            dir="rtl"
                            placeholder="..."
                          />
                        </div>
                      </>
                    )}

                    {/* Notices */}
                    <div>
                      <label htmlFor="edit-notices" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsNoticesEn")}</label>
                      <textarea
                        id="edit-notices"
                        value={notices}
                        onChange={(e) => setNotices(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                        placeholder={t("createCourse.noticesPlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-notices-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.contentDetailsNoticesAr")}</label>
                      <textarea
                        id="edit-notices-ar"
                        value={noticesAr}
                        onChange={(e) => setNoticesAr(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                        dir="rtl"
                        placeholder="..."
                      />
                    </div>

                    {/* Show Contents toggle — only for self-paced and blended */}
                    {(deliveryType === 'self-paced' || deliveryType === 'blended') && (
                      <div className="pt-3 border-t border-[var(--color-border)]">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showContents}
                            onChange={(e) => setShowContents(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
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
                          className="mt-0.5 w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("createCourse.visibleOnPublicLabel")}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {t("createCourse.visibleOnPublicDesc")}
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Section order */}
                    <div className="pt-3 border-t border-[var(--color-border)]">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("createCourse.sectionOrderTitle")}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                        {t("createCourse.sectionOrderDesc")}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {sectionsOrder.map((key, idx) => {
                          const labels: Record<string, string> = {
                            overview: t("createCourse.sectionOverview"),
                            objectives: t("createCourse.sectionObjectives"),
                            contents: t("createCourse.sectionContents"),
                            requirements: t("createCourse.sectionRequirements"),
                            reviews: t("createCourse.sectionReviews"),
                          };
                          const moveUp = () => {
                            if (idx === 0) return;
                            const next = [...sectionsOrder];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            setSectionsOrder(next);
                          };
                          const moveDown = () => {
                            if (idx === sectionsOrder.length - 1) return;
                            const next = [...sectionsOrder];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            setSectionsOrder(next);
                          };
                          return (
                            <div key={key} className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg">
                              <span className="text-xs text-[var(--color-text-secondary)] font-medium w-5">{idx + 1}.</span>
                              <span className="text-sm text-[var(--color-text-secondary)] flex-1">{labels[key] || key}</span>
                              <button
                                type="button"
                                onClick={moveUp}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                                title={t("createCourse.moveUp")}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-secondary)]">
                                  <polyline points="18 15 12 9 6 15"></polyline>
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={moveDown}
                                disabled={idx === sectionsOrder.length - 1}
                                className="p-1 rounded hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                                title={t("createCourse.moveDown")}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-secondary)]">
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instructor Assignment */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("createCourse.instructor")}
                  </h2>
                  <div>
                    <label htmlFor="edit-instructor-select" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("createCourse.selectInstructor")} *
                    </label>
                    <select
                      id="edit-instructor-select"
                      value={instructorId}
                      onChange={(e) => setInstructorId(e.target.value)}
                      className="w-full max-w-md px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)]"
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
                </div>

                {/* Course Settings */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("createCourse.courseSettings")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-delivery-type" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.deliveryType")}
                      </label>
                      <select
                        id="edit-delivery-type"
                        value={deliveryType}
                        onChange={(e) =>
                          setDeliveryType(
                            e.target.value as "zoom" | "onsite" | "blended" | "self-paced"
                          )
                        }
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)]"
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
                    <div>
                      <label htmlFor="edit-max-enrollment" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.maxEnrollment")}
                      </label>
                      <input
                        id="edit-max-enrollment"
                        type="number"
                        value={maxEnrollment}
                        onChange={(e) => setMaxEnrollment(e.target.value)}
                        placeholder={deliveryType === "self-paced" ? t("createCourse.unlimited") || "Unlimited" : "2000"}
                        min={1}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {deliveryType === "self-paced"
                          ? t("createCourse.selfPacedNoLimit") || "Self-paced: unlimited enrollment. Leave empty for no limit."
                          : t("createCourse.syncDefaultLimit") || "Synchronous: default max 2000. Leave empty for default."}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="edit-cohort" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.cohort")}
                      </label>
                      <input
                        id="edit-cohort"
                        type="text"
                        value={cohort}
                        onChange={(e) => setCohort(e.target.value)}
                        placeholder={t("createCourse.cohortPlaceholder")}
                        maxLength={100}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {t("createCourse.cohortHint")}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="edit-start-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.startDate")}
                      </label>
                      <DatePicker
                        id="edit-start-date"
                        value={startDate}
                        onChange={setStartDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-end-date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.endDate")}
                      </label>
                      <DatePicker
                        id="edit-end-date"
                        value={endDate}
                        onChange={setEndDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-price" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.priceLabel")}
                      </label>
                      <input
                        id="edit-price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                        min={0}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-cme-hours" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.cmeHours")}{Number(price) > 0 ? " *" : ""}
                      </label>
                      <input
                        id="edit-cme-hours"
                        type="number"
                        value={cmeHours}
                        onChange={(e) => setCmeHours(e.target.value)}
                        placeholder="5"
                        min={Number(price) > 0 ? 1 : 0}
                        required={Number(price) > 0}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {Number(price) > 0
                          ? t("createCourse.cmeHoursHint")
                          : (t("createCourse.cmeHoursOptionalHint") || "Optional for free courses — leave empty to hide CME info")}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="edit-enrollment-deadline" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.enrollmentDeadlineLabel")}
                      </label>
                      <DatePicker
                        id="edit-enrollment-deadline"
                        value={enrollmentDeadline}
                        onChange={setEnrollmentDeadline}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-language" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("createCourse.languageLabel")}
                      </label>
                      <select
                        id="edit-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)]"
                      >
                        <option value="en">{t("createCourse.languageEn")}</option>
                        <option value="ar">{t("createCourse.languageAr")}</option>
                        <option value="both">{t("createCourse.languageBoth")}</option>
                      </select>
                    </div>
                    {(deliveryType === 'onsite' || deliveryType === 'blended') && (
                      <>
                        <div>
                          <label htmlFor="edit-venue" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                            {t("createCourse.venueEn")}
                          </label>
                          <input
                            id="edit-venue"
                            type="text"
                            value={venue}
                            onChange={(e) => setVenue(e.target.value)}
                            placeholder={t("createCourse.venuePlaceholder")}
                            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-venue-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                            {t("createCourse.venueAr")}
                          </label>
                          <input
                            id="edit-venue-ar"
                            type="text"
                            value={venueAr}
                            onChange={(e) => setVenueAr(e.target.value)}
                            placeholder="..."
                            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            dir="rtl"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                  >
                    {t("createCourse.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t("editCourse.saveChanges")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditCourseContent;
