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
  selectedPricing: string[];
  onPricingChange: (pricing: string[]) => void;
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

  const handlePricingToggle = (pricing: string) => {
    if (selectedPricing.includes(pricing)) {
      onPricingChange(selectedPricing.filter((p) => p !== pricing));
    } else {
      onPricingChange([...selectedPricing, pricing]);
    }
  };

  // Map filter types to translated labels (matching exact keys from data)
  const getTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      "Online courses": t("filters.onlineCourses"),
      "On-site courses": t("filters.onSiteCourses"),
      "Live Online": t("filters.liveOnline"),
      "Hybrid": t("filters.hybrid"),
    };
    return typeMap[type] || type;
  };

  const getCertLabel = (cert: string) => {
    const certMap: { [key: string]: string } = {
      "BHA": t("filters.bha"),
      "NHA": t("filters.nha"),
      "SCFHS": t("filters.scfhs"),
    };
    return certMap[cert] || cert;
  };

  if (variant === "mobile") {
    return (
      <div className="bg-[#EEF3F7] rounded-xl p-4 mb-6">
        {/* Search */}
        <div className="relative mb-4">
          <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]`} />
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
        </div>
      </div>
    );
  }

  // Common label styles - dir="rtl" on parent handles the checkbox/text order automatically
  const labelClass = "flex items-center gap-3 py-2 cursor-pointer w-full";

  return (
    <div className={`bg-[#EEF3F7] rounded-xl p-5 w-[240px] flex-shrink-0 ${isRTL ? "text-right" : "text-left"}`}>
      <h3 className="text-[#06080b] font-semibold text-base mb-4">{t("searchResults")}</h3>

      {/* Search */}
      <div className="relative mb-6">
        <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]`} />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2.5 bg-white rounded-lg text-sm text-[#06080b] placeholder:text-[#71717A] outline-none`}
          dir={isRTL ? "rtl" : "ltr"}
        />
      </div>

      {/* Course Types */}
      <div className="mb-6">
        {courseTypes.map((type) => (
          <label key={type} className={labelClass}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => handleTypeToggle(type)}
              className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0"
            />
            <span className="text-[#06080b] text-sm">{getTypeLabel(type)}</span>
          </label>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#E5E7EB] mb-6" />

      {/* Certifications */}
      <div className="mb-6">
        {certifications.map((cert) => (
          <label key={cert} className={labelClass}>
            <input
              type="checkbox"
              checked={selectedCertifications.includes(cert)}
              onChange={() => handleCertToggle(cert)}
              className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0"
            />
            <span className="text-[#06080b] text-sm">{getCertLabel(cert)}</span>
          </label>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#E5E7EB] mb-6" />

      {/* Pricing */}
      <div>
        <label className={labelClass}>
          <input
            type="checkbox"
            checked={selectedPricing.includes("Paid")}
            onChange={() => handlePricingToggle("Paid")}
            className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0"
          />
          <span className="text-[#06080b] text-sm">{t("filters.paid")}</span>
        </label>
        <label className={labelClass}>
          <input
            type="checkbox"
            checked={selectedPricing.includes("Free")}
            onChange={() => handlePricingToggle("Free")}
            className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer flex-shrink-0"
          />
          <span className="text-[#06080b] text-sm">{t("filters.free")}</span>
        </label>
      </div>
    </div>
  );
};

export default CourseFilters;
