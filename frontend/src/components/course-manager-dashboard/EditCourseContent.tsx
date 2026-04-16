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
import { courseManagerApi } from "@/lib/api";
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
  const [venue, setVenue] = useState("");
  const [venueAr, setVenueAr] = useState("");
  const [enrollmentDeadline, setEnrollmentDeadline] = useState("");
  const [language, setLanguage] = useState("en");

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
        setVenue((courseData as any).venue || "");
        setVenueAr((courseData as any).venueAr || "");
        if ((courseData as any).enrollmentDeadline) {
          setEnrollmentDeadline((courseData as any).enrollmentDeadline.split("T")[0]);
        }
        setLanguage((courseData as any).language || "en");

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
      if (enrollmentDeadline) payload.enrollmentDeadline = enrollmentDeadline;
      if (language !== 'en') payload.language = language;

      await courseManagerApi.updateCourse(courseId, payload);

      // If instructor changed, reassign (also updates all scheduled sessions)
      if (instructorId !== originalInstructorId) {
        await courseManagerApi.assignInstructor(courseId, instructorId);
      }

      toast.success(t("editCourse.success"));
      router.push(`/${locale}/dashboard/manager/courses/${courseId}`);
    } catch (err) {
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
        <div className="bg-[#F9FAFB] min-h-screen">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="hidden lg:block lg:flex-shrink-0">
                <CourseManagerSidebar manager={manager} />
              </div>
              <CourseManagerMobileSidebar manager={manager} />
              <div className="flex-1 min-w-0 animate-pulse space-y-4">
                <div className="h-8 w-48 bg-[#E5E7EB] rounded" />
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
                  <div className="h-6 w-32 bg-[#E5E7EB] rounded" />
                  <div className="h-10 w-full bg-[#E5E7EB] rounded" />
                  <div className="h-10 w-full bg-[#E5E7EB] rounded" />
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
        <div className="bg-[#F9FAFB] min-h-screen">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="hidden lg:block lg:flex-shrink-0">
                <CourseManagerSidebar manager={manager} />
              </div>
              <CourseManagerMobileSidebar manager={manager} />
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#D97706] mx-auto mb-4" />
                  <p className="text-[#6B7280] mb-4">{loadError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg"
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
                  {locale === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {t("editCourse.backToCourse")}
                </button>
                <h1 className="text-2xl font-bold text-[#1F2937]">
                  {t("editCourse.title")}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">
                  {t("editCourse.subtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.basicInfo")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-course-title" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.courseTitle")} *
                      </label>
                      <input
                        id="edit-course-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-course-title-ar" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.courseTitleAr")}
                      </label>
                      <input
                        id="edit-course-title-ar"
                        type="text"
                        value={titleAr}
                        onChange={(e) => setTitleAr(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        dir="rtl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="edit-course-description" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.description")}
                      </label>
                      <textarea
                        id="edit-course-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="edit-course-description-ar" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.descriptionAr")}
                      </label>
                      <textarea
                        id="edit-course-description-ar"
                        value={descriptionAr}
                        onChange={(e) => setDescriptionAr(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        dir="rtl"
                      />
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
                        className="absolute top-2 right-2 p-1 bg-white/90 rounded-full text-[#6B7280] hover:bg-white hover:text-red-500 transition-colors"
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
                    </button>
                  )}
                </div>

                {/* Course Content */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    Content Details
                  </h2>
                  <div className="space-y-4">
                    {/* Overview */}
                    <div>
                      <label htmlFor="edit-overview" className="block text-sm font-medium text-[#374151] mb-1">Overview (English)</label>
                      <textarea
                        id="edit-overview"
                        value={overview}
                        onChange={(e) => setOverview(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        placeholder="Course overview..."
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-overview-ar" className="block text-sm font-medium text-[#374151] mb-1">Overview (Arabic)</label>
                      <textarea
                        id="edit-overview-ar"
                        value={overviewAr}
                        onChange={(e) => setOverviewAr(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        dir="rtl"
                        placeholder="..."
                      />
                    </div>

                    {/* Objectives */}
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Objectives (English)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder={`Objective ${i + 1}`}
                          />
                          <button type="button" onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setObjectives([...objectives, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add objective</button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Objectives (Arabic)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            dir="rtl"
                            placeholder={`${i + 1}`}
                          />
                          <button type="button" onClick={() => setObjectivesAr(objectivesAr.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setObjectivesAr([...objectivesAr, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add objective</button>
                    </div>

                    {/* Features */}
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Features (English)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder={`Feature ${i + 1}`}
                          />
                          <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setFeatures([...features, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add feature</button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Features (Arabic)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            dir="rtl"
                            placeholder={`${i + 1}`}
                          />
                          <button type="button" onClick={() => setFeaturesAr(featuresAr.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setFeaturesAr([...featuresAr, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add feature</button>
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Target Audience (English)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder={`Audience ${i + 1}`}
                          />
                          <button type="button" onClick={() => setTargetAudience(targetAudience.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setTargetAudience([...targetAudience, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add audience</button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Target Audience (Arabic)</label>
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
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            dir="rtl"
                            placeholder={`${i + 1}`}
                          />
                          <button type="button" onClick={() => setTargetAudienceAr(targetAudienceAr.filter((_, j) => j !== i))}
                            className="text-red-500 text-sm px-2">{"\u2715"}</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setTargetAudienceAr([...targetAudienceAr, ""])}
                        className="text-sm text-blue-600 hover:underline">+ Add audience</button>
                    </div>

                    {/* Requirements — only for onsite/blended */}
                    {(deliveryType === 'onsite' || deliveryType === 'blended') && (
                      <>
                        <div>
                          <label htmlFor="edit-requirements" className="block text-sm font-medium text-[#374151] mb-1">Requirements (English)</label>
                          <textarea
                            id="edit-requirements"
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                            placeholder="Course requirements..."
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-requirements-ar" className="block text-sm font-medium text-[#374151] mb-1">Requirements (Arabic)</label>
                          <textarea
                            id="edit-requirements-ar"
                            value={requirementsAr}
                            onChange={(e) => setRequirementsAr(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                            dir="rtl"
                            placeholder="..."
                          />
                        </div>
                      </>
                    )}

                    {/* Notices */}
                    <div>
                      <label htmlFor="edit-notices" className="block text-sm font-medium text-[#374151] mb-1">Notices (English)</label>
                      <textarea
                        id="edit-notices"
                        value={notices}
                        onChange={(e) => setNotices(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        placeholder="Important notices..."
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-notices-ar" className="block text-sm font-medium text-[#374151] mb-1">Notices (Arabic)</label>
                      <textarea
                        id="edit-notices-ar"
                        value={noticesAr}
                        onChange={(e) => setNoticesAr(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        dir="rtl"
                        placeholder="..."
                      />
                    </div>
                  </div>
                </div>

                {/* Instructor Assignment */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.instructor")}
                  </h2>
                  <div>
                    <label htmlFor="edit-instructor-select" className="block text-sm font-medium text-[#374151] mb-1">
                      {t("createCourse.selectInstructor")} *
                    </label>
                    <select
                      id="edit-instructor-select"
                      value={instructorId}
                      onChange={(e) => setInstructorId(e.target.value)}
                      className="w-full max-w-md px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
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
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.courseSettings")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-delivery-type" className="block text-sm font-medium text-[#374151] mb-1">
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
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
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
                      <label htmlFor="edit-max-enrollment" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.maxEnrollment")}
                      </label>
                      <input
                        id="edit-max-enrollment"
                        type="number"
                        value={maxEnrollment}
                        onChange={(e) => setMaxEnrollment(e.target.value)}
                        placeholder={deliveryType === "self-paced" ? t("createCourse.unlimited") || "Unlimited" : "2000"}
                        min={1}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                      <p className="text-xs text-[#9CA3AF] mt-1">
                        {deliveryType === "self-paced"
                          ? t("createCourse.selfPacedNoLimit") || "Self-paced: unlimited enrollment. Leave empty for no limit."
                          : t("createCourse.syncDefaultLimit") || "Synchronous: default max 2000. Leave empty for default."}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="edit-cohort" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.cohort")}
                      </label>
                      <input
                        id="edit-cohort"
                        type="text"
                        value={cohort}
                        onChange={(e) => setCohort(e.target.value)}
                        placeholder={t("createCourse.cohortPlaceholder")}
                        maxLength={100}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                      <p className="text-xs text-[#6B7280] mt-1">
                        {t("createCourse.cohortHint")}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="edit-start-date" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.startDate")}
                      </label>
                      <DatePicker
                        id="edit-start-date"
                        value={startDate}
                        onChange={setStartDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-end-date" className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.endDate")}
                      </label>
                      <DatePicker
                        id="edit-end-date"
                        value={endDate}
                        onChange={setEndDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-price" className="block text-sm font-medium text-[#374151] mb-1">
                        Price (SAR)
                      </label>
                      <input
                        id="edit-price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                        min={0}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-enrollment-deadline" className="block text-sm font-medium text-[#374151] mb-1">
                        Enrollment Deadline
                      </label>
                      <DatePicker
                        id="edit-enrollment-deadline"
                        value={enrollmentDeadline}
                        onChange={setEnrollmentDeadline}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-language" className="block text-sm font-medium text-[#374151] mb-1">
                        Language
                      </label>
                      <select
                        id="edit-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    {(deliveryType === 'onsite' || deliveryType === 'blended') && (
                      <>
                        <div>
                          <label htmlFor="edit-venue" className="block text-sm font-medium text-[#374151] mb-1">
                            Venue (English)
                          </label>
                          <input
                            id="edit-venue"
                            type="text"
                            value={venue}
                            onChange={(e) => setVenue(e.target.value)}
                            placeholder="Venue name or address"
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-venue-ar" className="block text-sm font-medium text-[#374151] mb-1">
                            Venue (Arabic)
                          </label>
                          <input
                            id="edit-venue-ar"
                            type="text"
                            value={venueAr}
                            onChange={(e) => setVenueAr(e.target.value)}
                            placeholder="..."
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                    className="px-6 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                  >
                    {t("createCourse.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
