"use client";

import { Search } from "lucide-react";

export interface CourseFiltersLabels {
  // Section visibility
  showSearchBar?: boolean;
  showDeliveryFilter?: boolean;
  showPricingFilter?: boolean;
  showAvailabilityFilter?: boolean;
  showLanguageFilter?: boolean;
  showSortBy?: boolean;
  // Chrome strings
  searchPlaceholder?: string;
  sidebarFilterTitle?: string;
  filterAllLabel?: string;
  filterDeliveryLabel?: string;
  filterZoomLabel?: string;
  filterOnsiteLabel?: string;
  filterBlendedLabel?: string;
  filterSelfPacedLabel?: string;
  filterWebinarLabel?: string;
  filterPricingLabel?: string;
  filterFreeLabel?: string;
  filterPaidLabel?: string;
  filterOnSaleLabel?: string;
  filterAvailabilityLabel?: string;
  filterAvailOpenLabel?: string;
  filterAvailStartingSoonLabel?: string;
  filterAvailFullLabel?: string;
  filterLanguageLabel?: string;
  filterLangEnLabel?: string;
  filterLangArLabel?: string;
  filterLangBothLabel?: string;
  filterSortByLabel?: string;
  filterSortNewestLabel?: string;
  filterSortRatingLabel?: string;
  filterSortFeaturedLabel?: string;
}

