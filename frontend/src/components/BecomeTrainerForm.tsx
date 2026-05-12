"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2, Mail, Image as ImageIcon, CloudUpload, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useIsAuthenticated, useUser, useUserRoles, useAuth } from "@/contexts";
import { roleRequestsApi, getAccessToken, type RoleRequest } from "@/lib/api";
import ReCAPTCHA from "react-google-recaptcha";
import OtpVerifyModal from "./trainer-application/OtpVerifyModal";
import ResumeBuilder, { emptyStructuredResume, type StructuredResume } from "./trainer-application/ResumeBuilder";
import { toast } from "sonner";
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from "react-phone-number-input";
import phoneArLabels from "react-phone-number-input/locale/ar.json";
import "react-phone-number-input/style.css";
import { isValidIBAN } from "ibantools";
import { arCountryName, arStateName, arCityName } from "@/lib/locations-ar";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

// InputField component moved outside to prevent re-creation on parent re-render
const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  icon,
  withDivider = true,
  isRTL = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  withDivider?: boolean;
  isRTL?: boolean;
}) => (
  <>
    <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
      <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
        {label} {required && <span className="text-[#dc2626]">*</span>}
      </label>
      <div className="relative w-full lg:w-1/2">
        {icon && (
          <div className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] ${isRTL ? "right-4" : "left-4"}`}>
            {icon}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`w-full h-12 ${icon ? (isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4') : 'px-4'} py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
          style={{ fontSize: "16px" }}
        />
      </div>
    </div>
    {withDivider && <div className="w-full h-px bg-[var(--color-border)]" />}
  </>
);

// Checkbox component moved outside to prevent re-creation on parent re-render
const Checkbox = ({
  label,
  name,
  checked,
  onChange,
  isRTL = false,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRTL?: boolean;
}) => (
  <label className={`flex items-center gap-2 cursor-pointer ${isRTL ? "flex-row-reverse" : ""}`}>
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors bg-white ${checked ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="hidden"
    />
    <span style={{ fontSize: "16px" }}>{label}</span>
  </label>
);

// Dropdown component moved outside to prevent re-creation on parent re-render
const Dropdown = ({
  label,
  field,
  options,
  value,
  isOpen,
  onToggle,
  onSelect,
  required = false,
  placeholder = "",
  showFlag = false,
  withDivider = true,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (field: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
  showFlag?: boolean;
  withDivider?: boolean;
}) => {
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : "";

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
        <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
        <div className="relative w-full lg:w-1/2">
          <button
            type="button"
            onClick={onToggle}
            className="w-full h-12 px-4 bg-white border border-[var(--color-input-border)] rounded-lg flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {showFlag && value === "Saudi Arabia" && (
                <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />
              )}
              <span className={value ? "text-[var(--on-surface-default)]" : "text-[var(--on-surface-variant)]"} style={{ fontSize: "16px" }}>
                {displayLabel || placeholder}
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[var(--color-input-border)] rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(field, option.value)}
                  className="w-full px-4 py-2.5 hover:bg-[var(--color-border-subtle)] transition-colors flex items-center gap-2 text-left"
                  style={{ fontSize: "16px" }}
                >
                  {showFlag && option.value === "Saudi Arabia" && <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {withDivider && <div className="w-full h-px bg-[var(--color-border)]" />}
    </>
  );
};

// Searchable dropdown — used for Country/State/City where the option list
// can be very long (250 countries, hundreds of cities). Falls back to a
// plain text input when `options` is empty (some countries have no states
// in the dataset, some states have no cities).
const SearchableDropdown = ({
  label,
  field,
  options,
  value,
  isOpen,
  onToggle,
  onSelect,
  required = false,
  placeholder = "",
  searchPlaceholder = "",
  withDivider = true,
  isRTL = false,
  disabled = false,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (field: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  withDivider?: boolean;
  isRTL?: boolean;
  disabled?: boolean;
}) => {
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : "";

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // Empty options → render free-text input instead so applicants from
  // regions missing in the dataset can still complete the form.
  if (options.length === 0) {
    return (
      <>
        <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
          <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
            {label} {required && <span className="text-[#dc2626]">*</span>}
          </label>
          <div className="w-full lg:w-1/2">
            <input
              type="text"
              value={value}
              onChange={(e) => onSelect(field, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className={`w-full h-12 px-4 bg-white border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? "text-right" : ""}`}
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
        {withDivider && <div className="w-full h-px bg-[var(--color-border)]" />}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
        <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
        <div className="relative w-full lg:w-1/2">
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setQuery("");
                onToggle();
              }
            }}
            disabled={disabled}
            className="w-full h-12 px-4 bg-white border border-[var(--color-input-border)] rounded-lg flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={value ? "text-[var(--on-surface-default)]" : "text-[var(--on-surface-variant)]"} style={{ fontSize: "16px" }}>
              {displayLabel || placeholder}
            </span>
            <ChevronDown className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[var(--color-input-border)] rounded-lg shadow-lg z-20 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-[var(--color-input-border)]">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`w-full h-9 px-3 bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-md outline-none focus:border-[var(--color-input-focus)] text-sm ${isRTL ? "text-right" : ""}`}
                />
              </div>
              <div className="overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[var(--on-surface-variant)]">
                    {isRTL ? "لا توجد نتائج" : "No results"}
                  </div>
                ) : (
                  filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onSelect(field, option.value);
                        setQuery("");
                      }}
                      className={`w-full px-4 py-2.5 hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                      style={{ fontSize: "16px" }}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {withDivider && <div className="w-full h-px bg-[var(--color-border)]" />}
    </>
  );
};

// ComboBox — searchable dropdown that ALSO accepts free-typed values that
// aren't in the list. The user can either pick a suggestion or type their
// own (e.g., a profession Amna hasn't seeded yet). Stored value is the
// raw string (whatever the user typed or selected as label).
const ComboBox = ({
  label,
  field,
  options,
  value,
  isOpen,
  onToggle,
  onChange,
  required = false,
  placeholder = "",
  withDivider = true,
  isRTL = false,
  disabled = false,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (field: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
  withDivider?: boolean;
  isRTL?: boolean;
  disabled?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = value.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  // Close the suggestion list when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen, onToggle]);

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
        <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
        <div ref={containerRef} className="relative w-full lg:w-1/2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(field, e.target.value);
              if (!isOpen) onToggle();
            }}
            onFocus={() => { if (!isOpen && !disabled) onToggle(); }}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full h-12 px-4 pe-10 bg-white border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? "text-right" : ""}`}
            style={{ fontSize: "16px" }}
          />
          <ChevronDown className={`pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
          {isOpen && options.length > 0 && filtered.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[var(--color-input-border)] rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(field, option.label);
                    onToggle();
                  }}
                  className={`w-full px-4 py-2.5 hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                  style={{ fontSize: "16px" }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {withDivider && <div className="w-full h-px bg-[var(--color-border)]" />}
    </>
  );
};

// FileUpload component moved outside to prevent re-creation on parent re-render
const FileUpload = ({
  label,
  field,
  file,
  onFileChange,
  accept = ".pdf",
  isRTL = false,
  clickToUploadLabel,
  orDragDropLabel,
  pdfMaxSizeLabel,
}: {
  label: string;
  field: string;
  file: File | null;
  onFileChange: (field: string, file: File | null) => void;
  accept?: string;
  isRTL?: boolean;
  clickToUploadLabel?: string | null;
  orDragDropLabel?: string | null;
  pdfMaxSizeLabel?: string | null;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex flex-col gap-3 ${isRTL ? "text-right" : ""}`}>
      <label className="text-[var(--on-surface-default)] font-semibold" style={{ fontSize: "16px" }}>
        {label}
      </label>
      <div
        className="bg-[#F8FAFC] border border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFileChange(field, e.target.files?.[0] || null)}
        />
        {file ? (
          <div className={`flex items-center justify-between w-full ${isRTL ? "flex-row-reverse" : ""}`}>
            <span className="text-sm text-[var(--on-surface-default)] truncate max-w-[200px]">
              {file.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(field, null);
              }}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-page)] flex items-center justify-center">
              <CloudUpload className="w-6 h-6 text-[var(--color-text-secondary)]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <span className="text-sm text-[#002D87] font-medium">{clickToUploadLabel || ""}</span>
              <span className="text-sm text-[var(--on-surface-variant)]"> {orDragDropLabel || ""}</span>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {pdfMaxSizeLabel || ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

interface BecomeTrainerFormProps {
  pageTitle?: string | null;
  profileSectionTitle?: string | null;
  profilePhotoLabel?: string | null;
  profileAttachCVLabel?: string | null;
  profileFullNameLabel?: string | null;
  profileFullNameArabicPlaceholder?: string | null;
  profileFullNameEnglishPlaceholder?: string | null;
  profileEmailLabel?: string | null;
  profileMobileLabel?: string | null;
  profileGenderLabel?: string | null;
  profileNationalityLabel?: string | null;
  profileNationalIdLabel?: string | null;
  profileProfessionLabel?: string | null;
  profileSpecialityLabel?: string | null;
  profileQualificationLabel?: string | null;
  profileRankLabel?: string | null;
  profileScfhsQuestion?: string | null;
  profileTwitterLabel?: string | null;
  profileLinkedInLabel?: string | null;
  resumeSectionTitle?: string | null;
  resumeDescription?: string | null;
  resumeUploadLabel?: string | null;
  resumeCreateLabel?: string | null;
  resumeEducationLabel?: string | null;
  resumeProfessionalSkillsLabel?: string | null;
  resumeScientificResearchesLabel?: string | null;
  resumeTrainingExperienceLabel?: string | null;
  resumeClickToUploadLabel?: string | null;
  resumeOrDragDropLabel?: string | null;
  resumePdfMaxSizeLabel?: string | null;
  bankAccountSectionTitle?: string | null;
  bankAccountHolderLabel?: string | null;
  bankNameLabel?: string | null;
  bankIbanLabel?: string | null;
  cancelButtonLabel?: string | null;
  saveButtonLabel?: string | null;
  yesButtonLabel?: string | null;
  noButtonLabel?: string | null;
  // Visibility flags
  showProfileSection?: boolean;
  showResumeSection?: boolean;
  showBankSection?: boolean;
  showFullNameArabic?: boolean;
  showFullNameEnglish?: boolean;
  showEmail?: boolean;
  showMobileNumber?: boolean;
  showGender?: boolean;
  showNationality?: boolean;
  showNationalIqamaId?: boolean;
  showProfession?: boolean;
  showSpecialty?: boolean;
  showQualification?: boolean;
  showAcademicRank?: boolean;
  showScfhsToggle?: boolean;
  showTwitter?: boolean;
  showLinkedIn?: boolean;
  showPhoto?: boolean;
  // Strapi-overridable dropdown options
  nationalityOptions?: StrapiDropdownOption[] | null;
  qualificationOptions?: StrapiDropdownOption[] | null;
  rankOptions?: StrapiDropdownOption[] | null;
  bankOptions?: StrapiDropdownOption[] | null;
  // Profession + Specialty come from a dedicated Strapi collection-type
  // where each profession has its specialties nested inside it.
  professions?: ProfessionEntry[] | null;
}

interface StrapiDropdownOption {
  id?: number;
  value: string;
  label: string;
}

interface ProfessionEntry {
  id?: number;
  value: string;
  label: string;
  specialties?: Array<{ value: string; label: string }>;
}

const BecomeTrainerForm = ({
  pageTitle,
  profileSectionTitle,
  profilePhotoLabel,
  profileAttachCVLabel,
  profileFullNameLabel,
  profileFullNameArabicPlaceholder,
  profileFullNameEnglishPlaceholder,
  profileEmailLabel,
  profileMobileLabel,
  profileGenderLabel,
  profileNationalityLabel,
  profileNationalIdLabel,
  profileProfessionLabel,
  profileSpecialityLabel,
  profileQualificationLabel,
  profileRankLabel,
  profileScfhsQuestion,
  profileTwitterLabel,
  profileLinkedInLabel,
  resumeSectionTitle,
  resumeDescription,
  resumeUploadLabel,
  resumeCreateLabel,
  resumeEducationLabel,
  resumeProfessionalSkillsLabel,
  resumeScientificResearchesLabel,
  resumeTrainingExperienceLabel,
  resumeClickToUploadLabel,
  resumeOrDragDropLabel,
  resumePdfMaxSizeLabel,
  bankAccountSectionTitle,
  bankAccountHolderLabel,
  bankNameLabel,
  bankIbanLabel,
  cancelButtonLabel,
  saveButtonLabel,
  yesButtonLabel,
  noButtonLabel,
  showProfileSection = true,
  showResumeSection = true,
  showBankSection = true,
  showFullNameArabic = true,
  showFullNameEnglish = true,
  showEmail = true,
  showMobileNumber = true,
  showGender = true,
  showNationality = true,
  showNationalIqamaId = true,
  showProfession = true,
  showSpecialty = true,
  showQualification = true,
  showAcademicRank = true,
  showScfhsToggle = true,
  showTwitter = true,
  showLinkedIn = true,
  showPhoto = true,
  nationalityOptions: strapiNationality = null,
  professions: strapiProfessions = null,
  qualificationOptions: strapiQualification = null,
  rankOptions: strapiRank = null,
  bankOptions: strapiBank = null,
}: BecomeTrainerFormProps) => {
  const t = useTranslations("becomeTrainerPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Resolved labels: Strapi prop || next-intl fallback
  const labels = {
    title: pageTitle || t("title"),
    profileTitle: profileSectionTitle || t("profile.title"),
    photo: profilePhotoLabel || t("profile.photo"),
    attachCV: profileAttachCVLabel || t("profile.attachCV"),
    fullName: profileFullNameLabel || t("profile.fullName"),
    fullNameArPlaceholder: profileFullNameArabicPlaceholder || t("profile.fullNameArabicPlaceholder"),
    fullNameEnPlaceholder: profileFullNameEnglishPlaceholder || t("profile.fullNameEnglishPlaceholder"),
    email: profileEmailLabel || t("profile.emailAddress"),
    mobile: profileMobileLabel || t("profile.mobileNumber"),
    gender: profileGenderLabel || t("profile.gender"),
    nationality: profileNationalityLabel || t("profile.nationality"),
    nationalId: profileNationalIdLabel || t("profile.nationalIqamaId"),
    profession: profileProfessionLabel || t("profile.profession"),
    speciality: profileSpecialityLabel || t("profile.speciality"),
    qualification: profileQualificationLabel || t("profile.qualification"),
    rank: profileRankLabel || t("profile.rank"),
    scfhsQuestion: profileScfhsQuestion || t("profile.scfhsQuestion"),
    twitter: profileTwitterLabel || t("profile.twitter"),
    linkedIn: profileLinkedInLabel || t("profile.linkedIn"),
    resumeTitle: resumeSectionTitle || t("resume.title"),
    resumeDesc: resumeDescription || t("resume.description"),
    uploadResume: resumeUploadLabel || t("resume.uploadResume"),
    createResume: resumeCreateLabel || t("resume.createResume"),
    education: resumeEducationLabel || t("resume.education"),
    professionalSkills: resumeProfessionalSkillsLabel || t("resume.professionalSkills"),
    scientificResearches: resumeScientificResearchesLabel || t("resume.scientificResearches"),
    trainingExperience: resumeTrainingExperienceLabel || t("resume.trainingExperience"),
    clickToUpload: resumeClickToUploadLabel || t("resume.clickToUpload"),
    orDragDrop: resumeOrDragDropLabel || t("resume.orDragAndDrop"),
    pdfMaxSize: resumePdfMaxSizeLabel || t("resume.pdfMaxSize"),
    bankTitle: bankAccountSectionTitle || t("bankAccount.title"),
    accountHolder: bankAccountHolderLabel || t("bankAccount.accountHolderName"),
    bankName: bankNameLabel || t("bankAccount.bankName"),
    iban: bankIbanLabel || t("bankAccount.iban"),
    cancel: cancelButtonLabel || t("buttons.cancel"),
    save: t("buttons.save"),
    yes: yesButtonLabel || t("buttons.yes"),
    no: noButtonLabel || t("buttons.no"),
  };

  const [formData, setFormData] = useState({
    photo: null as File | null,
    photoPreview: "",
    fullNameArabic: "",
    fullNameEnglish: "",
    email: "",
    phoneE164: "",
    gender: "",
    nationality: "Saudi Arabia",
    nationalIqamaId: "",
    countryIso: "",
    stateIso: "",
    cityName: "",
    countryName: "",
    stateName: "",
    profession: "",
    specialty: "",
    qualification: "",
    rank: "",
    hasScfhsNumber: false,
    noScfhsNumber: true,
    scfhsNumber: "",
    twitter: "",
    linkedIn: "",
    uploadResume: false,
    createResume: true,
    accountHolderName: "",
    bankName: "",
    iban: "",
  });

  const [structuredResume, setStructuredResume] = useState<StructuredResume>(emptyStructuredResume);

  const [files, setFiles] = useState({
    resume: null as File | null,
    education: null as File | null,
    professionalSkills: null as File | null,
    scientificResearches: null as File | null,
    trainingExperience: null as File | null,
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [existingApplication, setExistingApplication] = useState<RoleRequest | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // country-state-city dataset is ~10MB. Lazy-load on first render so it
  // stays out of the initial bundle. While loading, dropdowns show "Loading...".
  type LocationOption = { value: string; label: string };
  type CscApi = {
    Country: { getAllCountries: () => Array<{ isoCode: string; name: string }> };
    State: { getStatesOfCountry: (iso: string) => Array<{ isoCode: string; name: string }> };
    City: { getCitiesOfState: (country: string, state: string) => Array<{ name: string }> };
  };
  const [csc, setCsc] = useState<CscApi | null>(null);
  useEffect(() => {
    let mounted = true;
    import("country-state-city").then((mod) => {
      if (mounted) setCsc({ Country: mod.Country, State: mod.State, City: mod.City });
    });
    return () => { mounted = false; };
  }, []);

  // Country / State / City labels switch to Arabic when locale=ar:
  //  - Country names: i18n-iso-countries (full coverage)
  //  - State + City: curated map for KSA + GCC + Egypt + Jordan; English elsewhere
  const countryOptions: LocationOption[] = csc
    ? csc.Country.getAllCountries().map((c) => ({
        value: c.isoCode,
        label: isRTL ? arCountryName(c.isoCode, c.name) : c.name,
      }))
    : [];
  const stateOptions: LocationOption[] = csc && formData.countryIso
    ? csc.State.getStatesOfCountry(formData.countryIso).map((s) => ({
        value: s.isoCode,
        label: isRTL ? arStateName(formData.countryIso, s.name) : s.name,
      }))
    : [];
  const cityOptions: LocationOption[] = csc && formData.countryIso && formData.stateIso
    ? csc.City.getCitiesOfState(formData.countryIso, formData.stateIso).map((c) => ({
        value: c.name,
        label: isRTL ? arCityName(formData.countryIso, c.name) : c.name,
      }))
    : [];

  // Cascading select handler — picking Country resets State + City; picking State resets City
  const handleLocationSelect = (field: string, value: string) => {
    if (field === "countryIso") {
      const country = csc?.Country.getAllCountries().find((c) => c.isoCode === value);
      setFormData((prev) => ({
        ...prev,
        countryIso: value,
        countryName: country?.name || value,
        stateIso: "",
        stateName: "",
        cityName: "",
      }));
    } else if (field === "stateIso") {
      const state = csc?.State.getStatesOfCountry(formData.countryIso).find((s) => s.isoCode === value);
      setFormData((prev) => ({
        ...prev,
        stateIso: value,
        stateName: state?.name || value,
        cityName: "",
      }));
    } else if (field === "stateName") {
      // free-text fallback when country has no states in dataset
      setFormData((prev) => ({ ...prev, stateName: value, stateIso: "", cityName: "" }));
    } else if (field === "cityName") {
      setFormData((prev) => ({ ...prev, cityName: value }));
    }
    setOpenDropdown(null);
  };
  const isAuthenticated = useIsAuthenticated();
  const user = useUser();
  const userRoles = useUserRoles();
  const { switchRole } = useAuth();
  const isInstructor = userRoles.includes("INSTRUCTOR");

  // Public flow: captcha → OTP → scoped JWT carries through file uploads + submit
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [scopedToken, setScopedToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  // Check for existing application on mount — only if user happens to be logged in
  // (anonymous applicants skip this entirely; the backend will dedup on submit)
  useEffect(() => {
    const checkExisting = async () => {
      if (!isAuthenticated) {
        setCheckingStatus(false);
        return;
      }
      try {
        const applications = await roleRequestsApi.getMine();
        const pending = applications.find(
          (a) => a.requestedRole === "INSTRUCTOR" && (a.status === "PENDING" || a.status === "MORE_INFO")
        );
        if (pending) {
          setExistingApplication(pending);
        }
      } catch {
        // Ignore - user may not have any applications
      } finally {
        setCheckingStatus(false);
      }
    };
    checkExisting();
  }, [isAuthenticated]);

  // KSA-default option lists. Strapi values (when configured by Amna) take priority;
  // otherwise these defaults are shown. value = canonical English (stored in DB);
  // label = locale-appropriate display string.
  const genderOptions = [
    { value: "Male", label: isRTL ? "ذكر" : "Male" },
    { value: "Female", label: isRTL ? "أنثى" : "Female" },
  ];

  const defaultNationality = [
    { value: "Saudi Arabia", label: isRTL ? "المملكة العربية السعودية" : "Saudi Arabia" },
    { value: "United Arab Emirates", label: isRTL ? "الإمارات العربية المتحدة" : "United Arab Emirates" },
    { value: "Bahrain", label: isRTL ? "البحرين" : "Bahrain" },
    { value: "Kuwait", label: isRTL ? "الكويت" : "Kuwait" },
    { value: "Oman", label: isRTL ? "عمان" : "Oman" },
    { value: "Qatar", label: isRTL ? "قطر" : "Qatar" },
    { value: "Egypt", label: isRTL ? "مصر" : "Egypt" },
    { value: "Jordan", label: isRTL ? "الأردن" : "Jordan" },
    { value: "Lebanon", label: isRTL ? "لبنان" : "Lebanon" },
    { value: "Sudan", label: isRTL ? "السودان" : "Sudan" },
    { value: "Yemen", label: isRTL ? "اليمن" : "Yemen" },
    { value: "Pakistan", label: isRTL ? "باكستان" : "Pakistan" },
    { value: "India", label: isRTL ? "الهند" : "India" },
    { value: "Bangladesh", label: isRTL ? "بنغلاديش" : "Bangladesh" },
    { value: "Philippines", label: isRTL ? "الفلبين" : "Philippines" },
    { value: "Other", label: isRTL ? "أخرى" : "Other" },
  ];

  // Default profession list (with nested specialties) — used as fallback
  // when Amna hasn't populated the Strapi Profession collection. Once she
  // adds entries in Strapi, those override this entire fallback.
  const defaultProfessions: ProfessionEntry[] = [
    {
      value: "Physician",
      label: isRTL ? "طبيب" : "Physician",
      specialties: [
        { value: "Internal Medicine", label: isRTL ? "الطب الباطني" : "Internal Medicine" },
        { value: "Cardiology", label: isRTL ? "أمراض القلب" : "Cardiology" },
        { value: "Dermatology", label: isRTL ? "الأمراض الجلدية" : "Dermatology" },
        { value: "Pediatrics", label: isRTL ? "طب الأطفال" : "Pediatrics" },
        { value: "Family Medicine", label: isRTL ? "طب الأسرة" : "Family Medicine" },
        { value: "Emergency Medicine", label: isRTL ? "طب الطوارئ" : "Emergency Medicine" },
      ],
    },
    {
      value: "Surgeon",
      label: isRTL ? "جراح" : "Surgeon",
      specialties: [
        { value: "General Surgery", label: isRTL ? "الجراحة العامة" : "General Surgery" },
        { value: "Orthopedic Surgery", label: isRTL ? "جراحة العظام" : "Orthopedic Surgery" },
        { value: "Neurosurgery", label: isRTL ? "جراحة الأعصاب" : "Neurosurgery" },
        { value: "Plastic Surgery", label: isRTL ? "جراحة التجميل" : "Plastic Surgery" },
      ],
    },
    {
      value: "Dentist",
      label: isRTL ? "طبيب أسنان" : "Dentist",
      specialties: [
        { value: "Orthodontics", label: isRTL ? "تقويم الأسنان" : "Orthodontics" },
        { value: "Endodontics", label: isRTL ? "علاج الجذور" : "Endodontics" },
        { value: "Pediatric Dentistry", label: isRTL ? "طب أسنان الأطفال" : "Pediatric Dentistry" },
      ],
    },
    {
      value: "Pharmacist",
      label: isRTL ? "صيدلي" : "Pharmacist",
      specialties: [
        { value: "Clinical Pharmacy", label: isRTL ? "الصيدلة السريرية" : "Clinical Pharmacy" },
        { value: "Hospital Pharmacy", label: isRTL ? "صيدلة المستشفيات" : "Hospital Pharmacy" },
        { value: "Industrial Pharmacy", label: isRTL ? "الصيدلة الصناعية" : "Industrial Pharmacy" },
      ],
    },
    {
      value: "Nurse",
      label: isRTL ? "ممرض" : "Nurse",
      specialties: [
        { value: "Critical Care Nursing", label: isRTL ? "تمريض الحالات الحرجة" : "Critical Care Nursing" },
        { value: "Pediatric Nursing", label: isRTL ? "تمريض الأطفال" : "Pediatric Nursing" },
        { value: "Operating Room Nursing", label: isRTL ? "تمريض غرف العمليات" : "Operating Room Nursing" },
      ],
    },
    {
      value: "Physiotherapist",
      label: isRTL ? "أخصائي علاج طبيعي" : "Physiotherapist",
      specialties: [
        { value: "Orthopedic Physiotherapy", label: isRTL ? "العلاج الطبيعي للعظام" : "Orthopedic Physiotherapy" },
        { value: "Neurological Physiotherapy", label: isRTL ? "العلاج الطبيعي العصبي" : "Neurological Physiotherapy" },
        { value: "Sports Physiotherapy", label: isRTL ? "العلاج الطبيعي الرياضي" : "Sports Physiotherapy" },
      ],
    },
    { value: "Occupational Therapist", label: isRTL ? "أخصائي علاج وظيفي" : "Occupational Therapist", specialties: [] },
    { value: "Speech Therapist", label: isRTL ? "أخصائي نطق" : "Speech Therapist", specialties: [] },
    { value: "Other", label: isRTL ? "أخرى" : "Other", specialties: [] },
  ];

  const defaultQualification = [
    { value: "Diploma", label: isRTL ? "دبلوم" : "Diploma" },
    { value: "Bachelor", label: isRTL ? "بكالوريوس" : "Bachelor" },
    { value: "MBBS", label: "MBBS" },
    { value: "Pharm.D", label: "Pharm.D" },
    { value: "DPT", label: "DPT" },
    { value: "Master", label: isRTL ? "ماجستير" : "Master" },
    { value: "MD", label: "MD" },
    { value: "PhD", label: isRTL ? "دكتوراه" : "PhD" },
    { value: "Saudi Board", label: isRTL ? "البورد السعودي" : "Saudi Board" },
    { value: "Fellowship", label: isRTL ? "زمالة" : "Fellowship" },
    { value: "Board Certified", label: isRTL ? "بورد معتمد" : "Board Certified" },
    { value: "Other", label: isRTL ? "أخرى" : "Other" },
  ];

  const defaultRank = [
    { value: "General Practitioner", label: isRTL ? "طبيب عام" : "General Practitioner" },
    { value: "Resident", label: isRTL ? "طبيب مقيم" : "Resident" },
    { value: "Senior Resident", label: isRTL ? "مقيم أول" : "Senior Resident" },
    { value: "Specialist", label: isRTL ? "أخصائي" : "Specialist" },
    { value: "Senior Specialist", label: isRTL ? "أخصائي أول" : "Senior Specialist" },
    { value: "Consultant", label: isRTL ? "استشاري" : "Consultant" },
    { value: "Senior Consultant", label: isRTL ? "استشاري أول" : "Senior Consultant" },
    { value: "Assistant Professor", label: isRTL ? "أستاذ مساعد" : "Assistant Professor" },
    { value: "Associate Professor", label: isRTL ? "أستاذ مشارك" : "Associate Professor" },
    { value: "Professor", label: isRTL ? "أستاذ" : "Professor" },
    { value: "Other", label: isRTL ? "أخرى" : "Other" },
  ];

  const defaultBank = [
    { value: "Al Rajhi Bank", label: isRTL ? "مصرف الراجحي" : "Al Rajhi Bank" },
    { value: "Saudi National Bank", label: isRTL ? "البنك الأهلي السعودي" : "Saudi National Bank" },
    { value: "Riyad Bank", label: isRTL ? "بنك الرياض" : "Riyad Bank" },
    { value: "Al Bilad Bank", label: isRTL ? "بنك البلاد" : "Al Bilad Bank" },
    { value: "Alinma Bank", label: isRTL ? "بنك الإنماء" : "Alinma Bank" },
    { value: "SAB", label: isRTL ? "البنك السعودي الأول" : "SAB (Saudi Awwal Bank)" },
    { value: "ANB", label: isRTL ? "البنك العربي الوطني" : "ANB (Arab National Bank)" },
    { value: "Bank Aljazira", label: isRTL ? "بنك الجزيرة" : "Bank Aljazira" },
    { value: "Banque Saudi Fransi", label: isRTL ? "البنك السعودي الفرنسي" : "Banque Saudi Fransi" },
    { value: "Saudi Investment Bank", label: isRTL ? "البنك السعودي للاستثمار" : "Saudi Investment Bank" },
    { value: "STC Pay", label: "STC Pay" },
    { value: "Other", label: isRTL ? "أخرى" : "Other" },
  ];

  // Strapi options take priority when configured (non-empty)
  const usableStrapi = (arr: StrapiDropdownOption[] | null | undefined) =>
    Array.isArray(arr) && arr.length > 0 ? arr.map((o) => ({ value: o.value, label: o.label })) : null;

  // Nationality: prefer the full country list from country-state-city (250
  // entries, searchable). Fall back to Strapi/curated list while the
  // dataset is still loading or if the lib couldn't load.
  const nationalityOptions = csc
    ? csc.Country.getAllCountries().map((c) => ({ value: c.name, label: c.name }))
    : usableStrapi(strapiNationality) || defaultNationality;
  const isSaudiNationality = formData.nationality === "Saudi Arabia";
  const nationalIdLabel = isSaudiNationality
    ? (isRTL ? "رقم الهوية الوطنية" : "National ID")
    : (isRTL ? "رقم الإقامة / جواز السفر" : "Iqama / Passport Number");
  const nationalIdPlaceholder = isSaudiNationality
    ? (isRTL ? "10 أرقام تبدأ بـ 1" : "10 digits starting with 1")
    : (isRTL ? "رقم الإقامة أو جواز السفر" : "Iqama or passport number");
  const qualificationOptions = usableStrapi(strapiQualification) || defaultQualification;
  const rankOptions = usableStrapi(strapiRank) || defaultRank;
  const bankOptions = usableStrapi(strapiBank) || defaultBank;

  // Profession cascade: Amna's Strapi Profession collection takes priority;
  // fall back to the curated default list if she hasn't populated it yet.
  const professions: ProfessionEntry[] =
    strapiProfessions && strapiProfessions.length > 0
      ? strapiProfessions
      : defaultProfessions;
  const professionOptions = professions.map((p) => ({ value: p.value, label: p.label }));

  // Match by label or value (the ComboBox stores label, but values can also be typed).
  const selectedProfession = professions.find(
    (p) => p.label === formData.profession || p.value === formData.profession,
  );
  const specialtyOptions = (selectedProfession?.specialties || []).map((s) => ({ value: s.value, label: s.label }));

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === "hasScfhsNumber") {
        setFormData((prev) => ({ ...prev, hasScfhsNumber: checked, noScfhsNumber: !checked }));
      } else if (name === "noScfhsNumber") {
        setFormData((prev) => ({ ...prev, noScfhsNumber: checked, hasScfhsNumber: !checked }));
      } else if (name === "uploadResume") {
        setFormData((prev) => ({ ...prev, uploadResume: checked, createResume: !checked }));
      } else if (name === "createResume") {
        setFormData((prev) => ({ ...prev, createResume: checked, uploadResume: !checked }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDropdownSelect = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Changing profession invalidates the previously selected specialty
      if (field === "profession") next.specialty = "";
      return next;
    });
    if (field !== "profession" && field !== "specialty" && field !== "qualification" && field !== "rank") {
      // ComboBox manages its own typing/picking — close on non-combobox field selects
      setOpenDropdown(null);
    }
  };

  // Backend caps uploads at 10MB and accepts only PDF/JPEG/PNG/WebP — guard
  // here so the user sees the problem before submit instead of a silent failure.
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"];
  const ALLOWED_DOC_MIMES = ["application/pdf"];

  const validateFile = (file: File, allowed: string[]): string | null => {
    if (file.size > MAX_FILE_BYTES) {
      return locale === "ar"
        ? `الملف ${file.name} يتجاوز الحد الأقصى 10 ميجابايت`
        : `${file.name} exceeds the 10MB limit`;
    }
    if (!allowed.includes(file.type)) {
      return locale === "ar"
        ? `نوع الملف ${file.name} غير مدعوم`
        : `${file.name} is not a supported file type`;
    }
    return null;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, ALLOWED_PHOTO_MIMES);
    if (err) {
      toast.error(err);
      e.target.value = "";
      return;
    }
    setFormData((prev) => ({
      ...prev,
      photo: file,
      photoPreview: URL.createObjectURL(file),
    }));
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    if (file) {
      const err = validateFile(file, ALLOWED_DOC_MIMES);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  /**
   * Upload a file. Uses the scoped JWT issued from OTP verification when
   * the applicant is anonymous; falls back to the regular access token
   * when they happen to be logged in (admin/manager preview, etc).
   */
  const uploadFile = async (
    file: File,
    overrideToken?: string,
  ): Promise<{ url: string; filename: string }> => {
    const token = overrideToken || scopedToken || getAccessToken();
    const formPayload = new FormData();
    formPayload.append("file", file);

    const res = await fetch(`${API_URL}/storage/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formPayload,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason = (body?.message as string) || `${res.status} ${res.statusText}`;
      throw new Error(`${file.name}: ${reason}`);
    }
    return res.json();
  };

  /**
   * Submit click — runs in two stages:
   *   1. First click: validate, then open OTP modal (which requests + verifies code,
   *      then calls onVerified with a scoped JWT). After verify, this submit
   *      handler is re-invoked from the modal callback with scopedToken set.
   *   2. With scopedToken set: actually upload files + POST the application.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one name field is filled
    if (!formData.fullNameArabic && !formData.fullNameEnglish) {
      toast.error(locale === "ar" ? "يرجى إدخال الاسم بالعربية أو الإنجليزية على الأقل" : "Please enter at least one name (Arabic or English)");
      return;
    }

    if (!formData.email) {
      toast.error(locale === "ar" ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
      return;
    }

    if (!formData.countryName) {
      toast.error(locale === "ar" ? "يرجى اختيار الدولة" : "Please select a country");
      return;
    }
    if (!formData.stateName) {
      toast.error(locale === "ar" ? "يرجى اختيار المنطقة / الولاية" : "Please select a state / region");
      return;
    }
    if (!formData.cityName) {
      toast.error(locale === "ar" ? "يرجى إدخال المدينة" : "Please select or enter a city");
      return;
    }

    // Phone validation — uses libphonenumber-js (handles every country).
    // For SA, surface a Saudi-specific message; for others, generic.
    if (showMobileNumber && formData.phoneE164) {
      const valid = isValidPhoneNumber(formData.phoneE164);
      if (!valid) {
        const parsed = parsePhoneNumber(formData.phoneE164);
        const isSaudi = parsed?.country === "SA";
        toast.error(
          isSaudi
            ? (locale === "ar" ? "أدخل رقم جوال سعودي صحيح" : "Please enter a valid Saudi mobile number")
            : (locale === "ar" ? "أدخل رقم جوال صحيح" : "Please enter a valid mobile number"),
        );
        return;
      }
    }

    if (showNationalIqamaId && formData.nationalIqamaId) {
      const id = formData.nationalIqamaId.trim();
      if (isSaudiNationality) {
        // Saudi citizens: National ID is 10 digits starting with 1
        if (!/^1\d{9}$/.test(id)) {
          toast.error(
            locale === "ar"
              ? "رقم الهوية الوطنية يجب أن يكون 10 أرقام ويبدأ بـ 1"
              : "National ID must be 10 digits starting with 1",
          );
          return;
        }
      } else {
        // Non-Saudi: accept Iqama (10 digits starting with 2) OR a passport
        // number. Permissive alphanumeric range covers both.
        if (!/^[A-Za-z0-9]{4,20}$/.test(id)) {
          toast.error(
            locale === "ar"
              ? "أدخل رقم إقامة أو جواز سفر صحيح"
              : "Please enter a valid Iqama or passport number",
          );
          return;
        }
      }
    }

    if (showScfhsToggle && formData.hasScfhsNumber && formData.scfhsNumber) {
      // Allow letters + digits (some SCFHS numbers have alphanumeric prefixes), 4–15 chars
      if (!/^[A-Za-z0-9]{4,15}$/.test(formData.scfhsNumber.trim())) {
        toast.error(
          locale === "ar"
            ? "أدخل رقم تصنيف هيئة التخصصات الصحية صحيح"
            : "Please enter a valid SCFHS number",
        );
        return;
      }
    }

    if (showBankSection && formData.iban) {
      const cleanIban = formData.iban.replace(/\s/g, "").toUpperCase();
      // ibantools validates length + country prefix + mod-97 checksum for
      // every IBAN-registry country (SA, AE, GB, EG, ...). Catches typos
      // that a length-only regex would miss.
      if (!isValidIBAN(cleanIban)) {
        toast.error(
          locale === "ar"
            ? "أدخل رقم آيبان صحيح"
            : "Please enter a valid IBAN",
        );
        return;
      }
    }

    // Stage 1: open OTP modal (uses captcha token from inline widget)
    if (!scopedToken) {
      if (!recaptchaToken) {
        toast.error(
          locale === "ar"
            ? "يرجى إكمال التحقق \"لست برنامج روبوت\""
            : "Please complete the \"I'm not a robot\" verification",
        );
        return;
      }
      setOtpModalOpen(true);
      return;
    }

    // Stage 2: scopedToken present — proceed with submission
    await actuallySubmit(scopedToken);
  };

  const actuallySubmit = async (token: string) => {
    setIsSubmitting(true);

    try {
      // Upload files (uses scoped JWT). Any failure aborts the whole submission
      // so the applicant gets a clear toast instead of a silently empty record.
      const resumeFiles: Array<{ type: string; url: string; filename: string }> = [];
      const pending: Array<{ type: string; file: File }> = [];

      // Only the upload-resume path uploads a CV file. The create-resume
      // path captures structured entries via ResumeBuilder (no file upload).
      if (formData.uploadResume && files.resume) {
        pending.push({ type: "resume", file: files.resume });
      }
      if (formData.photo) {
        pending.push({ type: "photo", file: formData.photo });
      }

      for (const { type, file } of pending) {
        try {
          const result = await uploadFile(file, token);
          resumeFiles.push({ type, url: result.url, filename: result.filename });
        } catch (uploadErr) {
          const detail = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          toast.error(
            locale === "ar"
              ? `تعذر رفع الملف — ${detail}`
              : `Could not upload file — ${detail}`,
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Derive country (ISO-2) + national number from the single E.164 value
      const parsedPhone = formData.phoneE164 ? parsePhoneNumber(formData.phoneE164) : null;
      const phoneCountry = parsedPhone?.country || "";
      const phoneNational = parsedPhone?.nationalNumber || "";

      const profileData = {
        fullNameArabic: formData.fullNameArabic,
        fullNameEnglish: formData.fullNameEnglish,
        firstName: formData.fullNameEnglish?.split(" ")[0] || formData.fullNameArabic?.split(" ")[0] || "",
        lastName: formData.fullNameEnglish?.split(" ").slice(1).join(" ") || formData.fullNameArabic?.split(" ").slice(1).join(" ") || "",
        email: formData.email,
        phone: formData.phoneE164,
        countryCode: phoneCountry,
        mobileNumber: phoneNational,
        country: formData.countryName,
        state: formData.stateName,
        city: formData.cityName,
        gender: formData.gender,
        nationality: formData.nationality,
        nationalIqamaId: formData.nationalIqamaId,
        profession: formData.profession,
        specialty: formData.specialty,
        qualification: formData.qualification,
        academicRank: formData.rank,
        hasScfhsNumber: formData.hasScfhsNumber,
        scfhsNumber: formData.hasScfhsNumber ? formData.scfhsNumber : "",
        twitter: formData.twitter,
        linkedIn: formData.linkedIn,
      };

      const bankData = {
        accountHolderName: formData.accountHolderName,
        bankName: formData.bankName,
        iban: formData.iban.replace(/\s/g, "").toUpperCase(),
      };

      // POST to public submit endpoint (validated by scoped JWT)
      const res = await fetch(`${API_URL}/trainer-applications/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileData,
          bankData,
          resumeFiles,
          // Only ship structured resume when applicant chose the create-resume path
          structuredResume: formData.createResume ? structuredResume : undefined,
          locale,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Failed to submit application");
      }

      setSubmitSuccess(true);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const msg = error.message || "Failed to submit application. Please try again.";
      toast.error(msg);
      // Reset captcha + scoped token so user can retry cleanly
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
      setScopedToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to handle file changes with proper typing
  const handleFileChangeWrapper = (field: string, file: File | null) => {
    handleFileChange(field as keyof typeof files, file);
  };

  // Loading state
  if (checkingStatus) {
    return (
      <section className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </section>
    );
  }

  // Helper: next-intl returns the key path (truthy) when missing, so || fallback won't work
  const tt = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  // Auth gate removed — form is public. OTP verifies email; captcha blocks bots.

  // Already an instructor
  if (isInstructor) {
    return (
      <section className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-white rounded-2xl p-10 max-w-md mx-auto text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{tt("alreadyTrainer", "You're Already a Trainer!")}</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">{tt("alreadyTrainerDesc", "You already have the Instructor role.")}</p>
          <button
            onClick={() => switchRole("INSTRUCTOR")}
            className="inline-block px-6 py-3 bg-[#002D87] text-white rounded-xl font-medium hover:bg-[#001A52] transition-colors"
          >
            {tt("goToDashboard", "Go to Instructor Dashboard")}
          </button>
        </div>
      </section>
    );
  }

  // Existing pending/more_info application
  if (existingApplication) {
    const status = existingApplication.status;
    return (
      <section className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-white rounded-2xl p-10 max-w-md mx-auto text-center shadow-sm">
          <Clock className="w-12 h-12 text-[#F59E0B] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {status === "PENDING" ? tt("pendingApplication", "Application Under Review") : tt("moreInfoNeeded", "Additional Information Needed")}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-2">
            {status === "PENDING"
              ? tt("pendingApplicationDesc", "Your application is being reviewed. We'll notify you once a decision is made.")
              : tt("moreInfoNeededDesc", "The reviewer has requested more information about your application.")}
          </p>
          {status === "MORE_INFO" && existingApplication.reviewNote && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-4 text-sm text-[#92400E] text-start">
              <strong>{tt("reviewerNote", "Reviewer note")}:</strong> {existingApplication.reviewNote}
            </div>
          )}
          <p className="text-xs text-[var(--color-text-secondary)]">
            {tt("submittedOn", "Submitted on")}: {new Date(existingApplication.createdAt).toLocaleDateString()}
          </p>
        </div>
      </section>
    );
  }

  // Success state — anonymous submitters don't have a dashboard yet, just confirm by email
  if (submitSuccess) {
    return (
      <section className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center px-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-white rounded-2xl p-10 max-w-md mx-auto text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
            {isRTL ? "تم إرسال طلبك" : "Your request has been submitted"}
          </h2>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            {isRTL
              ? "طلبك قيد المراجعة. سيتم إعلامك بالنتيجة عبر البريد الإلكتروني قريبًا."
              : "Your request is under review. You'll be notified by email shortly."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--color-surface-page)] min-h-screen" dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block" style={{ padding: "48px 64px" }}>
        <div className="max-w-[1000px] mx-auto">
          <h1 className="font-semibold text-[var(--on-surface-default)] text-center mb-10" style={{ fontSize: "48px" }}>
            {labels.title}
          </h1>

          {/* Single Card containing all sections */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-3xl p-10" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

              {/* Profile Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-8" style={{ fontSize: "30px" }}>
                {labels.profileTitle}
              </h2>

               {/* Divider */}
               <div className="w-full h-px bg-[var(--color-border)]" />

              <div className="flex flex-col">
                {/* Photo Upload */}
                <div className="flex items-center py-6 justify-between">
                  {/* In RTL: first item goes to RIGHT (start), last item goes to LEFT (end) */}
                  <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>{labels.photo}</span>
                  <div className="flex items-center gap-6">
                    <div
                      className="w-12 h-12 rounded-full bg-[var(--color-surface-page)] flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {formData.photoPreview ? (
                        <Image src={formData.photoPreview} alt="Profile" width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-5 py-2 border border-[var(--color-primary)] rounded-lg text-sm font-medium text-[var(--color-primary)] hover:bg-[color-mix(in srgb, var(--color-primary) 10%, transparent)]"
                    >
                      {locale === "ar" ? "رفع الصورة" : "Upload Photo"}
                    </button>
                    {formData.photo && (
                      <button
                        type="button"
                        onClick={() => {
                          if (photoInputRef.current) photoInputRef.current.value = "";
                          setFormData((prev) => ({ ...prev, photo: null, photoPreview: "" }));
                        }}
                        aria-label={locale === "ar" ? "إزالة الصورة" : "Remove photo"}
                        className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[var(--color-border)]" />

                {/* Full Name - Two inputs */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {labels.fullName} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="flex flex-col gap-3 w-1/2">
                    <input
                      type="text"
                      name="fullNameArabic"
                      value={formData.fullNameArabic}
                      onChange={handleInputChange}
                      placeholder={labels.fullNameArPlaceholder}
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                    <input
                      type="text"
                      name="fullNameEnglish"
                      value={formData.fullNameEnglish}
                      onChange={handleInputChange}
                      placeholder={labels.fullNameEnPlaceholder}
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[var(--color-border)]" />

                {/* Email Address */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {labels.email} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="relative w-1/2">
                    <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-4" : "left-4"}`} strokeWidth={1.5} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full h-12 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "pr-12 pl-4 text-right" : "pl-12 pr-4"}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

            

                {/* Mobile Number with international country selector */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {labels.mobile} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 pg-phone-field" dir={isRTL ? "rtl" : "ltr"}>
                    <PhoneInput
                      international
                      defaultCountry="SA"
                      value={formData.phoneE164}
                      onChange={(v) => setFormData((prev) => ({ ...prev, phoneE164: v || "" }))}
                      placeholder={isRTL ? "أدخل رقم الجوال" : "Enter phone number"}
                      labels={isRTL ? phoneArLabels : undefined}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[var(--color-border)]" />

                {showGender && <Dropdown label={labels.gender} field="gender" placeholder={isRTL ? "اختر الجنس" : "Select gender"} options={genderOptions} required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} />}
                {showNationality && <SearchableDropdown label={labels.nationality} field="nationality" placeholder={isRTL ? "اختر الجنسية" : "Select nationality"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={nationalityOptions} required value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} isRTL={isRTL} />}
                {showNationalIqamaId && <InputField label={nationalIdLabel} name="nationalIqamaId" placeholder={nationalIdPlaceholder} required value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />}

                <SearchableDropdown label={isRTL ? "الدولة" : "Country"} field="countryIso" required placeholder={isRTL ? "اختر الدولة" : "Select country"} searchPlaceholder={isRTL ? "ابحث عن دولة..." : "Search country..."} options={countryOptions} value={formData.countryIso} isOpen={openDropdown === "countryIso"} onToggle={() => setOpenDropdown(openDropdown === "countryIso" ? null : "countryIso")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!csc} />
                {stateOptions.length > 0 ? (
                  <SearchableDropdown label={isRTL ? "المنطقة / الولاية" : "State / Region"} field="stateIso" required placeholder={isRTL ? "اختر المنطقة" : "Select state"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={stateOptions} value={formData.stateIso} isOpen={openDropdown === "stateIso"} onToggle={() => setOpenDropdown(openDropdown === "stateIso" ? null : "stateIso")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.countryIso} />
                ) : (
                  <SearchableDropdown label={isRTL ? "المنطقة / الولاية" : "State / Region"} field="stateName" required placeholder={isRTL ? "أدخل المنطقة" : "Enter state / region"} options={[]} value={formData.stateName} isOpen={false} onToggle={() => {}} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.countryIso} />
                )}
                {cityOptions.length > 0 ? (
                  <SearchableDropdown label={isRTL ? "المدينة" : "City"} field="cityName" required placeholder={isRTL ? "اختر المدينة" : "Select city"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={cityOptions} value={formData.cityName} isOpen={openDropdown === "cityName"} onToggle={() => setOpenDropdown(openDropdown === "cityName" ? null : "cityName")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.stateName} />
                ) : (
                  <SearchableDropdown label={isRTL ? "المدينة" : "City"} field="cityName" required placeholder={isRTL ? "أدخل المدينة" : "Enter city"} options={[]} value={formData.cityName} isOpen={false} onToggle={() => {}} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.stateName} />
                )}

                {showProfession && <ComboBox label={labels.profession} field="profession" required placeholder={isRTL ? "اختر أو اكتب المهنة" : "Select or type profession"} options={professionOptions} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onChange={handleDropdownSelect} isRTL={isRTL} />}
                {showSpecialty && <ComboBox label={labels.speciality} field="specialty" required placeholder={!formData.profession ? (isRTL ? "اختر المهنة أولاً" : "Pick a profession first") : (isRTL ? "اختر أو اكتب التخصص" : "Select or type specialty")} options={specialtyOptions} value={formData.specialty} isOpen={openDropdown === "specialty"} onToggle={() => setOpenDropdown(openDropdown === "specialty" ? null : "specialty")} onChange={handleDropdownSelect} isRTL={isRTL} disabled={!formData.profession} />}
                {showQualification && <ComboBox label={labels.qualification} field="qualification" required placeholder={isRTL ? "اختر أو اكتب المؤهل" : "Select or type qualification"} options={qualificationOptions} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onChange={handleDropdownSelect} isRTL={isRTL} />}
                {showAcademicRank && <ComboBox label={labels.rank} field="rank" required placeholder={isRTL ? "اختر أو اكتب الدرجة" : "Select or type rank"} options={rankOptions} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onChange={handleDropdownSelect} isRTL={isRTL} />}

                {/* SCFHS Number Question */}
                <div className="flex py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)] pt-1" style={{ fontSize: "16px" }}>
                    {labels.scfhsQuestion} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 flex flex-col gap-3">
                    <div className="flex gap-8 pt-3">
                      <Checkbox label={labels.yes} name="hasScfhsNumber" checked={formData.hasScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                      <Checkbox label={labels.no} name="noScfhsNumber" checked={formData.noScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                    </div>
                    {formData.hasScfhsNumber && (
                      <input
                        type="text"
                        name="scfhsNumber"
                        value={formData.scfhsNumber}
                        onChange={handleInputChange}
                        placeholder={locale === "ar" ? "أدخل رقم التصنيف" : "Enter SCFHS number"}
                        className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                        style={{ fontSize: "16px" }}
                      />
                    )}
                  </div>
                </div>
                <div className="w-full h-px bg-[var(--color-border)]" />

                {showTwitter && <InputField label={labels.twitter} name="twitter" placeholder="https://twitter.com/username" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />}
                {showLinkedIn && <InputField label={labels.linkedIn} name="linkedIn" placeholder="https://linkedin.com/in/username" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />}
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[var(--color-border)] my-10" />

              {/* Resume Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                {labels.resumeTitle}
              </h2>
              <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px" }}>
                {labels.resumeDesc}
              </p>

              {/* Resume Options */}
              <div className="flex gap-8 mb-8">
                <Checkbox label={labels.uploadResume} name="uploadResume" checked={formData.uploadResume} onChange={handleInputChange} isRTL={isRTL} />
                <Checkbox label={labels.createResume} name="createResume" checked={formData.createResume} onChange={handleInputChange} isRTL={isRTL} />
              </div>

              {formData.uploadResume && (
                <div className="flex flex-col gap-8">
                  <FileUpload label={locale === "ar" ? "السيرة الذاتية" : "Resume / CV"} field="resume" file={files.resume} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                </div>
              )}

              {formData.createResume && (
                <ResumeBuilder
                  value={structuredResume}
                  onChange={setStructuredResume}
                  isRTL={isRTL}
                  professions={professions}
                  qualificationOptions={qualificationOptions}
                  rankOptions={rankOptions}
                />
              )}

              {/* Divider */}
              <div className="w-full h-px bg-[var(--color-border)] my-10" />

              {/* Bank Account Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                {labels.bankTitle}
              </h2>

              {/* Thin divider under heading */}
              <div className="w-full h-px bg-[var(--color-border)]" />

              <div className="flex flex-col ">
                {showBankSection && <InputField label={labels.accountHolder} name="accountHolderName" placeholder={isRTL ? "اسم صاحب الحساب" : "e.g. Mohammed Al-Fulan"} required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />}
                {showBankSection && <ComboBox label={labels.bankName} field="bankName" required placeholder={isRTL ? "اختر أو اكتب اسم البنك" : "Select or type bank name"} options={bankOptions} value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onChange={handleDropdownSelect} isRTL={isRTL} />}
                {showBankSection && <InputField label={labels.iban} name="iban" placeholder="SA00 0000 0000 0000 0000 0000" required withDivider={false} value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />}
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[var(--color-border)] my-10" />

              {/* reCAPTCHA */}
              {RECAPTCHA_SITE_KEY && (
                <div className="flex justify-center mb-6" dir="ltr">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={RECAPTCHA_SITE_KEY}
                    hl={isRTL ? "ar" : "en"}
                    onChange={(t) => setRecaptchaToken(t)}
                    onExpired={() => setRecaptchaToken(null)}
                    onErrored={() => setRecaptchaToken(null)}
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end">
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[var(--color-border)] hover:bg-gray-50">
                  {labels.cancel}
                </button>
                <button type="submit" disabled={isSubmitting || (!!RECAPTCHA_SITE_KEY && !recaptchaToken)} className="h-11 px-6 rounded-lg font-medium text-white btn-gold disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? tt("submitting", "Submitting...") : (locale === "ar" ? "تقديم الطلب" : "Submit Application")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden px-4 py-6 pb-24">
        <h1 className="font-semibold text-[var(--on-surface-default)] mb-6 text-center" style={{ fontSize: "30px" }}>
          {labels.title}
        </h1>

        {/* Single Card containing all sections */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

            {/* Profile Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-5" style={{ fontSize: "24px" }}>
              {labels.profileTitle}
            </h2>
             {/* Divider */}
             <div className="w-full h-px bg-[var(--color-border)] my-2" />

            <div className="flex flex-col gap-5">
              {/* Photo Upload */}
              <div className="flex flex-col gap-3">
                <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>{labels.photo}</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-5 py-2 border border-[var(--color-primary)] rounded-lg text-sm font-medium text-[var(--color-primary)] hover:bg-[color-mix(in srgb, var(--color-primary) 10%, transparent)]"
                  >
                    {locale === "ar" ? "رفع الصورة" : "Upload Photo"}
                  </button>
                  {formData.photo && (
                    <button
                      type="button"
                      onClick={() => {
                        if (photoInputRef.current) photoInputRef.current.value = "";
                        setFormData((prev) => ({ ...prev, photo: null, photoPreview: "" }));
                      }}
                      aria-label={locale === "ar" ? "إزالة الصورة" : "Remove photo"}
                      className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div
                    className="w-12 h-12 rounded-full bg-[var(--color-surface-page)] flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {formData.photoPreview ? (
                      <Image src={formData.photoPreview} alt="Profile" width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[var(--color-border)] my-2" />

              {/* Full Name */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {labels.fullName} <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  name="fullNameArabic"
                  value={formData.fullNameArabic}
                  onChange={handleInputChange}
                  placeholder={labels.fullNameArPlaceholder}
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                  style={{ fontSize: "16px" }}
                />
                <input
                  type="text"
                  name="fullNameEnglish"
                  value={formData.fullNameEnglish}
                  onChange={handleInputChange}
                  placeholder={labels.fullNameEnPlaceholder}
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                  style={{ fontSize: "16px" }}
                />
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] my-1" />

              <InputField label={labels.email} name="email" type="email" required icon={<Mail className="w-5 h-5" strokeWidth={1.5} />} withDivider={false} value={formData.email} onChange={handleInputChange} isRTL={isRTL} />

              {/* Mobile Number */}
              <div className="flex flex-col gap-2">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {labels.mobile} <span className="text-[#dc2626]">*</span>
                </label>
                <div className="pg-phone-field" dir={isRTL ? "rtl" : "ltr"}>
                  <PhoneInput
                    international
                    defaultCountry="SA"
                    value={formData.phoneE164}
                    onChange={(v) => setFormData((prev) => ({ ...prev, phoneE164: v || "" }))}
                    placeholder={isRTL ? "أدخل رقم الجوال" : "Enter phone number"}
                  />
                </div>
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] " />

              {showGender && <Dropdown label={labels.gender} field="gender" placeholder={isRTL ? "اختر الجنس" : "Select gender"} options={genderOptions} required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} />}
              {showNationality && <SearchableDropdown label={labels.nationality} field="nationality" placeholder={isRTL ? "اختر الجنسية" : "Select nationality"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={nationalityOptions} required value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} isRTL={isRTL} />}
              {showNationalIqamaId && <InputField label={nationalIdLabel} name="nationalIqamaId" placeholder={nationalIdPlaceholder} required withDivider={false} value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />}

              <SearchableDropdown label={isRTL ? "الدولة" : "Country"} field="countryIso" required placeholder={isRTL ? "اختر الدولة" : "Select country"} searchPlaceholder={isRTL ? "ابحث عن دولة..." : "Search country..."} options={countryOptions} value={formData.countryIso} isOpen={openDropdown === "countryIso"} onToggle={() => setOpenDropdown(openDropdown === "countryIso" ? null : "countryIso")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!csc} />
              {stateOptions.length > 0 ? (
                <SearchableDropdown label={isRTL ? "المنطقة / الولاية" : "State / Region"} field="stateIso" required placeholder={isRTL ? "اختر المنطقة" : "Select state"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={stateOptions} value={formData.stateIso} isOpen={openDropdown === "stateIso"} onToggle={() => setOpenDropdown(openDropdown === "stateIso" ? null : "stateIso")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.countryIso} />
              ) : (
                <SearchableDropdown label={isRTL ? "المنطقة / الولاية" : "State / Region"} field="stateName" required placeholder={isRTL ? "أدخل المنطقة" : "Enter state / region"} options={[]} value={formData.stateName} isOpen={false} onToggle={() => {}} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.countryIso} />
              )}
              {cityOptions.length > 0 ? (
                <SearchableDropdown label={isRTL ? "المدينة" : "City"} field="cityName" required placeholder={isRTL ? "اختر المدينة" : "Select city"} searchPlaceholder={isRTL ? "ابحث..." : "Search..."} options={cityOptions} value={formData.cityName} isOpen={openDropdown === "cityName"} onToggle={() => setOpenDropdown(openDropdown === "cityName" ? null : "cityName")} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.stateName} />
              ) : (
                <SearchableDropdown label={isRTL ? "المدينة" : "City"} field="cityName" required placeholder={isRTL ? "أدخل المدينة" : "Enter city"} options={[]} value={formData.cityName} isOpen={false} onToggle={() => {}} onSelect={handleLocationSelect} isRTL={isRTL} disabled={!formData.stateName} />
              )}

              {showProfession && <ComboBox label={labels.profession} field="profession" required placeholder={isRTL ? "اختر أو اكتب المهنة" : "Select or type profession"} options={professionOptions} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onChange={handleDropdownSelect} isRTL={isRTL} />}
              {showSpecialty && <ComboBox label={labels.speciality} field="specialty" required placeholder={!formData.profession ? (isRTL ? "اختر المهنة أولاً" : "Pick a profession first") : (isRTL ? "اختر أو اكتب التخصص" : "Select or type specialty")} options={specialtyOptions} value={formData.specialty} isOpen={openDropdown === "specialty"} onToggle={() => setOpenDropdown(openDropdown === "specialty" ? null : "specialty")} onChange={handleDropdownSelect} isRTL={isRTL} disabled={!formData.profession} />}
              {showQualification && <ComboBox label={labels.qualification} field="qualification" required placeholder={isRTL ? "اختر أو اكتب المؤهل" : "Select or type qualification"} options={qualificationOptions} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onChange={handleDropdownSelect} isRTL={isRTL} />}
              {showAcademicRank && <ComboBox label={labels.rank} field="rank" required placeholder={isRTL ? "اختر أو اكتب الدرجة" : "Select or type rank"} options={rankOptions} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onChange={handleDropdownSelect} isRTL={isRTL} />}

              {/* SCFHS Number Question */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {labels.scfhsQuestion} <span className="text-[#dc2626]">*</span>
                </label>
                <div className="flex gap-6">
                  <Checkbox label={labels.yes} name="hasScfhsNumber" checked={formData.hasScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                  <Checkbox label={labels.no} name="noScfhsNumber" checked={formData.noScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                </div>
                {formData.hasScfhsNumber && (
                  <input
                    type="text"
                    name="scfhsNumber"
                    value={formData.scfhsNumber}
                    onChange={handleInputChange}
                    placeholder={locale === "ar" ? "أدخل رقم التصنيف" : "Enter SCFHS number"}
                    className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "text-right" : ""}`}
                    style={{ fontSize: "16px" }}
                  />
                )}
              </div>
               {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] " />

              {showTwitter && <InputField label={labels.twitter} name="twitter" placeholder="https://twitter.com/username" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />}
              {showLinkedIn && <InputField label={labels.linkedIn} name="linkedIn" placeholder="https://linkedin.com/in/username" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />}
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] my-8" />

            {/* Resume Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "24px" }}>
              {labels.resumeTitle}
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-5" style={{ fontSize: "14px" }}>
              {labels.resumeDesc}
            </p>

            {/* Resume Options */}
            <div className="flex flex-col gap-6 mb-5">
              <Checkbox label={labels.uploadResume} name="uploadResume" checked={formData.uploadResume} onChange={handleInputChange} isRTL={isRTL} />
              <Checkbox label={labels.createResume} name="createResume" checked={formData.createResume} onChange={handleInputChange} isRTL={isRTL} />
            </div>

            {formData.uploadResume && (
              <div className="flex flex-col gap-5">
                <FileUpload label={locale === "ar" ? "السيرة الذاتية" : "Resume / CV"} field="resume" file={files.resume} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
              </div>
            )}

            {formData.createResume && (
              <ResumeBuilder
                value={structuredResume}
                onChange={setStructuredResume}
                isRTL={isRTL}
                professions={professions}
                qualificationOptions={qualificationOptions}
                rankOptions={rankOptions}
              />
            )}

             {/* Divider */}
             <div className="w-full h-px bg-[var(--color-border)] my-8" />

            {/* Bank Account Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] my-6 pt-6" style={{ fontSize: "24px" }}>
              {labels.bankTitle}
            </h2>

             {/* Divider */}
             <div className="w-full h-px bg-[var(--color-border)] " />

            <div className="flex flex-col ">
              {showBankSection && <InputField label={labels.accountHolder} name="accountHolderName" placeholder={isRTL ? "اسم صاحب الحساب" : "e.g. Mohammed Al-Fulan"} required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />}
              {showBankSection && <ComboBox label={labels.bankName} field="bankName" required placeholder={isRTL ? "اختر أو اكتب اسم البنك" : "Select or type bank name"} options={bankOptions} value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onChange={handleDropdownSelect} isRTL={isRTL} />}
              {showBankSection && <InputField label={labels.iban} name="iban" placeholder="SA00 0000 0000 0000 0000 0000" required value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />}
            </div>

            {/* reCAPTCHA */}
            {RECAPTCHA_SITE_KEY && (
              <div className="flex justify-center mt-6" dir="ltr">
                <ReCAPTCHA
                  sitekey={RECAPTCHA_SITE_KEY}
                  hl={isRTL ? "ar" : "en"}
                  onChange={(t) => setRecaptchaToken(t)}
                  onExpired={() => setRecaptchaToken(null)}
                  onErrored={() => setRecaptchaToken(null)}
                />
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[var(--color-border)] hover:bg-gray-50">
                {labels.cancel}
              </button>
              <button type="submit" disabled={isSubmitting || (!!RECAPTCHA_SITE_KEY && !recaptchaToken)} className="flex-1 h-12 rounded-xl font-medium text-white btn-gold disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? tt("submitting", "Submitting...") : (locale === "ar" ? "تقديم الطلب" : "Submit Application")}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* OTP Verification Modal — opens on submit, returns scoped JWT */}
      <OtpVerifyModal
        isOpen={otpModalOpen}
        email={formData.email}
        recaptchaToken={recaptchaToken}
        onVerified={(token) => {
          setScopedToken(token);
          setOtpModalOpen(false);
          // Resume submission with the scoped token
          actuallySubmit(token);
        }}
        onClose={() => setOtpModalOpen(false)}
      />
    </section>
  );
};

export default BecomeTrainerForm;
