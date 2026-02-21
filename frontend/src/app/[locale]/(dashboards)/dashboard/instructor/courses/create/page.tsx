"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  Image as ImageIcon,
} from "lucide-react";
import { instructorApi } from "@/lib/api";

type DeliveryType = "zoom" | "onsite" | "blended";

export default function CreateCoursePage() {
  const t = useTranslations("instructorDashboard.createCourse");
  const router = useRouter();
  const locale = useLocale();

  const [saving, setSaving] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("zoom");
  const [maxEnrollment, setMaxEnrollment] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  const handleThumbnailUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailUploading(true);
    try {
      const result = await instructorApi.uploadThumbnail(file);
      setThumbnail(result.url);
    } catch {
      toast.error(t("thumbnailError"));
    } finally {
      setThumbnailUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }

    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    setSaving(true);
    try {
      const courseData: Parameters<typeof instructorApi.createCourse>[0] = {
        title: title.trim(),
        deliveryType,
      };

      if (titleAr.trim()) courseData.titleAr = titleAr.trim();
      if (description.trim()) courseData.description = description.trim();
      if (descriptionAr.trim()) courseData.descriptionAr = descriptionAr.trim();
      if (thumbnail) courseData.thumbnail = thumbnail;
      if (maxEnrollment) courseData.maxEnrollment = Number(maxEnrollment);
      if (startDate) courseData.startDate = startDate;
      if (endDate) courseData.endDate = endDate;

      const course = await instructorApi.createCourse(courseData);
      toast.success(t("success"));
      router.push(
        `/${locale}/dashboard/instructor/courses/${course.id}`
      );
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("cancel")}
        </button>

        {/* Page Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#D4A520]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937]">{t("title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              {t("basicInfo")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("courseTitle")} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("courseTitleAr")}
                </label>
                <input
                  type="text"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  dir="rtl"
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("description")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("descriptionAr")}
                </label>
                <textarea
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  rows={4}
                  dir="rtl"
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Course Settings */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              {t("courseSettings")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("deliveryType")} *
                </label>
                <select
                  value={deliveryType}
                  onChange={(e) =>
                    setDeliveryType(e.target.value as DeliveryType)
                  }
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none bg-white"
                >
                  <option value="zoom">Zoom</option>
                  <option value="onsite">On-site</option>
                  <option value="blended">Blended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("maxEnrollment")}
                </label>
                <input
                  type="number"
                  value={maxEnrollment}
                  onChange={(e) =>
                    setMaxEnrollment(
                      e.target.value ? parseInt(e.target.value) : ""
                    )
                  }
                  min={1}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Course Image */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              {t("courseImage")}
            </h2>

            {thumbnail ? (
              <div className="relative w-full max-w-md">
                <img
                  src={thumbnail}
                  alt="Course thumbnail"
                  className="w-full h-48 object-cover rounded-lg border border-[#E5E7EB]"
                />
                <button
                  type="button"
                  onClick={() => setThumbnail("")}
                  className="absolute top-2 end-2 p-1.5 bg-white rounded-full shadow text-[#EF4444] hover:bg-[#FEE2E2] text-sm font-bold"
                >
                  X
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-[#D1D5DB] rounded-lg cursor-pointer hover:border-[#3B82F6] hover:bg-[#F9FAFB] transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                  disabled={thumbnailUploading}
                />
                {thumbnailUploading ? (
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-[#9CA3AF] mb-2" />
                    <span className="text-sm text-[#6B7280]">
                      {t("uploadImage")}
                    </span>
                    <span className="text-xs text-[#9CA3AF] mt-1">
                      {t("imageHint")}
                    </span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
