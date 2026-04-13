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
