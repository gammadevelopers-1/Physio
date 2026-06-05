"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  CheckCircle2,
  Send,
  ChevronDown,
  Mail,
  User,
  Copy,
  Check,
  Upload,
  Paperclip,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import ReCAPTCHA from "react-google-recaptcha";
import { supportApi, studentApi } from "@/lib/api";

// Mirror the limits the student form uses so the public form behaves
// identically. The server caps per-file at 10MB; we use 5MB here so
// the chip-row stays small and users get fast client-side feedback.
const PUBLIC_MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const PUBLIC_MAX_ATTACHMENT_COUNT = 10;
const PUBLIC_ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const PUBLIC_ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

type PublicPendingAttachment = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  errorMessage?: string;
};

function publicFormatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

// Built-in slugs that have first-class translation keys. Anything not
// in this set is a custom admin-added category — we render its nameEn /
// nameAr directly since translations don't exist for arbitrary slugs.
const BUILTIN_LABEL_KEYS: Record<string, string> = {
  technical: "category_technical",
  login: "category_login",
  billing: "category_billing",
  certificate: "category_certificate",
  content: "category_content",
  other: "category_other",
};

type CategoryItem = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
};

interface PublicTicketFormProps {
  preSelectedCategory?: string;
  isAuthenticated?: boolean;
  guestLoginMode?: boolean;
}

