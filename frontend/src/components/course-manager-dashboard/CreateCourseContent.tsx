"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import type { InstructorListItem, CreateCourseManagerData } from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react";

const CreateCourseContent = () => {
  const manager = useManagerProfile();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");

  // Instructor list
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [deliveryType, setDeliveryType] = useState<"zoom" | "onsite" | "blended">("zoom");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [instructorId, setInstructorId] = useState("");

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Fetch instructors on mount
  useEffect(() => {
    courseManagerApi
      .getInstructors()
      .then((data) => setInstructors(data))
      .catch(() => toast.error("Failed to load instructors"))
      .finally(() => setLoadingInstructors(false));
  }, []);

  const handleThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
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

      const created = await courseManagerApi.createCourse(payload);
      toast.success(t("createCourse.success"));
      router.push(`/${locale}/dashboard/manager/courses/${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("createCourse.error")
      );
    } finally {
      setSubmitting(false);
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

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.basicInfo")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.courseTitle")} *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t("createCourse.courseTitlePlaceholder")}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.courseTitleAr")}
                      </label>
                      <input
                        type="text"
                        value={titleAr}
                        onChange={(e) => setTitleAr(e.target.value)}
                        placeholder={t("createCourse.courseTitleArPlaceholder")}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        dir="rtl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.description")}
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t("createCourse.descriptionPlaceholder")}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.descriptionAr")}
                      </label>
                      <textarea
                        value={descriptionAr}
                        onChange={(e) => setDescriptionAr(e.target.value)}
                        placeholder={t("createCourse.descriptionArPlaceholder")}
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
                      <span className="text-xs mt-1">
                        {t("createCourse.imageHint")}
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
                    <label className="block text-sm font-medium text-[#374151] mb-1">
                      {t("createCourse.selectInstructor")} *
                    </label>
                    <select
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
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.deliveryType")}
                      </label>
                      <select
                        value={deliveryType}
                        onChange={(e) =>
                          setDeliveryType(
                            e.target.value as "zoom" | "onsite" | "blended"
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
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.maxEnrollment")}
                      </label>
                      <input
                        type="number"
                        value={maxEnrollment}
                        onChange={(e) => setMaxEnrollment(e.target.value)}
                        placeholder="50"
                        min={1}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.startDate")}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        {t("createCourse.endDate")}
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
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
                    {t("createCourse.createButton")}
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

export default CreateCourseContent;
