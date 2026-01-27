"use client";

import { Search } from "lucide-react";

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
}: CourseFiltersProps) => {
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

  if (variant === "mobile") {
    return (
      <div className="bg-[#EEF3F7] rounded-xl p-4 mb-6">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search for"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg text-sm text-[#06080b] placeholder:text-[#71717A] outline-none"
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
              {type}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#EEF3F7] rounded-xl p-5 w-[240px] flex-shrink-0">
      <h3 className="text-[#06080b] font-semibold text-base mb-4">Search results</h3>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
        <input
          type="text"
          placeholder="Search for"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg text-sm text-[#06080b] placeholder:text-[#71717A] outline-none"
        />
      </div>

      {/* Course Types */}
      <div className="mb-6">
        {courseTypes.map((type) => (
          <label key={type} className="flex items-center gap-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => handleTypeToggle(type)}
              className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer"
            />
            <span className="text-[#06080b] text-sm">{type}</span>
          </label>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#E5E7EB] mb-6" />

      {/* Certifications */}
      <div className="mb-6">
        {certifications.map((cert) => (
          <label key={cert} className="flex items-center gap-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCertifications.includes(cert)}
              onChange={() => handleCertToggle(cert)}
              className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer"
            />
            <span className="text-[#06080b] text-sm">{cert}</span>
          </label>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#E5E7EB] mb-6" />

      {/* Pricing */}
      <div>
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedPricing.includes("Paid")}
            onChange={() => handlePricingToggle("Paid")}
            className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer"
          />
          <span className="text-[#06080b] text-sm">Paid</span>
        </label>
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedPricing.includes("Free")}
            onChange={() => handlePricingToggle("Free")}
            className="w-4 h-4 rounded border-[#D4D4D8] text-[#06080b] focus:ring-0 cursor-pointer"
          />
          <span className="text-[#06080b] text-sm">Free</span>
        </label>
      </div>
    </div>
  );
};

export default CourseFilters;