export default function PublicTicketForm({
  preSelectedCategory,
  isAuthenticated = false,
  guestLoginMode = false,
}: PublicTicketFormProps) {
  const t = useTranslations("supportPublicPage");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<PublicPendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [trackingToken, setTrackingToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Attachment handlers — same lifecycle as the student form. Each
  // file uploads in parallel and surfaces status independently so a
  // single bad file doesn't block the others.
  async function uploadOne(item: PublicPendingAttachment) {
    setAttachments((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: "uploading" } : a)),
    );
    try {
      const res = await studentApi.uploadFile(item.file);
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: "done", url: res.url } : a,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: "error", errorMessage: msg } : a,
        ),
      );
    }
  }

  function handleFilesAdded(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setAttachmentError(null);
    const newPending: PublicPendingAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (
        attachments.length + newPending.length >=
        PUBLIC_MAX_ATTACHMENT_COUNT
      ) {
        setAttachmentError(
          isRTL
            ? `الحد الأقصى ${PUBLIC_MAX_ATTACHMENT_COUNT} مرفقات`
            : `Max ${PUBLIC_MAX_ATTACHMENT_COUNT} attachments`,
        );
        break;
      }
      if (file.size > PUBLIC_MAX_ATTACHMENT_SIZE) {
        setAttachmentError(
          isRTL ? "الملف يتجاوز 5 ميجابايت" : "File exceeds 5MB",
        );
        continue;
      }
      if (!PUBLIC_ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setAttachmentError(
          isRTL ? "نوع الملف غير مسموح" : "File type not allowed",
        );
        continue;
      }
      newPending.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        status: "queued",
      });
    }
    if (newPending.length === 0) return;
    setAttachments((prev) => [...prev, ...newPending]);
    for (const item of newPending) uploadOne(item);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const anyUploading = attachments.some((a) => a.status === "uploading");

  // Live category list — admins can add/remove these without a deploy
  // (see Categories tab in support settings). Falls back to the 6
  // built-ins on fetch failure so the form is never blank.
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    Object.keys(BUILTIN_LABEL_KEYS).map((slug) => ({
      slug,
      nameEn: slug,
      nameAr: null,
    })),
  );

  useEffect(() => {
    let cancelled = false;
    supportApi
      .listTicketCategories()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setCategories(
          rows.map((r) => ({ slug: r.slug, nameEn: r.nameEn, nameAr: r.nameAr })),
        );
      })
      .catch(() => {
        // Keep the seeded fallback — the form still works with built-ins.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (preSelectedCategory) {
      const match = categories.find((c) => c.slug === preSelectedCategory);
      if (match) setCategory(match.slug);
    }
  }, [preSelectedCategory, categories]);

  // Resolve a category's display label — translated key for built-ins,
  // admin-supplied nameAr/nameEn for custom slugs.
  const labelFor = (cat: CategoryItem) => {
    const builtinKey = BUILTIN_LABEL_KEYS[cat.slug];
    if (builtinKey) return t(builtinKey);
    if (isRTL && cat.nameAr) return cat.nameAr;
    return cat.nameEn || cat.slug;
  };

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!isAuthenticated) {
      if (!name.trim()) {
        newErrors.name = t("fieldRequired");
      }
      if (!email.trim()) {
        newErrors.email = t("fieldRequired");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = t("invalidEmail");
      }
    }

    if (!subject.trim()) {
      newErrors.subject = t("fieldRequired");
    } else if (subject.trim().length < 5) {
      newErrors.subject = t("subjectMinLength");
    }

    if (!guestLoginMode && !category) {
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

    // Guest mode requires reCAPTCHA when configured. Authenticated mode
    // is already protected by the auth session, so no captcha there.
    if (guestLoginMode && RECAPTCHA_SITE_KEY && !recaptchaToken) {
      toast.error(tToasts("captchaRequired"));
      return;
    }

    if (anyUploading) {
      toast.error(
        isRTL
          ? "انتظر اكتمال رفع المرفقات"
          : "Wait for uploads to finish",
      );
      return;
    }

    const attachmentUrls = attachments
      .filter((a) => a.status === "done" && a.url)
      .map((a) => a.url!) as string[];

    setIsSubmitting(true);
    try {
      if (guestLoginMode) {
        const result = await supportApi.createGuestTicket({
          name: name.trim(),
          email: email.trim(),
          category: "login",
          subject: subject.trim(),
          description: description.trim(),
          recaptchaToken: recaptchaToken || undefined,
          ...(attachmentUrls.length > 0 && { attachmentUrls }),
        });
        setTrackingToken(result.trackingToken);
        setIsSubmitted(true);
      } else if (isAuthenticated) {
        await supportApi.createTicket({
          subject: subject.trim(),
          category,
          description: description.trim(),
          ...(attachmentUrls.length > 0 && { attachmentUrls }),
        });
        setIsSubmitted(true);
      }

      toast.success(t("ticketSubmitted"));
    } catch {
      // Reset captcha so the user can re-verify after a failed submit.
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
      toast.error(t("errorSubmitting"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setName("");
    setEmail("");
    setSubject("");
    setCategory("");
    setDescription("");
    setAttachments([]);
    setAttachmentError(null);
    setErrors({});
    setIsSubmitted(false);
    setTrackingToken("");
    setCopied(false);
  }

  if (isSubmitted) {
    const trackingUrl = trackingToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/support/track/${trackingToken}`
      : "";

    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {t("ticketSubmitted")}
        </h3>

        {guestLoginMode && trackingToken ? (
          <>
            <p className="text-gray-500 mb-4">
              {t("trackingPromptGuest")}
            </p>
            <div className="flex items-center justify-center gap-2 mb-2 p-3 bg-gray-50 rounded-[10px] border border-[#C8D5E1]">
              <span className="text-sm text-gray-700 truncate max-w-[320px]">
                {trackingUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(trackingUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 btn-gold text-white text-xs font-medium rounded-lg"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    {t("copyLink")}
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              {t("trackingBookmarkNote")}
            </p>
          </>
        ) : (
          <p className="text-gray-500 mb-6">{t("ticketSubmittedDesc")}</p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuthenticated && (
            <a
              href={`/${locale}/dashboard/student/support`}
              className="inline-flex items-center gap-2 px-5 py-2.5 btn-gold text-white rounded-[10px] text-sm font-medium"
            >
              {t("viewInDashboard")}
            </a>
          )}
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

  const selectedCategory = categories.find((c) => c.slug === category);

  const inputClass = (field: string) =>
    `w-full h-[44px] px-3.5 border rounded-[10px] text-sm bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] outline-none transition-colors ${
      errors[field]
        ? "border-[#DC2626] focus:border-[#DC2626]"
        : "border-[#C8D5E1] focus:border-[#a37f49]"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Guest fields — only shown when not logged in */}
      {!isAuthenticated && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label
              htmlFor="ticket-name"
              className="block text-sm font-medium text-gray-700 mb-1.5"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {isRTL ? "الاسم الكامل" : "Full Name"}{" "}
              <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <User
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${
                  isRTL ? "right-3.5" : "left-3.5"
                }`}
              />
              <input
                id="ticket-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                }}
                placeholder={isRTL ? "أدخل اسمك الكامل" : "Enter your full name"}
                className={`${inputClass("name")} ${isRTL ? "pr-10" : "pl-10"}`}
                style={{ textAlign: isRTL ? "right" : "left" }}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="ticket-email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
              style={{ textAlign: isRTL ? "right" : "left" }}
            >
              {isRTL ? "البريد الإلكتروني" : "Email Address"}{" "}
              <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <Mail
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${
                  isRTL ? "right-3.5" : "left-3.5"
                }`}
              />
              <input
                id="ticket-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                }}
                placeholder={isRTL ? "أدخل بريدك الإلكتروني" : "Enter your email"}
                className={`${inputClass("email")} ${isRTL ? "pr-10" : "pl-10"}`}
                style={{ textAlign: isRTL ? "right" : "left" }}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.email}</p>
            )}
          </div>
        </div>
      )}

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
          className={inputClass("subject")}
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
        {guestLoginMode ? (
          <div
            className="w-full h-[44px] px-3.5 border rounded-[10px] text-sm bg-gray-50 shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] flex items-center border-[#C8D5E1] cursor-not-allowed"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <span className="text-gray-900">
              {t("category_login")}
            </span>
          </div>
        ) : (
          <>
            <button
              id="ticket-category"
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`w-full h-[44px] px-3.5 border rounded-[10px] text-sm bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] outline-none transition-colors flex items-center justify-between ${
                errors.category
                  ? "border-[#DC2626]"
                  : "border-[#C8D5E1] focus:border-[#a37f49]"
              }`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              <span className={category ? "text-gray-900" : "text-gray-400"}>
                {selectedCategory ? labelFor(selectedCategory) : t("selectCategory")}
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
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => {
                      setCategory(cat.slug);
                      setDropdownOpen(false);
                      if (errors.category)
                        setErrors((p) => ({ ...p, category: "" }));
                    }}
                    className={`w-full px-3.5 py-2.5 text-sm text-left hover:bg-[#FFF8E6] transition-colors ${
                      category === cat.slug
                        ? "bg-[#FFF8E6] text-[#6b4e24] font-medium"
                        : "text-gray-700"
                    }`}
                    style={{ textAlign: isRTL ? "right" : "left" }}
                  >
                    {labelFor(cat)}
                  </button>
                ))}
              </div>
            )}
            {errors.category && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.category}</p>
            )}
          </>
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
              : "border-[#C8D5E1] focus:border-[#a37f49]"
          }`}
          style={{ textAlign: isRTL ? "right" : "left" }}
          dir={isRTL ? "rtl" : "ltr"}
        />
        {errors.description && (
          <p className="text-xs text-[#DC2626] mt-1">{errors.description}</p>
        )}
      </div>

      {/* Attachments — multi-file with parallel upload + per-file status.
          Same shape as the student form so users feel one product. */}
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1.5"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {isRTL ? "المرفقات" : "Attachments"}{" "}
          <span className="text-xs text-gray-400 font-normal">
            ({isRTL ? "اختياري" : "optional"})
          </span>
        </label>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFilesAdded(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-4 border border-dashed rounded-[10px] cursor-pointer transition-colors ${
            isDragOver
              ? "border-[#a37f49] bg-[#FFF8E6]"
              : "border-[#C8D5E1] bg-white hover:bg-gray-50"
          }`}
        >
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-700">
            {isRTL
              ? "أسقط الملفات هنا أو انقر للتحميل"
              : "Drop files here or click to upload"}
          </span>
          <span className="text-xs text-gray-400">
            {isRTL
              ? "PDF, JPG, PNG, WebP · حتى 5 ميجا لكل ملف · حتى 10 ملفات"
              : "PDF, JPG, PNG, WebP · up to 5MB each · up to 10 files"}
          </span>
          <input
            type="file"
            multiple
            accept={PUBLIC_ATTACHMENT_ACCEPT}
            onChange={(e) => {
              handleFilesAdded(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {attachmentError && (
          <p className="text-xs text-[#DC2626] mt-1.5">{attachmentError}</p>
        )}

        {attachments.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {attachments.map((a) => (
              <li
                key={a.id}
                className={`flex items-center gap-2 p-2.5 border rounded-[10px] ${
                  a.status === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-[#C8D5E1] bg-white"
                }`}
              >
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {a.file.name}
                  </p>
                  <p
                    className={`text-xs ${a.status === "error" ? "text-red-600" : "text-gray-500"}`}
                  >
                    {a.status === "uploading"
                      ? isRTL ? "جارٍ الرفع…" : "Uploading…"
                      : a.status === "error"
                        ? a.errorMessage || (isRTL ? "فشل الرفع" : "Upload failed")
                        : a.status === "done"
                          ? `${isRTL ? "تم الرفع" : "Uploaded"} · ${publicFormatBytes(a.file.size)}`
                          : publicFormatBytes(a.file.size)}
                  </p>
                </div>
                {a.status === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#a37f49] shrink-0" />
                ) : a.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : a.status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="p-0.5 hover:bg-gray-100 rounded shrink-0"
                  aria-label={isRTL ? "إزالة" : "Remove"}
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* reCAPTCHA — guest mode only (authenticated users already have a session) */}
      {guestLoginMode && RECAPTCHA_SITE_KEY && (
        <div className="flex justify-center" dir="ltr">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            hl={isRTL ? "ar" : "en"}
            onChange={(token) => setRecaptchaToken(token)}
            onExpired={() => setRecaptchaToken(null)}
            onErrored={() => setRecaptchaToken(null)}
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={
          isSubmitting ||
          anyUploading ||
          (guestLoginMode && RECAPTCHA_SITE_KEY ? !recaptchaToken : false)
        }
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-white rounded-[10px] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
