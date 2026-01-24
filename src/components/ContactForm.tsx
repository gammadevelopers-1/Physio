"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Mail, Phone, MapPin, ChevronRight, ChevronDown } from "lucide-react";

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--surface-container-low)]">
      <span className="text-[var(--on-surface-variant)]">Loading map...</span>
    </div>
  ),
});

const ContactForm = () => {
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
    "Technical Support",
    "Billing Issue",
    "Course Inquiry",
    "Partnership",
    "Other",
  ];

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
      className="overflow-hidden bg-[#F9FBFD] md:bg-[var(--surface-container-low)]"
    >
      <div
        className="flex flex-col max-w-[1312px] mx-auto px-4 py-16 md:px-16 md:py-20"
      >
        {/* Main Content: Contact Info + Form */}
        <div className="flex flex-col md:flex-row md:gap-20 md:items-stretch">
          {/* Left Column - Contact Info */}
          <div className="flex flex-col md:flex-1 md:justify-between">
            {/* Header */}
            <div className="flex flex-col gap-4 w-full mb-8 md:mb-0">
              <h1
                className="font-semibold text-[#06080B] tracking-[-0.15px] md:tracking-[-0.24px]"
                style={{
                  fontFamily: "var(--typeface-family, 'DM Sans')",
                  fontSize: "30px",
                  lineHeight: "100%",
                }}
              >
                Contact Us
              </h1>
              <p
                className="text-[#06080B]"
                style={{
                  fontFamily: "var(--typeface-family, 'DM Sans')",
                  fontSize: "18px",
                  fontWeight: 400,
                  lineHeight: "28px",
                }}
              >
                We are always ready to answer your questions and inquiries.
              </p>
            </div>

            {/* Contact Info Cards */}
            <div className="flex flex-col gap-6 md:gap-10 mb-8 md:mb-0 md:flex-1 md:justify-center md:mt-10">
              {/* General Inquiry */}
              <div className="flex flex-col gap-2 md:gap-4">
                <Mail
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-1 md:gap-2">
                  <h3
                    className="font-semibold text-[#4A4C4F]"
                    style={{
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "20px",
                      lineHeight: "32px",
                    }}
                  >
                    General Inquiry
                  </h3>
                  <a
                    href="mailto:inquiry@physioguidance.org"
                    className="text-[#06080B] underline"
                    style={{
                      fontFamily: "Roboto, sans-serif",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    inquiry@physioguidance.org
                  </a>
                </div>
              </div>

              {/* Technical Support */}
              <div className="flex flex-col gap-2 md:gap-4">
                <Phone
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-1 md:gap-2">
                  <h3
                    className="font-semibold text-[#4A4C4F]"
                    style={{
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "20px",
                      lineHeight: "32px",
                    }}
                  >
                    Technical Support
                  </h3>
                  <p
                    className="text-[#06080B]"
                    style={{
                      fontFamily: "Roboto, sans-serif",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    +966 920035022
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-2 md:gap-4">
                <MapPin
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-2 md:gap-4">
                  <h3
                    className="font-semibold text-[#4A4C4F]"
                    style={{
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "20px",
                      lineHeight: "32px",
                    }}
                  >
                    Xyz ,saudia arabia,
                  </h3>
                  <a
                    href="#"
                    className="flex items-center gap-1 text-[#06080B] hover:underline w-fit"
                    style={{
                      fontFamily: "Roboto, sans-serif",
                      fontSize: "14px",
                      fontWeight: 500,
                      lineHeight: "24px",
                    }}
                  >
                    Get Directions
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Contact Form */}
          <div
            className="bg-white p-5 rounded-3xl shadow-[_-2px_8px_2px_0px_rgba(0,0,0,0),_-1px_5px_2px_0px_rgba(0,0,0,0.01),_-1px_3px_2px_0px_rgba(0,0,0,0.03),_0px_1px_1px_0px_rgba(0,0,0,0.05),_0px_0px_1px_0px_rgba(0,0,0,0.06)] md:flex-1 md:p-8"
          >
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-16 md:gap-6 md:h-full"
            >
              <div className="flex flex-col gap-4">
                {/* Full Name */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Full Name <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                    style={{
                      padding: "10px 14px",
                      height: "44px",
                    }}
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Email address <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C8D5E1]"
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                      style={{
                        padding: "10px 14px 10px 48px",
                        height: "44px",
                      }}
                    />
                  </div>
                </div>

                {/* Select Issue Type */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Select issue type
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsIssueTypeOpen(!isIssueTypeOpen)}
                      className="w-full bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] flex items-center justify-between cursor-pointer"
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
                        {formData.issueType || "Select an option"}
                      </span>
                      <ChevronDown
                        className={`w-6 h-6 text-[var(--on-surface-variant)] transition-transform ${isIssueTypeOpen ? "rotate-180" : ""}`}
                        strokeWidth={1.5}
                      />
                    </button>
                    {isIssueTypeOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-lg z-10">
                        {issueTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                issueType: type,
                              }));
                              setIsIssueTypeOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--surface-container-low)] transition-colors"
                            style={{
                              fontFamily: "var(--typeface-family, 'DM Sans')",
                              fontSize: "16px",
                              fontWeight: 400,
                              lineHeight: "24px",
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Phone number <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div className="flex bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] overflow-hidden" style={{ height: "44px" }}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                        className="h-full px-3.5 flex items-center gap-1 cursor-pointer border-r border-[var(--outline-hover)]"
                      >
                        <span
                          className="text-[#181d27] text-sm md:text-base"
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
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[var(--outline-hover)] rounded-lg shadow-lg z-10 min-w-[80px]">
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
                              className="w-full px-3.5 py-2 text-left hover:bg-[var(--surface-container-low)] transition-colors text-sm"
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
                      }}
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                    style={{
                      padding: "10px 14px",
                      height: "44px",
                    }}
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col w-full gap-2">
                  <label
                    className="flex items-center gap-2 h-6"
                    style={{
                      color: "var(--on-surface-default, #06080B)",
                      fontFamily: "var(--typeface-family, 'DM Sans')",
                      fontSize: "16px",
                      fontWeight: 400,
                      lineHeight: "24px",
                    }}
                  >
                    Description
                  </label>
                  <div className="relative">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full h-[140px] bg-white border border-[var(--outline-hover)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)] resize-none"
                      style={{
                        padding: "10px 14px",
                      }}
                    />
                    <span
                      className="absolute bottom-2.5 right-3.5 text-[var(--on-surface-variant)] leading-4"
                      style={{
                        fontSize: "12px",
                      }}
                    >
                      {maxDescriptionLength - formData.description.length}{" "}
                      characters left
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex md:justify-end mt-2 md:mt-0">
                <button
                  type="submit"
                  className="w-full md:w-auto h-12 md:h-10 md:min-w-[80px] px-5 rounded-xl font-medium text-sm text-white"
                  style={{
                    background: "linear-gradient(to right, #a37f49, #6b4e24)",
                  }}
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Map Section */}
        <div
          className="flex flex-col justify-center items-center w-full mt-10 md:mt-20"
          style={{
            gap: "40px",
            padding: "32px 0 0 0",
          }}
        >
          <div
            className="w-full h-[400px] rounded-3xl overflow-hidden border border-[var(--outline-hover)] bg-white relative z-0"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            <Map
              center={[24.4539, 39.6142]}
              zoom={14}
              popupText="PhysioGuidance - Saudi Arabia"
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white flex items-center justify-around py-3 z-50"
        style={{
          boxShadow: "0px -1px 4px rgba(0,0,0,0.1)",
        }}
      >
        <a href="/" className="flex flex-col items-center gap-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--on-surface-variant)]">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="text-xs text-[var(--on-surface-variant)]">Home</span>
        </a>
        <a href="/search" className="flex flex-col items-center gap-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--on-surface-variant)]">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-xs text-[var(--on-surface-variant)]">Search</span>
        </a>
        <a href="/cart" className="flex flex-col items-center gap-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--on-surface-variant)]">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span className="text-xs text-[var(--on-surface-variant)]">Cart</span>
        </a>
        <button className="flex flex-col items-center gap-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--on-surface-variant)]">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="text-xs text-[var(--on-surface-variant)]">More</span>
        </button>
      </div>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-20" />
    </section>
  );
};

export default ContactForm;
