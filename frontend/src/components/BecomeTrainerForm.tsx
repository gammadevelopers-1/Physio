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
          <div className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-border-subtle)] ${isRTL ? "right-4" : "left-4"}`}>
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
          className={`w-full h-12 ${icon ? (isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4') : 'px-4'} py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
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
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors bg-white ${checked ? 'border-[var(--color-primary)]' : 'border-[var(--color-border-subtle)]'}`}>
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
            className="w-full h-12 px-4 bg-white border border-[var(--color-border-subtle)] rounded-lg flex items-center justify-between cursor-pointer"
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
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[var(--color-border-subtle)] rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(field, option.value)}
                  className="w-full px-4 py-2.5 hover:bg-[var(--color-surface-page)] transition-colors flex items-center gap-2 text-left"
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
        className="bg-[#F8FAFC] border border-[var(--color-border-subtle)] rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
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
  professionOptions?: StrapiDropdownOption[] | null;
  qualificationOptions?: StrapiDropdownOption[] | null;
  rankOptions?: StrapiDropdownOption[] | null;
  bankOptions?: StrapiDropdownOption[] | null;
  countryCodeOptions?: StrapiDropdownOption[] | null;
}

interface StrapiDropdownOption {
  id?: number;
  value: string;
  label: string;
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
  professionOptions: strapiProfession = null,
  qualificationOptions: strapiQualification = null,
  rankOptions: strapiRank = null,
  bankOptions: strapiBank = null,
  countryCodeOptions: strapiCountryCode = null,
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
    countryCode: "SA",
    mobileNumber: "",
    gender: "",
    nationality: "Saudi Arabia",
    nationalIqamaId: "",
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingApplication, setExistingApplication] = useState<RoleRequest | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
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

  // Specialty as tag input — applicants type and press Enter / comma to add
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");

  const addSpecialtyTag = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (!tag) return;
    setSpecialtyTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setSpecialtyInput("");
  };
  const removeSpecialtyTag = (idx: number) =>
    setSpecialtyTags((prev) => prev.filter((_, i) => i !== idx));

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

  const defaultProfession = [
    { value: "Physician", label: isRTL ? "طبيب" : "Physician" },
    { value: "Surgeon", label: isRTL ? "جراح" : "Surgeon" },
    { value: "Dentist", label: isRTL ? "طبيب أسنان" : "Dentist" },
    { value: "Pharmacist", label: isRTL ? "صيدلي" : "Pharmacist" },
    { value: "Nurse", label: isRTL ? "ممرض" : "Nurse" },
    { value: "Physiotherapist", label: isRTL ? "أخصائي علاج طبيعي" : "Physiotherapist" },
    { value: "Occupational Therapist", label: isRTL ? "أخصائي علاج وظيفي" : "Occupational Therapist" },
    { value: "Speech Therapist", label: isRTL ? "أخصائي نطق" : "Speech Therapist" },
    { value: "Medical Lab Technologist", label: isRTL ? "فني مختبر طبي" : "Medical Lab Technologist" },
    { value: "Radiology Technician", label: isRTL ? "فني أشعة" : "Radiology Technician" },
    { value: "Respiratory Therapist", label: isRTL ? "أخصائي علاج تنفسي" : "Respiratory Therapist" },
    { value: "Paramedic", label: isRTL ? "مسعف" : "Paramedic" },
    { value: "Health Educator", label: isRTL ? "مثقف صحي" : "Health Educator" },
    { value: "Hospital Administrator", label: isRTL ? "مدير مستشفى" : "Hospital Administrator" },
    { value: "Other", label: isRTL ? "أخرى" : "Other" },
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

  const defaultCountryCode = [
    { value: "SA", label: "+966 SA" },
    { value: "AE", label: "+971 AE" },
    { value: "BH", label: "+973 BH" },
    { value: "KW", label: "+965 KW" },
    { value: "OM", label: "+968 OM" },
    { value: "QA", label: "+974 QA" },
    { value: "EG", label: "+20 EG" },
    { value: "JO", label: "+962 JO" },
  ];

  // Strapi options take priority when configured (non-empty)
  const usableStrapi = (arr: StrapiDropdownOption[] | null | undefined) =>
    Array.isArray(arr) && arr.length > 0 ? arr.map((o) => ({ value: o.value, label: o.label })) : null;

  const nationalityOptions = usableStrapi(strapiNationality) || defaultNationality;
  const professionOptions = usableStrapi(strapiProfession) || defaultProfession;
  const qualificationOptions = usableStrapi(strapiQualification) || defaultQualification;
  const rankOptions = usableStrapi(strapiRank) || defaultRank;
  const bankOptions = usableStrapi(strapiBank) || defaultBank;
  const countryCodeOptions = usableStrapi(strapiCountryCode) || defaultCountryCode;

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
    setFormData((prev) => ({ ...prev, [field]: value }));
    setOpenDropdown(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
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
  ): Promise<{ url: string; filename: string } | null> => {
    const token = overrideToken || scopedToken || getAccessToken();
    const formPayload = new FormData();
    formPayload.append("file", file);

    try {
      const res = await fetch(`${API_URL}/storage/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formPayload,
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
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
    setSubmitError(null);

    // Validate at least one name field is filled
    if (!formData.fullNameArabic && !formData.fullNameEnglish) {
      setSubmitError(locale === "ar" ? "يرجى إدخال الاسم بالعربية أو الإنجليزية على الأقل" : "Please enter at least one name (Arabic or English)");
      return;
    }

    if (!formData.email) {
      setSubmitError(locale === "ar" ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
      return;
    }

    // ─── KSA-specific format validations ─────────────────────────
    if (showMobileNumber && formData.mobileNumber) {
      const cleanMobile = formData.mobileNumber.replace(/\s/g, "");
      if (formData.countryCode === "SA" && !/^5\d{8}$/.test(cleanMobile)) {
        setSubmitError(
          locale === "ar"
            ? "رقم الجوال السعودي يجب أن يبدأ بالرقم 5 ويتكون من 9 أرقام"
            : "Saudi mobile number must start with 5 and be 9 digits",
        );
        return;
      }
    }

    if (showNationalIqamaId && formData.nationalIqamaId) {
      if (!/^[12]\d{9}$/.test(formData.nationalIqamaId.trim())) {
        setSubmitError(
          locale === "ar"
            ? "رقم الهوية / الإقامة يجب أن يكون 10 أرقام يبدأ بـ 1 أو 2"
            : "National/Iqama ID must be 10 digits starting with 1 or 2",
        );
        return;
      }
    }

    if (showScfhsToggle && formData.hasScfhsNumber && formData.scfhsNumber) {
      if (!/^\d{6,10}$/.test(formData.scfhsNumber.trim())) {
        setSubmitError(
          locale === "ar"
            ? "رقم تصنيف هيئة التخصصات الصحية يجب أن يكون 6 إلى 10 أرقام"
            : "SCFHS number must be 6 to 10 digits",
        );
        return;
      }
    }

    if (showBankSection && formData.iban) {
      const cleanIban = formData.iban.replace(/\s/g, "").toUpperCase();
      if (!/^SA\d{22}$/.test(cleanIban)) {
        setSubmitError(
          locale === "ar"
            ? "رقم الآيبان يجب أن يبدأ بـ SA ويتكون من 24 خانة"
            : "IBAN must start with SA and be 24 characters",
        );
        return;
      }
    }

    // Stage 1: open OTP modal (uses captcha token from inline widget)
    if (!scopedToken) {
      if (!recaptchaToken) {
        setSubmitError(
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
    setSubmitError(null);

    try {
      // Upload files (uses scoped JWT)
      const resumeFiles: Array<{ type: string; url: string; filename: string }> = [];

      if (formData.uploadResume && files.resume) {
        const result = await uploadFile(files.resume, token);
        if (result) {
          resumeFiles.push({ type: "resume", url: result.url, filename: result.filename });
        }
      } else if (formData.createResume) {
        const fileEntries: [string, File | null][] = [
          ["education", files.education],
          ["professionalSkills", files.professionalSkills],
          ["scientificResearches", files.scientificResearches],
          ["trainingExperience", files.trainingExperience],
        ];

        for (const [type, file] of fileEntries) {
          if (file) {
            const result = await uploadFile(file, token);
            if (result) {
              resumeFiles.push({ type, url: result.url, filename: result.filename });
            }
          }
        }
      }

      if (formData.photo) {
        const photoResult = await uploadFile(formData.photo, token);
        if (photoResult) {
          resumeFiles.push({ type: "photo", url: photoResult.url, filename: photoResult.filename });
        }
      }

      const profileData = {
        fullNameArabic: formData.fullNameArabic,
        fullNameEnglish: formData.fullNameEnglish,
        firstName: formData.fullNameEnglish?.split(" ")[0] || formData.fullNameArabic?.split(" ")[0] || "",
        lastName: formData.fullNameEnglish?.split(" ").slice(1).join(" ") || formData.fullNameArabic?.split(" ").slice(1).join(" ") || "",
        email: formData.email,
        countryCode: formData.countryCode,
        mobileNumber: formData.mobileNumber,
        gender: formData.gender,
        nationality: formData.nationality,
        nationalIqamaId: formData.nationalIqamaId,
        profession: formData.profession,
        specialty: specialtyTags.length > 0 ? specialtyTags.join(", ") : formData.specialty,
        specialtyTags: specialtyTags.length > 0 ? specialtyTags : undefined,
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
        body: JSON.stringify({ profileData, bankData, resumeFiles, locale }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Failed to submit application");
      }

      setSubmitSuccess(true);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const msg = error.message || "Failed to submit application. Please try again.";
      setSubmitError(msg);
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
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            {tt("submittedOn", "Submitted on")}: {new Date(existingApplication.createdAt).toLocaleDateString()}
          </p>
          <Link
            href={`/${locale}/dashboard/student/applications`}
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            {tt("viewApplications", "View My Applications")}
          </Link>
        </div>
      </section>
    );
  }

  // Success state
  if (submitSuccess) {
    return (
      <section className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-white rounded-2xl p-10 max-w-md mx-auto text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{tt("submitSuccess", "Application Submitted!")}</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">{tt("submitSuccessDesc", "We'll review your application and notify you within a few business days.")}</p>
          <Link
            href={`/${locale}/dashboard/student/applications`}
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            {tt("viewApplications", "View My Applications")}
          </Link>
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

          {/* Error banner */}
          {submitError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

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
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
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
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                    <input
                      type="text"
                      name="fullNameEnglish"
                      value={formData.fullNameEnglish}
                      onChange={handleInputChange}
                      placeholder={labels.fullNameEnPlaceholder}
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
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
                    <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-border-subtle)] ${isRTL ? "right-4" : "left-4"}`} strokeWidth={1.5} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full h-12 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "pr-12 pl-4 text-right" : "pl-12 pr-4"}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

            

                {/* Mobile Number with country code */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {labels.mobile} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className={`w-1/2 flex h-12 bg-white border border-[var(--color-border-subtle)] rounded-lg overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === "countryCode" ? null : "countryCode")}
                        className={`h-full px-4 flex items-center gap-1 cursor-pointer bg-white ${isRTL ? "border-l border-[var(--color-border-subtle)]" : "border-r border-[var(--color-border-subtle)]"}`}
                      >
                        <span className="text-[var(--on-surface-default)] whitespace-nowrap" style={{ fontSize: "16px" }}>
                          {countryCodeOptions.find((o) => o.value === formData.countryCode)?.label || formData.countryCode}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCode" ? "rotate-180" : ""}`} />
                      </button>
                      {openDropdown === "countryCode" && (
                        <div className={`absolute top-full mt-1 bg-white border border-[var(--color-border-subtle)] rounded-lg shadow-lg z-20 min-w-[80px] ${isRTL ? "right-0" : "left-0"}`}>
                          {countryCodeOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, countryCode: opt.value }));
                                setOpenDropdown(null);
                              }}
                              className={`w-full px-4 py-2 hover:bg-[var(--color-surface-page)] transition-colors ${isRTL ? "text-right" : "text-left"} whitespace-nowrap`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleInputChange}
                      required
                      className={`flex-1 px-4 py-2.5 focus:outline-none ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[var(--color-border)]" />

                {showGender && <Dropdown label={labels.gender} field="gender" options={genderOptions} required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} />}
                {showNationality && <Dropdown label={labels.nationality} field="nationality" options={nationalityOptions} withDivider={false} required showFlag value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} />}
                {showNationalIqamaId && <InputField label={labels.nationalId} name="nationalIqamaId" required value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />}
                {showProfession && <Dropdown label={labels.profession} field="profession" options={professionOptions} required withDivider={false} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onSelect={handleDropdownSelect} />}
                {showSpecialty && (
                  <>
                    <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0 lg:justify-between">
                      <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                        {labels.speciality}
                      </label>
                      <div className="w-full lg:w-1/2">
                        <div className="min-h-12 px-3 py-2 bg-white border border-[var(--color-border-subtle)] rounded-lg flex flex-wrap items-center gap-1.5">
                          {specialtyTags.map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
                              {tag}
                              <button type="button" onClick={() => removeSpecialtyTag(idx)} aria-label="remove tag" className="hover:text-[var(--color-primary-dark)]">×</button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={specialtyInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.endsWith(",")) addSpecialtyTag(v);
                              else setSpecialtyInput(v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addSpecialtyTag(specialtyInput); }
                              else if (e.key === "Backspace" && !specialtyInput && specialtyTags.length) removeSpecialtyTag(specialtyTags.length - 1);
                            }}
                            onBlur={() => specialtyInput && addSpecialtyTag(specialtyInput)}
                            placeholder={isRTL ? "اكتب التخصص ثم Enter أو فاصلة" : "Type specialty then Enter or comma"}
                            className={`flex-1 min-w-[140px] py-1 outline-none bg-transparent ${isRTL ? "text-right" : ""}`}
                            style={{ fontSize: "16px" }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {showQualification && <Dropdown label={labels.qualification} field="qualification" options={qualificationOptions} required withDivider={false} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onSelect={handleDropdownSelect} />}
                {showAcademicRank && <Dropdown label={labels.rank} field="rank" options={rankOptions} required withDivider={false} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onSelect={handleDropdownSelect} />}

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
                        className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                        style={{ fontSize: "16px" }}
                      />
                    )}
                  </div>
                </div>
                <div className="w-full h-px bg-[var(--color-border)]" />

                {showTwitter && <InputField label={labels.twitter} name="twitter" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />}
                {showLinkedIn && <InputField label={labels.linkedIn} name="linkedIn" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />}
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
                <div className="flex flex-col gap-8">
                  <FileUpload label={labels.education} field="education" file={files.education} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                  <FileUpload label={labels.professionalSkills} field="professionalSkills" file={files.professionalSkills} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                  <FileUpload label={labels.scientificResearches} field="scientificResearches" file={files.scientificResearches} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                  <FileUpload label={labels.trainingExperience} field="trainingExperience" file={files.trainingExperience} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                </div>
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
                {showBankSection && <InputField label={labels.accountHolder} name="accountHolderName" required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />}
                {showBankSection && <Dropdown label={labels.bankName} field="bankName" options={bankOptions} withDivider={false} required value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onSelect={handleDropdownSelect} />}
                {showBankSection && <InputField label={labels.iban} name="iban" required withDivider={false} value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />}
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
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[var(--color-border-subtle)] hover:bg-gray-50">
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

        {/* Error banner */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

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
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                  style={{ fontSize: "16px" }}
                />
                <input
                  type="text"
                  name="fullNameEnglish"
                  value={formData.fullNameEnglish}
                  onChange={handleInputChange}
                  placeholder={labels.fullNameEnPlaceholder}
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
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
                <div className={`flex h-12 bg-white border border-[var(--color-border-subtle)] rounded-lg overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "countryCodeMobile" ? null : "countryCodeMobile")}
                      className={`h-full px-4 flex items-center gap-1 cursor-pointer ${isRTL ? "border-l border-[var(--color-border-subtle)]" : "border-r border-[var(--color-border-subtle)]"}`}
                    >
                      <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                        {formData.countryCode}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCodeMobile" ? "rotate-180" : ""}`} />
                    </button>
                    {openDropdown === "countryCodeMobile" && (
                      <div className={`absolute top-full mt-1 bg-white border border-[var(--color-border-subtle)] rounded-lg shadow-lg z-20 min-w-[80px] ${isRTL ? "right-0" : "left-0"}`}>
                        {["SA", "AE", "EG", "JO"].map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, countryCode: code }));
                              setOpenDropdown(null);
                            }}
                            className={`w-full px-4 py-2 hover:bg-[var(--color-surface-page)] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    required
                    className={`flex-1 px-4 py-2.5 focus:outline-none ${isRTL ? "text-right" : ""}`}
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] " />

              {showGender && <Dropdown label={labels.gender} field="gender" options={genderOptions} required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} />}
              {showNationality && <Dropdown label={labels.nationality} field="nationality" options={nationalityOptions} required showFlag withDivider={false} value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} />}
              {showNationalIqamaId && <InputField label={labels.nationalId} name="nationalIqamaId" required withDivider={false} value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />}
              {showProfession && <Dropdown label={labels.profession} field="profession" options={professionOptions} required withDivider={false} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onSelect={handleDropdownSelect} />}
              {showSpecialty && (
                <div className="flex flex-col py-4 gap-2">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {labels.speciality}
                  </label>
                  <div className="min-h-12 px-3 py-2 bg-white border border-[var(--color-border-subtle)] rounded-lg flex flex-wrap items-center gap-1.5">
                    {specialtyTags.map((tag, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
                        {tag}
                        <button type="button" onClick={() => removeSpecialtyTag(idx)} aria-label="remove tag" className="hover:text-[var(--color-primary-dark)]">×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={specialtyInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.endsWith(",")) addSpecialtyTag(v);
                        else setSpecialtyInput(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addSpecialtyTag(specialtyInput); }
                        else if (e.key === "Backspace" && !specialtyInput && specialtyTags.length) removeSpecialtyTag(specialtyTags.length - 1);
                      }}
                      onBlur={() => specialtyInput && addSpecialtyTag(specialtyInput)}
                      placeholder={isRTL ? "اكتب التخصص ثم Enter أو فاصلة" : "Type specialty then Enter or comma"}
                      className={`flex-1 min-w-[140px] py-1 outline-none bg-transparent ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
              )}
              {showQualification && <Dropdown label={labels.qualification} field="qualification" options={qualificationOptions} required withDivider={false} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onSelect={handleDropdownSelect} />}
              {showAcademicRank && <Dropdown label={labels.rank} field="rank" options={rankOptions} required withDivider={false} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onSelect={handleDropdownSelect} />}

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
                    className={`w-full h-12 px-4 py-2.5 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                    style={{ fontSize: "16px" }}
                  />
                )}
              </div>
               {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border)] " />

              {showTwitter && <InputField label={labels.twitter} name="twitter" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />}
              {showLinkedIn && <InputField label={labels.linkedIn} name="linkedIn" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />}
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
              <div className="flex flex-col gap-5">
                <FileUpload label={labels.education} field="education" file={files.education} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                <FileUpload label={labels.professionalSkills} field="professionalSkills" file={files.professionalSkills} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                <FileUpload label={labels.scientificResearches} field="scientificResearches" file={files.scientificResearches} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
                <FileUpload label={labels.trainingExperience} field="trainingExperience" file={files.trainingExperience} onFileChange={handleFileChangeWrapper} isRTL={isRTL} clickToUploadLabel={labels.clickToUpload} orDragDropLabel={labels.orDragDrop} pdfMaxSizeLabel={labels.pdfMaxSize} />
              </div>
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
              {showBankSection && <InputField label={labels.accountHolder} name="accountHolderName" required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />}
              {showBankSection && <Dropdown label={labels.bankName} field="bankName" options={bankOptions} required withDivider={false} value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onSelect={handleDropdownSelect} />}
              {showBankSection && <InputField label={labels.iban} name="iban" required value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />}
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
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[var(--color-border-subtle)] hover:bg-gray-50">
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
