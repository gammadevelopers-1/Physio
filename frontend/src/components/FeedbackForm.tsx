"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

const FeedbackForm = () => {
  const t = useTranslations("feedbackPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    subject: "",
    description: "",
  });

  const maxDescriptionLength = 275;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "description" && value.length > maxDescriptionLength) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Feedback submitted:", formData);
  };

  return (
    <section className="bg-[#EEF3F7] min-h-[calc(100vh-80px)] lg:min-h-0">
      {/* Desktop Layout */}
      <div
        className="hidden lg:block"
        style={{ padding: "80px 64px" }}
      >
        <div className="max-w-[1312px] mx-auto">
          <div className="flex gap-20 items-start">
            {/* Text Column - First in DOM (appears on LEFT in LTR, RIGHT in RTL) */}
            <div className="flex-1 flex flex-col gap-4 items-start">
              <h1
                className="font-semibold text-[var(--on-surface-default)] tracking-[-0.24px] leading-tight"
                style={{ fontSize: "48px" }}
              >
                {t("title")}
              </h1>
              <p
                className="text-[var(--on-surface-default)] leading-7 font-400"
                style={{ fontSize: "20px" }}
              >
                {t("description")}
              </p>
            </div>

            {/* Form Column - Second in DOM (appears on RIGHT in LTR, LEFT in RTL) */}
            <div
              className="flex-1 bg-white p-8 rounded-3xl max-w-[500px]"
              style={{
                boxShadow:
                  "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
              }}
            >
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Full Name */}
                <div className="flex flex-col w-full items-start">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {t("form.fullName")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full h-12 px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col w-full items-start">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {t("form.emailAddress")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="relative w-full">
                    <Mail
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#C8D5E1] ${isRTL ? "right-3.5" : "left-3.5"}`}
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full h-12 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "pr-12 pl-3.5" : "pl-12 pr-3.5"}`}
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="flex flex-col w-full items-start">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {t("form.subject")}
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full h-12 px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col w-full items-start">
                  <label
                    className="pb-2 text-[var(--on-surface-default)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {t("form.description")}
                  </label>
                  <div className="relative w-full">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full h-[140px] px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] resize-none"
                    />
                    <span
                      className={`absolute bottom-2.5 leading-4 text-xs text-[var(--on-surface-variant)] ${isRTL ? "left-3.5" : "right-3.5"}`}
                    >
                      {isRTL
                        ? `${t("form.charactersLeftPrefix")} ${maxDescriptionLength - formData.description.length} ${t("form.charactersLeftSuffix")}`
                        : `${maxDescriptionLength - formData.description.length} ${t("form.charactersLeftSuffix")}`}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="h-10 min-w-[80px] px-5 rounded-xl font-medium text-sm text-white"
                    style={{
                      background: isRTL
                        ? "linear-gradient(to left, #a37f49, #6b4e24)"
                        : "linear-gradient(to right, #a37f49, #6b4e24)",
                    }}
                  >
                    {t("form.submit")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden px-4 py-8 pb-24">
        <div className="flex flex-col gap-6">
          {/* Heading & Description */}
          <div className="flex flex-col gap-3 items-start">
            <h1
              className="font-semibold text-[var(--on-surface-default)] tracking-[-0.24px] leading-tight"
              style={{ fontSize: "30px" }}
            >
              {t("title")}
            </h1>
            <p
              className="text-[var(--on-surface-default)] leading-7"
              style={{ fontSize: "20px" }}
            >
              {t("description")}
            </p>
          </div>

          {/* Form Card */}
          <div
            className="bg-white p-6 rounded-2xl"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Full Name */}
              <div className="flex flex-col w-full items-start">
                <label
                  className="pb-2 text-[var(--on-surface-default)] leading-6 text-sm"
                >
                  {t("form.fullName")} <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full h-11 px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                />
              </div>

              {/* Email Address */}
              <div className="flex flex-col w-full items-start">
                <label
                  className="pb-2 text-[var(--on-surface-default)] leading-6 text-sm"
                >
                  {t("form.emailAddress")} <span className="text-[#dc2626]">*</span>
                </label>
                <div className="relative w-full">
                  <Mail
                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#C8D5E1] ${isRTL ? "right-3.5" : "left-3.5"}`}
                    strokeWidth={1.5}
                  />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full h-11 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "pr-12 pl-3.5" : "pl-12 pr-3.5"}`}
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="flex flex-col w-full items-start">
                <label
                  className="pb-2 text-[var(--on-surface-default)] leading-6 text-sm"
                >
                  {t("form.subject")}
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full h-11 px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col w-full items-start">
                <label
                  className="pb-2 text-[var(--on-surface-default)] leading-6 text-sm"
                >
                  {t("form.description")}
                </label>
                <div className="relative w-full">
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full h-[120px] px-3.5 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] resize-none"
                  />
                  <span
                    className={`absolute bottom-2.5 leading-4 text-xs text-[var(--on-surface-variant)] ${isRTL ? "left-3.5" : "right-3.5"}`}
                  >
                    {isRTL
                      ? `${t("form.charactersLeftPrefix")} ${maxDescriptionLength - formData.description.length} ${t("form.charactersLeftSuffix")}`
                      : `${maxDescriptionLength - formData.description.length} ${t("form.charactersLeftSuffix")}`}
                  </span>
                </div>
              </div>

              {/* Submit Button - Full Width on Mobile */}
              <button
                type="submit"
                className="w-full h-12 rounded-xl font-medium text-base text-white"
                style={{
                  background: isRTL
                    ? "linear-gradient(to left, #a37f49, #6b4e24)"
                    : "linear-gradient(to right, #a37f49, #6b4e24)",
                }}
              >
                {t("form.submit")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeedbackForm;
