"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Trash2, Mail, Image as ImageIcon, CloudUpload } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

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
          <div className={`absolute top-1/2 -translate-y-1/2 text-[#C8D5E1] ${isRTL ? "right-4" : "left-4"}`}>
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
          className={`w-full h-12 ${icon ? (isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4') : 'px-4'} py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
          style={{ fontSize: "16px" }}
        />
      </div>
    </div>
    {withDivider && <div className="w-full h-px bg-[#F0F0F0]" />}
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
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors bg-white ${checked ? 'border-[#a37f49]' : 'border-[#C8D5E1]'}`}>
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="#a37f49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
  translationKey,
  value,
  isOpen,
  onToggle,
  onSelect,
  t,
  required = false,
  placeholder = "",
  showFlag = false,
  withDivider = true,
}: {
  label: string;
  field: string;
  options: { value: string; key: string }[];
  translationKey: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (field: string, value: string) => void;
  t: (key: string) => string;
  required?: boolean;
  placeholder?: string;
  showFlag?: boolean;
  withDivider?: boolean;
}) => {
  const getTranslatedValue = (val: string) => {
    const option = options.find(opt => opt.value === val);
    if (option) {
      return t(`options.${translationKey}.${option.key}`);
    }
    return val;
  };

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
            className="w-full h-12 px-4 bg-white border border-[#C8D5E1] rounded-lg flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {showFlag && value === "Saudi Arabia" && (
                <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />
              )}
              <span className={value ? "text-[var(--on-surface-default)]" : "text-[var(--on-surface-variant)]"} style={{ fontSize: "16px" }}>
                {value ? getTranslatedValue(value) : placeholder}
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(field, option.value)}
                  className="w-full px-4 py-2.5 hover:bg-[#EEF3F7] transition-colors flex items-center gap-2"
                  style={{ fontSize: "16px" }}
                >
                  {showFlag && option.value === "Saudi Arabia" && <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />}
                  {t(`options.${translationKey}.${option.key}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {withDivider && <div className="w-full h-px bg-[#F0F0F0]" />}
    </>
  );
};

// FileUpload component moved outside to prevent re-creation on parent re-render
const FileUpload = ({
  label,
  field,
  file,
  onFileChange,
  t,
  accept = ".pdf",
  isRTL = false,
}: {
  label: string;
  field: string;
  file: File | null;
  onFileChange: (field: string, file: File | null) => void;
  t: (key: string) => string;
  accept?: string;
  isRTL?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex flex-col gap-3 ${isRTL ? "text-right" : ""}`}>
      <label className="text-[var(--on-surface-default)] font-semibold" style={{ fontSize: "16px" }}>
        {label}
      </label>
      <div
        className="bg-[#F8FAFC] border border-[#C8D5E1] rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
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
            <div className="w-12 h-12 rounded-full bg-[#EEF3F7] flex items-center justify-center">
              <CloudUpload className="w-6 h-6 text-[#6B7280]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <span className="text-sm text-[#002D87] font-medium">{t("resume.clickToUpload")}</span>
              <span className="text-sm text-[var(--on-surface-variant)]"> {t("resume.orDragAndDrop")}</span>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {t("resume.pdfMaxSize")}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const BecomeTrainerForm = () => {
  const t = useTranslations("becomeTrainerPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
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
    twitter: "",
    linkedIn: "",
    uploadResume: false,
    createResume: true,
    accountHolderName: "",
    bankName: "",
    iban: "",
  });

  const [files, setFiles] = useState({
    education: null as File | null,
    professionalSkills: null as File | null,
    scientificResearches: null as File | null,
    trainingExperience: null as File | null,
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Option mappings with translation keys
  const genderOptions = [
    { value: "Male", key: "male" },
    { value: "Female", key: "female" },
  ];
  const nationalityOptions = [
    { value: "Saudi Arabia", key: "saudiArabia" },
    { value: "United Arab Emirates", key: "uae" },
    { value: "Egypt", key: "egypt" },
    { value: "Jordan", key: "jordan" },
    { value: "Other", key: "other" },
  ];
  const professionOptions = [
    { value: "Doctor", key: "doctor" },
    { value: "Nurse", key: "nurse" },
    { value: "Physiotherapist", key: "physiotherapist" },
    { value: "Pharmacist", key: "pharmacist" },
    { value: "Other", key: "other" },
  ];
  const specialtyOptions = [
    { value: "Cardiology", key: "cardiology" },
    { value: "Neurology", key: "neurology" },
    { value: "Orthopedics", key: "orthopedics" },
    { value: "Pediatrics", key: "pediatrics" },
    { value: "Other", key: "other" },
  ];
  const qualificationOptions = [
    { value: "Bachelor", key: "bachelor" },
    { value: "Master", key: "master" },
    { value: "PhD", key: "phd" },
    { value: "Board Certified", key: "boardCertified" },
    { value: "Other", key: "other" },
  ];
  const rankOptions = [
    { value: "Junior", key: "junior" },
    { value: "Senior", key: "senior" },
    { value: "Consultant", key: "consultant" },
    { value: "Professor", key: "professor" },
    { value: "Other", key: "other" },
  ];
  const bankOptions = [
    { value: "Al Rajhi Bank", key: "alRajhi" },
    { value: "Saudi National Bank", key: "snb" },
    { value: "Riyad Bank", key: "riyad" },
    { value: "Al Bilad Bank", key: "alBilad" },
    { value: "Other", key: "other" },
  ];

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData, files);
  };

  // Helper function to handle file changes with proper typing
  const handleFileChangeWrapper = (field: string, file: File | null) => {
    handleFileChange(field as keyof typeof files, file);
  };

  return (
    <section className="bg-[#EEF3F7] min-h-screen" dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block" style={{ padding: "48px 64px" }}>
        <div className="max-w-[1000px] mx-auto">
          <h1 className="font-semibold text-[var(--on-surface-default)] text-center mb-10" style={{ fontSize: "48px" }}>
            {t("title")}
          </h1>

          {/* Single Card containing all sections */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-3xl p-10" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

              {/* Profile Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-8" style={{ fontSize: "30px" }}>
                {t("profile.title")}
              </h2>

               {/* Divider */}
               <div className="w-full h-px bg-[#F0F0F0]" />

              <div className="flex flex-col">
                {/* Photo Upload */}
                <div className="flex items-center py-6 justify-between">
                  {/* In RTL: first item goes to RIGHT (start), last item goes to LEFT (end) */}
                  <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>{t("profile.photo")}</span>
                  <div className="flex items-center gap-6">
                    <div
                      className="w-12 h-12 rounded-full bg-[#EEF3F7] flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {formData.photoPreview ? (
                        <Image src={formData.photoPreview} alt="Profile" width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-5 py-2 border border-[#a37f49] rounded-lg text-sm font-medium text-[#a37f49] hover:bg-[#fdf8f3]"
                    >
                      {t("profile.attachCV")}
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
                <div className="w-full h-px bg-[#F0F0F0]" />

                {/* Full Name - Two inputs */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {t("profile.fullName")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="flex flex-col gap-3 w-1/2">
                    <input
                      type="text"
                      name="fullNameArabic"
                      value={formData.fullNameArabic}
                      onChange={handleInputChange}
                      required
                      placeholder={t("profile.fullNameArabicPlaceholder")}
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                    <input
                      type="text"
                      name="fullNameEnglish"
                      value={formData.fullNameEnglish}
                      onChange={handleInputChange}
                      required
                      placeholder={t("profile.fullNameEnglishPlaceholder")}
                      className={`w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[#F0F0F0]" />

                {/* Email Address */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {t("profile.emailAddress")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="relative w-1/2">
                    <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#C8D5E1] ${isRTL ? "right-4" : "left-4"}`} strokeWidth={1.5} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full h-12 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "pr-12 pl-4 text-right" : "pl-12 pr-4"}`}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

            

                {/* Mobile Number with country code */}
                <div className="flex items-start py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    {t("profile.mobileNumber")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className={`w-1/2 flex h-12 bg-white border border-[#C8D5E1] rounded-lg overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === "countryCode" ? null : "countryCode")}
                        className={`h-full px-4 flex items-center gap-1 cursor-pointer bg-white ${isRTL ? "border-l border-[#C8D5E1]" : "border-r border-[#C8D5E1]"}`}
                      >
                        <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                          {formData.countryCode}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCode" ? "rotate-180" : ""}`} />
                      </button>
                      {openDropdown === "countryCode" && (
                        <div className={`absolute top-full mt-1 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 min-w-[80px] ${isRTL ? "right-0" : "left-0"}`}>
                          {["SA", "AE", "EG", "JO"].map((code) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, countryCode: code }));
                                setOpenDropdown(null);
                              }}
                              className={`w-full px-4 py-2 hover:bg-[#EEF3F7] transition-colors ${isRTL ? "text-right" : "text-left"}`}
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
                <div className="w-full h-px bg-[#F0F0F0]" />

                <Dropdown label={t("profile.gender")} field="gender" options={genderOptions} translationKey="gender" required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} t={t} />
                <Dropdown label={t("profile.nationality")} field="nationality" options={nationalityOptions} translationKey="nationality" withDivider={false} required showFlag value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} t={t} />
                <InputField label={t("profile.nationalIqamaId")} name="nationalIqamaId" required value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />
                <Dropdown label={t("profile.profession")} field="profession" options={professionOptions} translationKey="profession" required withDivider={false} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onSelect={handleDropdownSelect} t={t} />
                <Dropdown label={t("profile.speciality")} field="specialty" options={specialtyOptions} translationKey="specialty" required withDivider={false} value={formData.specialty} isOpen={openDropdown === "specialty"} onToggle={() => setOpenDropdown(openDropdown === "specialty" ? null : "specialty")} onSelect={handleDropdownSelect} t={t} />
                <Dropdown label={t("profile.qualification")} field="qualification" options={qualificationOptions} translationKey="qualification" required withDivider={false} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onSelect={handleDropdownSelect} t={t} />
                <Dropdown label={t("profile.rank")} field="rank" options={rankOptions} translationKey="rank" required withDivider={false} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onSelect={handleDropdownSelect} t={t} />

                {/* SCFHS Number Question */}
                <div className="flex py-6 justify-between">
                  <label className="shrink-0 text-[var(--on-surface-default)] pt-1" style={{ fontSize: "16px" }}>
                    {t("profile.scfhsQuestion")} <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 flex gap-8 pt-3">
                    <Checkbox label={t("buttons.yes")} name="hasScfhsNumber" checked={formData.hasScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                    <Checkbox label={t("buttons.no")} name="noScfhsNumber" checked={formData.noScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                  </div>
                </div>
                <div className="w-full h-px bg-[#F0F0F0]" />

                <InputField label={t("profile.twitter")} name="twitter" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />
                <InputField label={t("profile.linkedIn")} name="linkedIn" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Resume Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                {t("resume.title")}
              </h2>
              <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px" }}>
                {t("resume.description")}
              </p>

              {/* Resume Options */}
              <div className="flex gap-8 mb-8">
                <Checkbox label={t("resume.uploadResume")} name="uploadResume" checked={formData.uploadResume} onChange={handleInputChange} isRTL={isRTL} />
                <Checkbox label={t("resume.createResume")} name="createResume" checked={formData.createResume} onChange={handleInputChange} isRTL={isRTL} />
              </div>

              <div className="flex flex-col gap-8">
                <FileUpload label={t("resume.education")} field="education" file={files.education} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
                <FileUpload label={t("resume.professionalSkills")} field="professionalSkills" file={files.professionalSkills} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
                <FileUpload label={t("resume.scientificResearches")} field="scientificResearches" file={files.scientificResearches} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
                <FileUpload label={t("resume.trainingExperience")} field="trainingExperience" file={files.trainingExperience} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Cancel/Save for Resume */}
              <div className="flex gap-3 mb-10 justify-end">
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[#C8D5E1] hover:bg-gray-50">
                  {t("buttons.cancel")}
                </button>
                <button type="button" className="h-11 px-6 rounded-lg font-medium text-white btn-gold">
                  {t("buttons.save")}
                </button>
              </div>

              {/* Bank Account Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                {t("bankAccount.title")}
              </h2>

              {/* Thin divider under heading */}
              <div className="w-full h-px bg-[#F0F0F0]" />

              <div className="flex flex-col ">
                <InputField label={t("bankAccount.accountHolderName")} name="accountHolderName" required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />
                <Dropdown label={t("bankAccount.bankName")} field="bankName" options={bankOptions} translationKey="bank" withDivider={false} required value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onSelect={handleDropdownSelect} t={t} />
                <InputField label={t("bankAccount.iban")} name="iban" required withDivider={false} value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end">
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[#C8D5E1] hover:bg-gray-50">
                  {t("buttons.cancel")}
                </button>
                <button type="submit" className="h-11 px-6 rounded-lg font-medium text-white btn-gold">
                  {t("buttons.save")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden px-4 py-6 pb-24">
        <h1 className="font-semibold text-[var(--on-surface-default)] mb-6 text-center" style={{ fontSize: "30px" }}>
          {t("title")}
        </h1>

        {/* Single Card containing all sections */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

            {/* Profile Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-5" style={{ fontSize: "24px" }}>
              {t("profile.title")}
            </h2>
             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] my-2" />

            <div className="flex flex-col gap-5">
              {/* Photo Upload */}
              <div className="flex flex-col gap-3">
                <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>{t("profile.photo")}</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-5 py-2 border border-[#a37f49] rounded-lg text-sm font-medium text-[#a37f49] hover:bg-[#fdf8f3]"
                  >
                    {t("profile.attachCV")}
                  </button>
                  <div
                    className="w-12 h-12 rounded-full bg-[#EEF3F7] flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {formData.photoPreview ? (
                      <Image src={formData.photoPreview} alt="Profile" width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-2" />

              {/* Full Name */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {t("profile.fullName")} <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  name="fullNameArabic"
                  value={formData.fullNameArabic}
                  onChange={handleInputChange}
                  required
                  placeholder={t("profile.fullNameArabicPlaceholder")}
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                  style={{ fontSize: "16px" }}
                />
                <input
                  type="text"
                  name="fullNameEnglish"
                  value={formData.fullNameEnglish}
                  onChange={handleInputChange}
                  required
                  placeholder={t("profile.fullNameEnglishPlaceholder")}
                  className={`w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)] ${isRTL ? "text-right" : ""}`}
                  style={{ fontSize: "16px" }}
                />
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] my-1" />

              <InputField label={t("profile.emailAddress")} name="email" type="email" required icon={<Mail className="w-5 h-5" strokeWidth={1.5} />} withDivider={false} value={formData.email} onChange={handleInputChange} isRTL={isRTL} />

              {/* Mobile Number */}
              <div className="flex flex-col gap-2">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {t("profile.mobileNumber")} <span className="text-[#dc2626]">*</span>
                </label>
                <div className={`flex h-12 bg-white border border-[#C8D5E1] rounded-lg overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "countryCodeMobile" ? null : "countryCodeMobile")}
                      className={`h-full px-4 flex items-center gap-1 cursor-pointer ${isRTL ? "border-l border-[#C8D5E1]" : "border-r border-[#C8D5E1]"}`}
                    >
                      <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                        {formData.countryCode}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCodeMobile" ? "rotate-180" : ""}`} />
                    </button>
                    {openDropdown === "countryCodeMobile" && (
                      <div className={`absolute top-full mt-1 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 min-w-[80px] ${isRTL ? "right-0" : "left-0"}`}>
                        {["SA", "AE", "EG", "JO"].map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, countryCode: code }));
                              setOpenDropdown(null);
                            }}
                            className={`w-full px-4 py-2 hover:bg-[#EEF3F7] transition-colors ${isRTL ? "text-right" : "text-left"}`}
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
            <div className="w-full h-px bg-[#F0F0F0] " />

              <Dropdown label={t("profile.gender")} field="gender" options={genderOptions} translationKey="gender" required value={formData.gender} isOpen={openDropdown === "gender"} onToggle={() => setOpenDropdown(openDropdown === "gender" ? null : "gender")} onSelect={handleDropdownSelect} t={t} />
              <Dropdown label={t("profile.nationality")} field="nationality" options={nationalityOptions} translationKey="nationality" required showFlag withDivider={false} value={formData.nationality} isOpen={openDropdown === "nationality"} onToggle={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")} onSelect={handleDropdownSelect} t={t} />
              <InputField label={t("profile.nationalIqamaId")} name="nationalIqamaId" required withDivider={false} value={formData.nationalIqamaId} onChange={handleInputChange} isRTL={isRTL} />
              <Dropdown label={t("profile.profession")} field="profession" options={professionOptions} translationKey="profession" required withDivider={false} value={formData.profession} isOpen={openDropdown === "profession"} onToggle={() => setOpenDropdown(openDropdown === "profession" ? null : "profession")} onSelect={handleDropdownSelect} t={t} />
              <Dropdown label={t("profile.speciality")} field="specialty" options={specialtyOptions} translationKey="specialty" required withDivider={false} value={formData.specialty} isOpen={openDropdown === "specialty"} onToggle={() => setOpenDropdown(openDropdown === "specialty" ? null : "specialty")} onSelect={handleDropdownSelect} t={t} />
              <Dropdown label={t("profile.qualification")} field="qualification" options={qualificationOptions} translationKey="qualification" required withDivider={false} value={formData.qualification} isOpen={openDropdown === "qualification"} onToggle={() => setOpenDropdown(openDropdown === "qualification" ? null : "qualification")} onSelect={handleDropdownSelect} t={t} />
              <Dropdown label={t("profile.rank")} field="rank" options={rankOptions} translationKey="rank" required withDivider={false} value={formData.rank} isOpen={openDropdown === "rank"} onToggle={() => setOpenDropdown(openDropdown === "rank" ? null : "rank")} onSelect={handleDropdownSelect} t={t} />

              {/* SCFHS Number Question */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  {t("profile.scfhsQuestion")} <span className="text-[#dc2626]">*</span>
                </label>
                <div className="flex gap-6">
                  <Checkbox label={t("buttons.yes")} name="hasScfhsNumber" checked={formData.hasScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                  <Checkbox label={t("buttons.no")} name="noScfhsNumber" checked={formData.noScfhsNumber} onChange={handleInputChange} isRTL={isRTL} />
                </div>
              </div>
               {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] " />

              <InputField label={t("profile.twitter")} name="twitter" withDivider={false} value={formData.twitter} onChange={handleInputChange} isRTL={isRTL} />
              <InputField label={t("profile.linkedIn")} name="linkedIn" withDivider={false} value={formData.linkedIn} onChange={handleInputChange} isRTL={isRTL} />
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] my-8" />

            {/* Resume Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "24px" }}>
              {t("resume.title")}
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-5" style={{ fontSize: "14px" }}>
              {t("resume.description")}
            </p>

            {/* Resume Options */}
            <div className="flex flex-col gap-6 mb-5">
              <Checkbox label={t("resume.uploadResume")} name="uploadResume" checked={formData.uploadResume} onChange={handleInputChange} isRTL={isRTL} />
              <Checkbox label={t("resume.createResume")} name="createResume" checked={formData.createResume} onChange={handleInputChange} isRTL={isRTL} />
            </div>

            <div className="flex flex-col gap-5">
              <FileUpload label={t("resume.education")} field="education" file={files.education} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
              <FileUpload label={t("resume.professionalSkills")} field="professionalSkills" file={files.professionalSkills} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
              <FileUpload label={t("resume.scientificResearches")} field="scientificResearches" file={files.scientificResearches} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
              <FileUpload label={t("resume.trainingExperience")} field="trainingExperience" file={files.trainingExperience} onFileChange={handleFileChangeWrapper} t={t} isRTL={isRTL} />
            </div>

             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] my-8" />

            {/* Cancel/Save Buttons for Resume */}
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[#C8D5E1] hover:bg-gray-50">
                {t("buttons.cancel")}
              </button>
              <button type="button" className="flex-1 h-12 rounded-xl font-medium text-white btn-gold">
                {t("buttons.save")}
              </button>
            </div>

            {/* Bank Account Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] my-6 pt-6" style={{ fontSize: "24px" }}>
              {t("bankAccount.title")}
            </h2>

             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] " />

            <div className="flex flex-col ">
              <InputField label={t("bankAccount.accountHolderName")} name="accountHolderName" required value={formData.accountHolderName} onChange={handleInputChange} isRTL={isRTL} />
              <Dropdown label={t("bankAccount.bankName")} field="bankName" options={bankOptions} translationKey="bank" required withDivider={false} value={formData.bankName} isOpen={openDropdown === "bankName"} onToggle={() => setOpenDropdown(openDropdown === "bankName" ? null : "bankName")} onSelect={handleDropdownSelect} t={t} />
              <InputField label={t("bankAccount.iban")} name="iban" required value={formData.iban} onChange={handleInputChange} isRTL={isRTL} />
            </div>

            {/* Cancel/Save Buttons for Bank Account */}
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[#C8D5E1] hover:bg-gray-50">
                {t("buttons.cancel")}
              </button>
              <button type="submit" className="flex-1 h-12 rounded-xl font-medium text-white btn-gold">
                {t("buttons.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default BecomeTrainerForm;