interface CourseFiltersProps extends CourseFiltersLabels {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  selectedPricing: string;
  onPricingChange: (pricing: string) => void;
  availability: string;
  onAvailabilityChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  courseTypes: string[];
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const CourseFilters = ({
  searchQuery,
  onSearchChange,
  selectedTypes,
  onTypeChange,
  selectedPricing,
  onPricingChange,
  availability,
  onAvailabilityChange,
  language,
  onLanguageChange,
  sortBy,
  onSortByChange,
  courseTypes,
  variant = "desktop",
  isRTL = false,
  // Visibility (default true when unset)
  showSearchBar = true,
  showDeliveryFilter = true,
  showPricingFilter = true,
  showAvailabilityFilter = true,
  showLanguageFilter = true,
  showSortBy = true,
  // Labels
  searchPlaceholder,
  sidebarFilterTitle,
  filterAllLabel,
  filterDeliveryLabel,
  filterZoomLabel,
  filterOnsiteLabel,
  filterBlendedLabel,
  filterSelfPacedLabel,
  filterWebinarLabel,
  filterPricingLabel,
  filterFreeLabel,
  filterPaidLabel,
  filterOnSaleLabel,
  filterAvailabilityLabel,
  filterAvailOpenLabel,
  filterAvailStartingSoonLabel,
  filterAvailFullLabel,
  filterLanguageLabel,
  filterLangEnLabel,
  filterLangArLabel,
  filterLangBothLabel,
  filterSortByLabel,
  filterSortNewestLabel,
  filterSortRatingLabel,
  filterSortFeaturedLabel,
}: CourseFiltersProps) => {
  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypeChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypeChange([...selectedTypes, type]);
    }
  };

  // Option → label mapping (empty label = hidden).
  // Webinar falls back to a built-in localized label so the filter always
  // works even before the Strapi catalog entity is updated with the new
  // `filterWebinarLabel` field.
  const deliveryLabelMap: Record<string, string | undefined> = {
    zoom: filterZoomLabel,
    onsite: filterOnsiteLabel,
    blended: filterBlendedLabel,
    "self-paced": filterSelfPacedLabel,
    webinar: filterWebinarLabel ?? (isRTL ? "ويبينار" : "Webinar"),
  };

  const visibleCourseTypes = courseTypes.filter((t) => !!deliveryLabelMap[t]);

  const pricingOptions: Array<{ value: string; label: string | undefined }> = [
    { value: "", label: filterAllLabel },
    { value: "free", label: filterFreeLabel },
    { value: "paid", label: filterPaidLabel },
    // "On sale" is a status filter but rides in the same radio group so
    // students see "All / Free / Paid / On sale" as one decision.
    { value: "on_sale", label: filterOnSaleLabel },
  ];
  const visiblePricing = pricingOptions.filter((o) => !!o.label);

  const availabilityOptions: Array<{ value: string; label: string | undefined }> = [
    { value: "", label: filterAllLabel },
    { value: "open", label: filterAvailOpenLabel },
    { value: "starting_soon", label: filterAvailStartingSoonLabel },
    { value: "full", label: filterAvailFullLabel },
  ];
  const visibleAvailability = availabilityOptions.filter((o) => !!o.label);

  const languageOptions: Array<{ value: string; label: string | undefined }> = [
    { value: "", label: filterAllLabel },
    { value: "en", label: filterLangEnLabel },
    { value: "ar", label: filterLangArLabel },
    { value: "both", label: filterLangBothLabel },
  ];
  const visibleLanguages = languageOptions.filter((o) => !!o.label);

  const sortOptions: Array<{ value: string; label: string | undefined }> = [
    { value: "newest", label: filterSortNewestLabel },
    { value: "rating", label: filterSortRatingLabel },
    { value: "featured", label: filterSortFeaturedLabel },
  ];
  const visibleSort = sortOptions.filter((o) => !!o.label);

  // If *everything* is hidden, render nothing
  const anyVisible =
    (showSearchBar && !!searchPlaceholder) ||
    (showDeliveryFilter && visibleCourseTypes.length > 0) ||
    (showPricingFilter && visiblePricing.length > 0) ||
    (showAvailabilityFilter && visibleAvailability.length > 0) ||
    (showLanguageFilter && visibleLanguages.length > 0) ||
    (showSortBy && visibleSort.length > 0);

  if (!anyVisible) return null;

  if (variant === "mobile") {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl p-4 mb-6">
        {showSearchBar && searchPlaceholder && (
          <div className="relative mb-4">
            <Search
              className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2.5 bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none`}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {showDeliveryFilter &&
            visibleCourseTypes.map((type) => (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTypes.includes(type)
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-page)] text-[var(--color-text-primary)] border border-[var(--color-input-border)]"
                }`}
              >
                {deliveryLabelMap[type]}
              </button>
            ))}

          {showPricingFilter &&
            visiblePricing
              .filter((o) => o.value !== "")
              .map((o) => (
                <button
                  key={o.value}
                  onClick={() =>
                    onPricingChange(selectedPricing === o.value ? "" : o.value)
                  }
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedPricing === o.value
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-page)] text-[var(--color-text-primary)] border border-[var(--color-input-border)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}

          {showSortBy &&
            visibleSort.map((o) => (
              <button
                key={o.value}
                onClick={() => onSortByChange(sortBy === o.value ? "" : o.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortBy === o.value
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-page)] text-[var(--color-text-primary)] border border-[var(--color-input-border)]"
                }`}
              >
                {o.label}
              </button>
            ))}
        </div>
      </div>
    );
  }

  // ─── Desktop sidebar ──────────────────────────────────────
  const labelClass = "flex items-center gap-3 py-2 cursor-pointer w-full";
  const radioClass =
    "w-4 h-4 border-[var(--color-border)] accent-[var(--color-primary)] focus:ring-0 cursor-pointer flex-shrink-0";
  const checkboxClass =
    "w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] focus:ring-0 cursor-pointer flex-shrink-0";
  const sectionTitle =
    "text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2";
  const divider = <div className="h-px bg-[var(--color-border)] my-4" />;

  // Build the desktop sections dynamically so we can insert dividers only between visible ones
  const sections: React.ReactNode[] = [];

  if (showDeliveryFilter && visibleCourseTypes.length > 0) {
    sections.push(
      <div key="delivery" className="mb-2">
        {filterDeliveryLabel && <p className={sectionTitle}>{filterDeliveryLabel}</p>}
        {visibleCourseTypes.map((type) => (
          <label key={type} className={labelClass}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => handleTypeToggle(type)}
              className={checkboxClass}
            />
            <span className="text-[var(--color-text-primary)] text-sm">{deliveryLabelMap[type]}</span>
          </label>
        ))}
      </div>,
    );
  }

  if (showPricingFilter && visiblePricing.length > 0) {
    sections.push(
      <div key="pricing" className="mb-2">
        {filterPricingLabel && <p className={sectionTitle}>{filterPricingLabel}</p>}
        {visiblePricing.map((o) => (
          <label key={o.value || "all"} className={labelClass}>
            <input
              type="radio"
              name="pricing"
              checked={selectedPricing === o.value}
              onChange={() => onPricingChange(o.value)}
              className={radioClass}
            />
            <span className="text-[var(--color-text-primary)] text-sm">{o.label}</span>
          </label>
        ))}
      </div>,
    );
  }

  if (showAvailabilityFilter && visibleAvailability.length > 0) {
    sections.push(
      <div key="availability" className="mb-2">
        {filterAvailabilityLabel && <p className={sectionTitle}>{filterAvailabilityLabel}</p>}
        {visibleAvailability.map((o) => (
          <label key={o.value || "all"} className={labelClass}>
            <input
              type="radio"
              name="availability"
              checked={availability === o.value}
              onChange={() => onAvailabilityChange(o.value)}
              className={radioClass}
            />
            <span className="text-[var(--color-text-primary)] text-sm">{o.label}</span>
          </label>
        ))}
      </div>,
    );
  }

  if (showLanguageFilter && visibleLanguages.length > 0) {
    sections.push(
      <div key="language" className="mb-2">
        {filterLanguageLabel && <p className={sectionTitle}>{filterLanguageLabel}</p>}
        {visibleLanguages.map((o) => (
          <label key={o.value || "all"} className={labelClass}>
            <input
              type="radio"
              name="language"
              checked={language === o.value}
              onChange={() => onLanguageChange(o.value)}
              className={radioClass}
            />
            <span className="text-[var(--color-text-primary)] text-sm">{o.label}</span>
          </label>
        ))}
      </div>,
    );
  }

  if (showSortBy && visibleSort.length > 0) {
    sections.push(
      <div key="sortBy">
        {filterSortByLabel && <p className={sectionTitle}>{filterSortByLabel}</p>}
        {visibleSort.map((o) => (
          <label key={o.value} className={labelClass}>
            <input
              type="radio"
              name="sortBy"
              checked={sortBy === o.value}
              onChange={() => onSortByChange(o.value)}
              className={radioClass}
            />
            <span className="text-[var(--color-text-primary)] text-sm">{o.label}</span>
          </label>
        ))}
      </div>,
    );
  }

  return (
    <div
      className={`bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-5 w-[240px] flex-shrink-0 ${isRTL ? "text-right" : "text-left"}`}
    >
      {sidebarFilterTitle && (
        <h3 className="text-[var(--color-text-primary)] font-semibold text-base mb-4">
          {sidebarFilterTitle}
        </h3>
      )}

      {showSearchBar && searchPlaceholder && (
        <div className="relative mb-6">
          <Search
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2.5 bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>
      )}

      {sections.map((section, idx) => (
        <div key={idx}>
          {section}
          {idx < sections.length - 1 && divider}
        </div>
      ))}
    </div>
  );
};

export default CourseFilters;
