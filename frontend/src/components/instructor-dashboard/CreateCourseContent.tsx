"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { instructorApi } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ImagePlus, X } from "lucide-react";

const CreateCourseContent = () => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    titleAr: "",
    description: "",
    descriptionAr: "",
    deliveryType: "zoom" as "zoom" | "onsite" | "blended",
    maxEnrollment: "",
    startDate: "",
    endDate: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setThumbnailPreview(previewUrl);

    // Upload to server
    setUploadingThumbnail(true);
    try {
      const result = await instructorApi.uploadThumbnail(file);
      setThumbnailUrl(result.url);
    } catch (err) {
      toast.error(t("createCourse.thumbnailError"));
      setThumbnailPreview(null);
      setThumbnailUrl(null);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const removeThumbnail = () => {
    setThumbnailUrl(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error(t("createCourse.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof instructorApi.createCourse>[0] = {
        title: form.title.trim(),
        deliveryType: form.deliveryType,
      };
      if (form.titleAr.trim()) payload.titleAr = form.titleAr.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.descriptionAr.trim()) payload.descriptionAr = form.descriptionAr.trim();
      if (form.maxEnrollment) payload.maxEnrollment = parseInt(form.maxEnrollment, 10);
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;
      if (thumbnailUrl) payload.thumbnail = thumbnailUrl;

      const course = await instructorApi.createCourse(payload);
      toast.success(t("createCourse.success"));
      router.push(`/${locale}/dashboard/instructor/courses/${course.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("createCourse.error"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-[#1F2937]";
  const labelClass = "block text-sm font-medium text-[#374151] mb-1.5";

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 max-w-3xl">
              {/* Back Button */}
              <Link
                href={`/${locale}/dashboard/instructor/courses`}
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              <h1 className="text-xl font-bold text-[#1F2937] mb-6">
                {t("createCourse.title")}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Course Title */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h2 className="text-base font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.basicInfo")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.courseTitle")} *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.courseTitleAr")}
                      </label>
                      <input
                        type="text"
                        name="titleAr"
                        value={form.titleAr}
                        onChange={handleChange}
                        className={inputClass}
                        dir="rtl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>
                        {t("createCourse.description")}
                      </label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className={inputClass}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>
                        {t("createCourse.descriptionAr")}
                      </label>
                      <textarea
                        name="descriptionAr"
                        value={form.descriptionAr}
                        onChange={handleChange}
                        rows={3}
                        className={inputClass}
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>

                {/* Course Thumbnail */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h2 className="text-base font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.courseImage")}
                  </h2>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleThumbnailSelect}
                    className="hidden"
                  />
                  {thumbnailPreview ? (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-[#E5E7EB]">
                      <Image
                        src={thumbnailPreview}
                        alt="Course thumbnail"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {uploadingThumbnail && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={removeThumbnail}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full hover:bg-white transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4 text-[#6B7280]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 border-2 border-dashed border-[#E5E7EB] rounded-lg flex flex-col items-center justify-center gap-2 text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                    >
                      <ImagePlus className="w-8 h-8" />
                      <span className="text-sm font-medium">
                        {t("createCourse.uploadImage")}
                      </span>
                      <span className="text-xs">
                        {t("createCourse.imageHint")}
                      </span>
                    </button>
                  )}
                </div>

                {/* Course Settings */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h2 className="text-base font-semibold text-[#1F2937] mb-4">
                    {t("createCourse.courseSettings")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.deliveryType")} *
                      </label>
                      <select
                        name="deliveryType"
                        value={form.deliveryType}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="zoom">{t("courses.delivery.zoom")}</option>
                        <option value="onsite">{t("courses.delivery.onsite")}</option>
                        <option value="blended">{t("courses.delivery.blended")}</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.maxEnrollment")}
                      </label>
                      <input
                        type="number"
                        name="maxEnrollment"
                        value={form.maxEnrollment}
                        onChange={handleChange}
                        min="1"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.startDate")}
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={form.startDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("createCourse.endDate")}
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={form.endDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 justify-end">
                  <Link
                    href={`/${locale}/dashboard/instructor/courses`}
                    className="px-5 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                  >
                    {t("createCourse.cancel")}
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t("createCourse.submit")}
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
