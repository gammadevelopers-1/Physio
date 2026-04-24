"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Mail, Phone, MapPin, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { ContactPage } from "@/lib/strapi/types";

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), {
  ssr: false,
});

const ContactForm = ({ strapiData }: { strapiData?: ContactPage | null }) => {
  const t = useTranslations("contactPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Helper: use Strapi data if available, otherwise fall back to translations
  const s = (field: keyof ContactPage, translationKey: string) => {
    const val = strapiData?.[field];
    return (typeof val === 'string' && val) ? val : t(translationKey);
  };

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    issueType: "",
    countryCode: "SA",
    phoneNumber: "",
    subject: "",
    description: "",
  });

  const [isIssueTypeOpen, setIsIssueTypeOpen] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const maxDescriptionLength = 275;

  const issueTypes = [
    { key: "technicalSupport", label: s("issueTypeTechnicalSupport", "issueTypes.technicalSupport") },
    { key: "billingIssue", label: s("issueTypeBillingIssue", "issueTypes.billingIssue") },
    { key: "courseInquiry", label: s("issueTypeCourseInquiry", "issueTypes.courseInquiry") },
    { key: "partnership", label: s("issueTypePartnership", "issueTypes.partnership") },
    { key: "other", label: s("issueTypeOther", "issueTypes.other") },
  ];

  // Contact details come strictly from Strapi — no hardcoded fallbacks.
  // If a field is empty in Strapi, the corresponding block hides entirely.
  const email = strapiData?.generalInquiryEmail || "";
  const phone = strapiData?.technicalSupportPhone || "";
  const addressTitle = strapiData?.address || "";
  const mapLat = strapiData?.mapLatitude;
  const mapLng = strapiData?.mapLongitude;
  const mapPopup = strapiData?.mapPopupText || "";
  const heroTitle = strapiData?.title || "";
  const heroSubtitle = strapiData?.subtitle || "";
  const hasCoordinates = typeof mapLat === "number" && typeof mapLng === "number";

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "description" && value.length > maxDescriptionLength) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <section
      className="overflow-hidden bg-[var(--color-border-subtle)] md:bg-[var(--color-surface-page)]"
    >
      <div
        className="flex flex-col max-w-[1312px] mx-auto px-4 py-16 md:px-16 md:py-20"
      >
        {/* Main Content: Contact Info + Form */}
        <div className="flex flex-col md:flex-row md:gap-20 md:items-stretch">
          {/* Left Column - Contact Info (Right in RTL) */}
          <div className="flex flex-col md:flex-1 md:justify-between items-start">
            {/* Header — show only if title or subtitle configured in Strapi */}
            {(heroTitle || heroSubtitle) && (
              <div className="flex flex-col gap-4 mb-8 md:mb-0 items-start">
                {heroTitle && (
                  <h1
                    className="font-semibold text-[var(--color-text-primary)] tracking-[-0.15px] md:tracking-[-0.24px]"
                    style={{
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "30px",
                      lineHeight: "100%",
                    }}
                  >
                    {heroTitle}
                  </h1>
                )}
                {heroSubtitle && (
                  <p
                    className="text-[var(--color-text-primary)]"
                    style={{
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "18px",
                      fontWeight: 400,
                      lineHeight: "28px",
                    }}
                  >
                    {heroSubtitle}
                  </p>
                )}
              </div>
            )}

            {/* Contact Info Cards — each shows only when its primary value exists in Strapi */}
            {(email || phone || addressTitle) && (
              <div className="flex flex-col gap-6 md:gap-10 mb-8 md:mb-0 md:flex-1 md:justify-center md:mt-10 items-start">
                {/* General Inquiry — hides if no email configured */}
                {email && (
                  <div className="flex flex-col gap-2 md:gap-4 items-start">
                    <Mail
                      className="w-6 h-6 text-[var(--color-primary)]"
                      strokeWidth={1.67}
                    />
                    <div className="flex flex-col gap-1 md:gap-2 items-start">
                      {strapiData?.generalInquiryLabel && (
                        <h3
                          className="font-semibold text-[var(--color-text-secondary)]"
                          style={{
                            fontFamily: "var(--typeface-family, 'DM Sans')",
                            fontSize: "20px",
                            lineHeight: "32px",
                          }}
                        >
                          {strapiData.generalInquiryLabel}
                        </h3>
                      )}
                      <a
                        href={`mailto:${email}`}
                        className="text-[var(--color-text-primary)] underline"
                        style={{
                          fontFamily: "Roboto, sans-serif",
                          fontSize: "16px",
                          fontWeight: 400,
                          lineHeight: "24px",
                        }}
                      >
                        {email}
                      </a>
                    </div>
                  </div>
                )}

                {/* Technical Support — hides if no phone configured */}
                {phone && (
                  <div className="flex flex-col gap-2 md:gap-4 items-start">
                    <Phone
                      className="w-6 h-6 text-[var(--color-primary)]"
                      strokeWidth={1.67}
                    />
                    <div className="flex flex-col gap-1 md:gap-2 items-start">
                      {strapiData?.technicalSupportLabel && (
                        <h3
                          className="font-semibold text-[var(--color-text-secondary)]"
                          style={{
                            fontFamily: "var(--typeface-family, 'DM Sans')",
                            fontSize: "20px",
                            lineHeight: "32px",
                          }}
                        >
                          {strapiData.technicalSupportLabel}
                        </h3>
                      )}
                      <p
                        className="text-[var(--color-text-primary)]"
                        style={{
                          fontFamily: "Roboto, sans-serif",
                          fontSize: "16px",
                          fontWeight: 400,
                          lineHeight: "24px",
                          direction: "ltr",
                        }}
                      >
                        {phone}
                      </p>
                    </div>
                  </div>
                )}

                {/* Location — hides if no address configured */}
                {addressTitle && (
                  <div className="flex flex-col gap-2 md:gap-4 items-start">
                    <MapPin
                      className="w-6 h-6 text-[var(--color-primary)]"
                      strokeWidth={1.67}
                    />
                    <div className="flex flex-col gap-2 md:gap-4 items-start">
                      <h3
                        className="font-semibold text-[var(--color-text-secondary)]"
                        style={{
                          fontFamily: "var(--typeface-family, 'DM Sans')",
                          fontSize: "20px",
                          lineHeight: "32px",
                        }}
                      >
                        {addressTitle}
                      </h3>
                      {strapiData?.getDirectionsLabel && hasCoordinates && (
                        <a
                          href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--color-text-primary)] hover:underline w-fit"
                          style={{
                            fontFamily: "Roboto, sans-serif",
                            fontSize: "14px",
                            fontWeight: 500,
                            lineHeight: "24px",
                          }}
                        >
                          {strapiData.getDirectionsLabel}
                          {isRTL ? (
                            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                          ) : (
                            <ChevronRight className="w-4 h-4" strokeWidth={2} />
                          )}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Contact Form (Left in RTL) */}
          <div
            className="bg-[var(--color-surface-card)] p-5 rounded-3xl shadow-[_-2px_8px_2px_0px_rgba(0,0,0,0),_-1px_5px_2px_0px_rgba(0,0,0,0.01),_-1px_3px_2px_0px_rgba(0,0,0,0.03),_0px_1px_1px_0px_rgba(0,0,0,0.05),_0px_0px_1px_0px_rgba(0,0,0,0.06)] md:flex-1 md:p-8"
          >
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-16 md:gap-6 md:h-full"
            >
              <div className="flex flex-col gap-4">
                {/* Full Name */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formFullNameLabel", "form.fullName")} <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--color-primary)]"
                    style={{
                      padding: "10px 14px",
                      height: "44px",
                      textAlign: isRTL ? "right" : "left",
                    }}
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formEmailLabel", "form.emailAddress")} <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div className="relative">
                    <Mail
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-border-subtle)] ${isRTL ? "right-3.5" : "left-3.5"}`}
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--color-primary)]"
                      style={{
                        padding: isRTL ? "10px 48px 10px 14px" : "10px 14px 10px 48px",
                        height: "44px",
                        textAlign: isRTL ? "right" : "left",
                      }}
                    />
                  </div>
                </div>

                {/* Select Issue Type */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formIssueTypeLabel", "form.selectIssueType")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsIssueTypeOpen(!isIssueTypeOpen)}
                      className={`w-full bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] flex items-center justify-between cursor-pointer ${isRTL ? "flex-row-reverse" : ""}`}
                      style={{
                        padding: "10px 14px",
                        height: "44px",
                      }}
                    >
                      <span
                        className={
                          formData.issueType
                            ? "text-[var(--on-surface-default)]"
                            : "text-[var(--on-surface-variant)]"
                        }
                        style={{
                          fontFamily: "var(--typeface-family, 'DM Sans')",
                          fontSize: "16px",
                          fontWeight: 400,
                          lineHeight: "24px",
                        }}
                      >
                        {formData.issueType || s("formSelectOptionLabel", "form.selectAnOption")}
                      </span>
                      <ChevronDown
                        className={`w-6 h-6 text-[var(--on-surface-variant)] transition-transform ${isIssueTypeOpen ? "rotate-180" : ""}`}
                        strokeWidth={1.5}
                      />
                    </button>
                    {isIssueTypeOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-lg z-10">
                        {issueTypes.map((type) => (
                          <button
                            key={type.key}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                issueType: type.label,
                              }));
                              setIsIssueTypeOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                            style={{
                              fontFamily: "var(--typeface-family, 'DM Sans')",
                              fontSize: "16px",
                              fontWeight: 400,
                              lineHeight: "24px",
                            }}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formPhoneLabel", "form.phoneNumber")} <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div className="flex bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] overflow-hidden" style={{ height: "44px" }}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                        className={`h-full px-3.5 flex items-center gap-1 cursor-pointer ${isRTL ? "border-l border-[var(--color-border-subtle)]" : "border-r border-[var(--color-border-subtle)]"}`}
                      >
                        <span
                          className="text-[var(--color-text-primary)] text-sm md:text-base"
                          style={{ fontSize: "16px" }}
                        >
                          {formData.countryCode}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isCountryOpen ? "rotate-180" : ""}`}
                          strokeWidth={1.5}
                        />
                      </button>
                      {isCountryOpen && (
                        <div className={`absolute top-full mt-1 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 min-w-[80px] ${isRTL ? "right-0" : "left-0"}`}>
                          {["SA", "AE", "US", "UK"].map((code) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  countryCode: code,
                                }));
                                setIsCountryOpen(false);
                              }}
                              className={`w-full px-3.5 py-2 hover:bg-[var(--color-border-subtle)] transition-colors text-sm ${isRTL ? "text-right" : "text-left"}`}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      required
                      className="flex-1 focus:outline-none"
                      style={{
                        padding: "10px 14px",
                        textAlign: isRTL ? "right" : "left",
                        direction: "ltr",
                      }}
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formSubjectLabel", "form.subject")}
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--color-primary)]"
                    style={{
                      padding: "10px 14px",
                      height: "44px",
                      textAlign: isRTL ? "right" : "left",
                    }}
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className={`flex items-center gap-2 h-6 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                    style={{
                      color: "var(--on-surface-default, var(--color-text-primary))",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    {s("formDescriptionLabel", "form.description")}
                  </label>
                  <div className="relative">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full h-[140px] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                      style={{
                        padding: "10px 14px",
                        textAlign: isRTL ? "right" : "left",
                      }}
                    />
                    <span
                      className={`absolute bottom-2.5 text-[var(--on-surface-variant)] leading-4 ${isRTL ? "left-3.5" : "right-3.5"}`}
                      style={{
                        fontSize: "12px",
                      }}
                    >
                      {isRTL
                        ? `${s("formCharactersLeftLabel", "form.charactersLeft")} ${maxDescriptionLength - formData.description.length}`
                        : `${maxDescriptionLength - formData.description.length} ${s("formCharactersLeftLabel", "form.charactersLeft")}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className={`flex mt-2 md:mt-0 ${isRTL ? "md:justify-start" : "md:justify-end"}`}>
                <button
                  type="submit"
                  className="w-full md:w-auto h-12 md:h-10 md:min-w-[80px] px-5 rounded-xl font-medium text-sm text-white"
                  style={{
                    background: isRTL
                      ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                      : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                  }}
                >
                  {s("formSubmitLabel", "form.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Map Section — only renders when coordinates exist in Strapi and showMap isn't disabled */}
        {strapiData?.showMap !== false && hasCoordinates && (
          <div
            className="flex flex-col justify-center items-center w-full mt-10 md:mt-20"
            style={{
              gap: "40px",
              padding: "32px 0 0 0",
            }}
          >
            <div
              className="w-full h-[400px] rounded-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-card)] relative z-0"
              style={{
                boxShadow:
                  "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
              }}
            >
              <Map
                center={[mapLat as number, mapLng as number]}
                zoom={14}
                popupText={mapPopup}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ContactForm;
