"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface CourseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  selectedCertifications: string[];
  onCertificationChange: (certs: string[]) => void;
  selectedPricing: string;
  onPricingChange: (pricing: string) => void;
  cmeAccredited: string;
  onCmeAccreditedChange: (value: string) => void;
  availability: string;
  onAvailabilityChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  courseTypes: string[];
  certifications: string[];
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const CourseFilters = ({
  searchQuery,
  onSearchChange,
  selectedTypes,
  onTypeChange,
  selectedCertifications,
  onCertificationChange,
  selectedPricing,
  onPricingChange,
  cmeAccredited,
  onCmeAccreditedChange,
  availability,
  onAvailabilityChange,
  language,
  onLanguageChange,
  sortBy,
  onSortByChange,
  courseTypes,
  certifications,
  variant = "desktop",
  isRTL = false,
}: CourseFiltersProps) => {
  const t = useTranslations("coursesPage");

  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypeChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypeChange([...selectedTypes, type]);
    }
  };

  const handleCertToggle = (cert: string) => {
    if (selectedCertifications.includes(cert)) {
      onCertificationChange(selectedCertifications.filter((c) => c !== cert));
    } else {
      onCertificationChange([...selectedCertifications, cert]);
    }
  };

  const getTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      "Online courses": t("filters.onlineCourses"),
      "On-site courses": t("filters.onSiteCourses"),
      "Live Online": t("filters.liveOnline"),
      "Hybrid": t("filters.hybrid"),
      zoom: t("filters.zoom"),
      onsite: t("filters.onsite"),
      blended: t("filters.blended"),
    };
    return typeMap[type] || type;
  };

  const getCertLabel = (cert: string) => {
    const certMap: { [key: string]: string } = {
      BHA: t("filters.bha"),
      NHA: t("filters.nha"),
      SCFHS: t("filters.scfhs"),
    };
    return certMap[cert] || cert;
  };

  if (variant === "mobile") {
    return (
      <div className="bg-[#EEF3F7] rounded-xl p-4 mb-6">
        {/* Search */}
        <div className="relative mb-4">
          <Search
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]`}
          />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2.5 bg-white rounded-lg text-sm text-[#06080b] placeholder:text-[#71717A] outline-none`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>

        {/* Horizontal Scrollable Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {courseTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeToggle(type)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedTypes.includes(type)
                  ? "bg-[#06080b] text-white"
                  : "bg-white text-[#06080b]"
              }`}
            >
              {getTypeLabel(type)}
            </button>
          ))}

          {/* Pricing chips */}
          {["free", "paid"].map((p) => (
            <button
              key={p}
              onClick={() =>
                onPricingChange(selectedPricing === p ? "" : p)
              }
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedPricing === p
                  ? "bg-[#06080b] text-white"
                  : "bg-white text-[#06080b]"
              }`}
            >
              {t(`filters.${p}`)}
            </button>
          ))}

          {/* Sort chips */}
          {["newest", "starting_soon", "popular", "rating"].map((s) => (
            <button
              key={s}
              onClick={() => onSortByChange(sortBy === s ? "" : s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s
                  ? "bg-[#06080b] text-white"
                  : "bg-white text-[#06080b]"
              }`}
            >
              {t(`filters.sort_${s}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const labelClass = "flex items-center gap-3 py-2 cursor-pointer w-full";
  const radioClass =
    "w-4 h-4 border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0";
  const checkboxClass =
    "w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0";
  const sectionTitle = "text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2";
  const divider = <div className="h-px bg-[#E5E7EB] my-4" />;

  return (
    <div
      className={`bg-[#EEF3F7] rounded-xl p-5 w-[240px] flex-shrink-0 ${isRTL ? "text-right" : "text-left"}`}
    >
      <h3 className="text-[#06080b] font-semibold text-base mb-4">
        {t("searchResults")}
      </h3>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]`}
        />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2.5 bg-white rounded-lg text-sm text-[#06080b] placeholder:text-[#71717A] outline-none`}
          dir={isRTL ? "rtl" : "ltr"}
        />
      </div>

      {/* Course Types (delivery) */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.deliveryType")}</p>
        {courseTypes.map((type) => (
          <label key={type} className={labelClass}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => handleTypeToggle(type)}
              className={checkboxClass}
            />
            <span className="text-[#06080b] text-sm">{getTypeLabel(type)}</span>
          </label>
        ))}
      </div>

      {divider}

      {/* Certifications */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.certification")}</p>
        {certifications.map((cert) => (
          <label key={cert} className={labelClass}>
            <input
              type="checkbox"
              checked={selectedCertifications.includes(cert)}
              onChange={() => handleCertToggle(cert)}
              className={checkboxClass}
            />
            <span className="text-[#06080b] text-sm">{getCertLabel(cert)}</span>
          </label>
        ))}
      </div>

      {divider}

      {/* Pricing */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.pricing")}</p>
        {["", "free", "paid"].map((val) => (
          <label key={val || "all"} className={labelClass}>
            <input
              type="radio"
              name="pricing"
              checked={selectedPricing === val}
              onChange={() => onPricingChange(val)}
              className={radioClass}
            />
            <span className="text-[#06080b] text-sm">
              {val === ""
                ? t("filters.all")
                : t(`filters.${val}`)}
            </span>
          </label>
        ))}
      </div>

      {divider}

      {/* CME Accredited */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.cmeAccredited")}</p>
        {["", "true", "false"].map((val) => (
          <label key={val || "all"} className={labelClass}>
            <input
              type="radio"
              name="cmeAccredited"
              checked={cmeAccredited === val}
              onChange={() => onCmeAccreditedChange(val)}
              className={radioClass}
            />
            <span className="text-[#06080b] text-sm">
              {val === ""
                ? t("filters.all")
                : val === "true"
                  ? t("filters.cmeYes")
                  : t("filters.cmeNo")}
            </span>
          </label>
        ))}
      </div>

      {divider}

      {/* Availability */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.availability")}</p>
        {["", "open", "starting_soon", "full"].map((val) => (
          <label key={val || "all"} className={labelClass}>
            <input
              type="radio"
              name="availability"
              checked={availability === val}
              onChange={() => onAvailabilityChange(val)}
              className={radioClass}
            />
            <span className="text-[#06080b] text-sm">
              {val === ""
                ? t("filters.all")
                : t(`filters.avail_${val}`)}
            </span>
          </label>
        ))}
      </div>

      {divider}

      {/* Language */}
      <div className="mb-2">
        <p className={sectionTitle}>{t("filters.language")}</p>
        {["", "en", "ar", "both"].map((val) => (
          <label key={val || "all"} className={labelClass}>
            <input
              type="radio"
              name="language"
              checked={language === val}
              onChange={() => onLanguageChange(val)}
              className={radioClass}
            />
            <span className="text-[#06080b] text-sm">
              {val === ""
                ? t("filters.all")
                : t(`filters.lang_${val}`)}
            </span>
          </label>
        ))}
      </div>

      {divider}

      {/* Sort By */}
      <div>
        <p className={sectionTitle}>{t("filters.sortBy")}</p>
        {["newest", "starting_soon", "popular", "rating"].map((val) => (
          <label key={val} className={labelClass}>
            <input
              type="radio"
              name="sortBy"
              checked={sortBy === val}
              onChange={() => onSortByChange(val)}
              className={radioClass}
            />
            <span className="text-[#06080b] text-sm">
              {t(`filters.sort_${val}`)}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default CourseFilters;
