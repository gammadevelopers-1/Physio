"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, CheckCircle2, Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";

const CATEGORIES = [
  { value: "technical", labelKey: "category_technical" },
  { value: "login", labelKey: "category_login" },
  { value: "billing", labelKey: "category_billing" },
  { value: "certificate", labelKey: "category_certificate" },
  { value: "content", labelKey: "category_content" },
  { value: "other", labelKey: "category_other" },
] as const;

interface PublicTicketFormProps {
  preSelectedCategory?: string;
}

export default function PublicTicketForm({
  preSelectedCategory,
}: PublicTicketFormProps) {
  const t = useTranslations("supportPublicPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (preSelectedCategory) {
      const match = CATEGORIES.find((c) => c.value === preSelectedCategory);
      if (match) setCategory(match.value);
    }
  }, [preSelectedCategory]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!subject.trim()) {
      newErrors.subject = t("fieldRequired");
    } else if (subject.trim().length < 5) {
      newErrors.subject = t("subjectMinLength");
    }

    if (!category) {
      newErrors.category = t("fieldRequired");
    }

    if (!description.trim()) {
      newErrors.description = t("fieldRequired");
    } else if (description.trim().length < 20) {
      newErrors.description = t("descriptionMinLength");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await studentApi.createTicket({
        subject: subject.trim(),
        category,
        description: description.trim(),
      });

      setIsSubmitted(true);
      toast.success(t("ticketSubmitted"));
    } catch {
      toast.error(t("errorSubmitting"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setSubject("");
    setCategory("");
    setDescription("");
    setErrors({});
    setIsSubmitted(false);
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {t("ticketSubmitted")}
        </h3>
        <p className="text-gray-500 mb-6">{t("ticketSubmittedDesc")}</p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={`/${locale}/dashboard/student/support`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-blue)] text-white rounded-[10px] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("viewInDashboard")}
          </a>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#C8D5E1] bg-white text-gray-700 rounded-[10px] text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {t("submitAnother")}
          </button>
        </div>
      </div>
    );
  }

  const selectedCategoryLabel = CATEGORIES.find(
    (c) => c.value === category
  )?.labelKey;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Subject */}
      <div>
        <label
          htmlFor="ticket-subject"
          className="block text-sm font-medium text-gray-700 mb-1.5"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {t("subject")}{" "}
          <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="ticket-subject"
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (errors.subject) setErrors((p) => ({ ...p, subject: "" }));
          }}
          placeholder={t("subjectPlaceholder")}
          className={`w-full h-[44px] px-3.5 border rounded-[10px] text-sm bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] outline-none transition-colors ${
            errors.subject
              ? "border-[#DC2626] focus:border-[#DC2626]"
              : "border-[#C8D5E1] focus:border-[var(--outline-focused)]"
          }`}
          style={{ textAlign: isRTL ? "right" : "left" }}
          dir={isRTL ? "rtl" : "ltr"}
        />
        {errors.subject && (
          <p className="text-xs text-[#DC2626] mt-1">{errors.subject}</p>
        )}
      </div>

      {/* Category dropdown */}
      <div className="relative">
        <label
          htmlFor="ticket-category"
          className="block text-sm font-medium text-gray-700 mb-1.5"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {t("category")}{" "}
          <span className="text-[#DC2626]">*</span>
        </label>
        <button
          id="ticket-category"
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`w-full h-[44px] px-3.5 border rounded-[10px] text-sm bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] outline-none transition-colors flex items-center justify-between ${
            errors.category
              ? "border-[#DC2626]"
              : "border-[#C8D5E1] focus:border-[var(--outline-focused)]"
          }`}
          dir={isRTL ? "rtl" : "ltr"}
        >
          <span className={category ? "text-gray-900" : "text-gray-400"}>
            {selectedCategoryLabel
              ? t(selectedCategoryLabel)
              : t("selectCategory")}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 bg-white border border-[#C8D5E1] rounded-[10px] shadow-lg overflow-hidden"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setCategory(cat.value);
                  setDropdownOpen(false);
                  if (errors.category)
                    setErrors((p) => ({ ...p, category: "" }));
                }}
                className={`w-full px-3.5 py-2.5 text-sm text-left hover:bg-[var(--surface)] transition-colors ${
                  category === cat.value
                    ? "bg-blue-50 text-[var(--brand-blue)] font-medium"
                    : "text-gray-700"
                }`}
                style={{ textAlign: isRTL ? "right" : "left" }}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        )}
        {errors.category && (
          <p className="text-xs text-[#DC2626] mt-1">{errors.category}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="ticket-description"
          className="block text-sm font-medium text-gray-700 mb-1.5"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {t("description")}{" "}
          <span className="text-[#DC2626]">*</span>
        </label>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description)
              setErrors((p) => ({ ...p, description: "" }));
          }}
          placeholder={t("descriptionPlaceholder")}
          rows={5}
          className={`w-full px-3.5 py-2.5 border rounded-[10px] text-sm bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] outline-none transition-colors resize-none ${
            errors.description
              ? "border-[#DC2626] focus:border-[#DC2626]"
              : "border-[#C8D5E1] focus:border-[var(--outline-focused)]"
          }`}
          style={{ textAlign: isRTL ? "right" : "left" }}
          dir={isRTL ? "rtl" : "ltr"}
        />
        {errors.description && (
          <p className="text-xs text-[#DC2626] mt-1">{errors.description}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--brand-blue)] text-white rounded-[10px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("submitting")}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {t("submitTicket")}
          </>
        )}
      </button>
    </form>
  );
}
