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
      className="bg-[var(--surface-container-low)] overflow-hidden"
      style={{ padding: "80px 64px" }}
    >
      <div className="max-w-[1312px] mx-auto flex flex-col gap-20">
        {/* Container 1: Contact Info + Form */}
        <div className="flex gap-20 items-stretch">
          {/* Left Column - Contact Info */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="flex flex-col gap-4 w-full">
              <h1
                className="font-semibold text-[var(--on-surface-default)] tracking-[-0.24px] leading-none"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h1)",
                }}
              >
                Contact Us
              </h1>
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                We are always ready to answer your questions and inquiries.
              </p>
            </div>

            {/* Contact Info Cards */}
            <div className="flex flex-col gap-10 flex-1 justify-center mt-10">
              {/* General Inquiry */}
              <div className="flex flex-col gap-4">
                <Mail
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-2">
                  <h3
                    className="font-semibold text-[var(--on-surface-variant)] leading-8"
                    style={{
                      fontSize: "var(--typeface-font-styles-heading-h3)",
                    }}
                  >
                    General Inquiry
                  </h3>
                  <a
                    href="mailto:inquiry@physioguidance.org"
                    className="text-[var(--on-surface-default)] leading-6 underline"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    inquiry@physioguidance.org
                  </a>
                </div>
              </div>

              {/* Technical Support */}
              <div className="flex flex-col gap-4">
                <Phone
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-2">
                  <h3
                    className="font-semibold text-[var(--on-surface-variant)] leading-8"
                    style={{
                      fontSize: "var(--typeface-font-styles-heading-h3)",
                    }}
                  >
                    Technical Support
                  </h3>
                  <p
                    className="text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    +966 920035022
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-4">
                <MapPin
                  className="w-6 h-6 text-[#a37f49]"
                  strokeWidth={1.67}
                />
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col">
                    <h3
                      className="font-semibold text-[var(--on-surface-variant)] leading-8"
                      style={{
                        fontSize: "var(--typeface-font-styles-heading-h3)",
                      }}
                    >
                      Xyz ,saudia arabia,
                    </h3>
                  </div>
                  <a
                    href="#"
                    className="flex items-center gap-1 text-[var(--on-surface-default)] hover:underline w-fit"
                  >
                    <span
                      className="font-medium text-sm"
                      style={{ fontSize: "14px" }}
                    >
                      Get Directions
                    </span>
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Contact Form */}
          <div
            className="flex-1 bg-white p-8 rounded-3xl"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-6 h-full"
            >
              <div className="flex flex-col gap-4">
                {/* Full Name */}
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Full Name <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="h-12 px-3.5 py-2.5 bg-white border border-[var(--outline-hover)] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Email address <span className="text-[#dc2626]">*</span>
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
                      className="w-full h-12 pl-12 pr-3.5 py-2.5 bg-white border border-[var(--outline-hover)] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                    />
                  </div>
                </div>

                {/* Select Issue Type */}
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Select issue type
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsIssueTypeOpen(!isIssueTypeOpen)}
                      className="w-full h-12 px-3.5 py-2.5 bg-white border border-[var(--outline-hover)] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] flex items-center justify-between cursor-pointer"
                    >
                      <span
                        className={
                          formData.issueType
                            ? "text-[var(--on-surface-default)]"
                            : "text-[var(--on-surface-variant)]"
                        }
                        style={{
                          fontSize: "var(--typeface-font-styles-paragraph-text)",
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
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--outline-hover)] rounded-lg shadow-lg z-10">
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
                              fontSize:
                                "var(--typeface-font-styles-paragraph-text)",
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
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Phone number <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="flex h-12 bg-white border border-[var(--outline-hover)] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] overflow-hidden">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                        className="h-full px-3.5 flex items-center gap-1 cursor-pointer border-r border-[var(--outline-hover)]"
                      >
                        <span
                          className="text-[#181d27]"
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
                              className="w-full px-3.5 py-2 text-left hover:bg-[var(--surface-container-low)] transition-colors"
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
                      className="flex-1 px-3.5 py-2.5 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="h-12 px-3.5 py-2.5 bg-white border border-[var(--outline-hover)] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)]"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col w-full">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    Description
                  </label>
                  <div className="relative">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full h-[140px] px-3.5 py-2.5 bg-white border border-[#d5d7da] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] focus:outline-none focus:border-[var(--outline-focused)] resize-none"
                    />
                    <span
                      className="absolute bottom-2.5 right-3.5 text-[var(--on-surface-variant)] leading-4"
                      style={{
                        fontSize: "var(--typeface-font-styles-paragraph-text-xs)",
                      }}
                    >
                      {maxDescriptionLength - formData.description.length}{" "}
                      characters left
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="h-10 min-w-[80px] px-5 rounded-xl font-medium text-sm text-white"
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

        {/* Container 2: Map */}
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
    </section>
  );
};

export default ContactForm;
