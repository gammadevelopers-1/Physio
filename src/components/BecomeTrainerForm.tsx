"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Trash2, Mail, Image as ImageIcon, CloudUpload } from "lucide-react";

const BecomeTrainerForm = () => {
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

  const genderOptions = ["Male", "Female"];
  const nationalityOptions = ["Saudi Arabia", "United Arab Emirates", "Egypt", "Jordan", "Other"];
  const professionOptions = ["Doctor", "Nurse", "Physiotherapist", "Pharmacist", "Other"];
  const specialtyOptions = ["Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Other"];
  const qualificationOptions = ["Bachelor", "Master", "PhD", "Board Certified", "Other"];
  const rankOptions = ["Junior", "Senior", "Consultant", "Professor", "Other"];
  const bankOptions = ["Al Rajhi Bank", "Saudi National Bank", "Riyad Bank", "Al Bilad Bank", "Other"];

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

  const FileUpload = ({
    label,
    field,
    accept = ".pdf",
  }: {
    label: string;
    field: keyof typeof files;
    accept?: string;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const file = files[field];

    return (
      <div className="flex flex-col gap-3">
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
            onChange={(e) => handleFileChange(field, e.target.files?.[0] || null)}
          />
          {file ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-[var(--on-surface-default)] truncate max-w-[200px]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileChange(field, null);
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
                <span className="text-sm text-[#002D87] font-medium">Click to upload</span>
                <span className="text-sm text-[var(--on-surface-variant)]"> or drag and drop</span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                PDF (max. 10MB)
              </p>
            </>
          )}
        </div>
      </div>
    );
  };

  const Dropdown = ({
    label,
    field,
    options,
    required = false,
    placeholder = "",
    showFlag = false,
    withDivider = true,
  }: {
    label: string;
    field: string;
    options: string[];
    required?: boolean;
    placeholder?: string;
    showFlag?: boolean;
    withDivider?: boolean;
  }) => {
    const isOpen = openDropdown === field;
    const value = formData[field as keyof typeof formData] as string;

    return (
      <>
        <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0">
          <label className="lg:w-1/2 shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
            {label} {required && <span className="text-[#dc2626]">*</span>}
          </label>
          <div className="relative w-full lg:w-1/2">
            <button
              type="button"
              onClick={() => setOpenDropdown(isOpen ? null : field)}
              className="w-full h-12 px-4 bg-white border border-[#C8D5E1] rounded-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {showFlag && value === "Saudi Arabia" && (
                  <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />
                )}
                <span className={value ? "text-[var(--on-surface-default)]" : "text-[var(--on-surface-variant)]"} style={{ fontSize: "16px" }}>
                  {value || placeholder}
                </span>
              </div>
              <ChevronDown className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleDropdownSelect(field, option)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#EEF3F7] transition-colors flex items-center gap-2"
                    style={{ fontSize: "16px" }}
                  >
                    {showFlag && option === "Saudi Arabia" && <Image src="/icons/flag.svg" alt="SA" width={20} height={20} className="rounded-sm" />}
                    {option}
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

  const InputField = ({
    label,
    name,
    type = "text",
    required = false,
    placeholder = "",
    icon,
    withDivider = true,
  }: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
    icon?: React.ReactNode;
    withDivider?: boolean;
  }) => (
    <>
      <div className="flex flex-col lg:flex-row lg:items-start py-4 lg:py-6 gap-2 lg:gap-0">
        <label className="lg:w-1/2 shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
        <div className="relative w-full lg:w-1/2">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8D5E1]">
              {icon}
            </div>
          )}
          <input
            type={type}
            name={name}
            value={formData[name as keyof typeof formData] as string}
            onChange={handleInputChange}
            required={required}
            placeholder={placeholder}
            className={`w-full h-12 ${icon ? 'pl-12' : 'px-4'} pr-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]`}
            style={{ fontSize: "16px" }}
          />
        </div>
      </div>
      {withDivider && <div className="w-full h-px bg-[#F0F0F0]" />}
    </>
  );

  const Checkbox = ({
    label,
    name,
    checked,
  }: {
    label: string;
    name: string;
    checked: boolean;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer">
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
        onChange={handleInputChange}
        className="hidden"
      />
      <span style={{ fontSize: "16px" }}>{label}</span>
    </label>
  );

  return (
    <section className="bg-[#EEF3F7] min-h-screen">
      {/* Desktop Layout */}
      <div className="hidden lg:block" style={{ padding: "48px 64px" }}>
        <div className="max-w-[1000px] mx-auto">
          <h1 className="font-semibold text-[var(--on-surface-default)] text-center mb-10" style={{ fontSize: "48px" }}>
            Become a trainer
          </h1>

          {/* Single Card containing all sections */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-3xl p-10" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

              {/* Profile Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-8" style={{ fontSize: "30px" }}>
                Profile
              </h2>

               {/* Divider */}
               <div className="w-full h-px bg-[#F0F0F0]" />

              <div className="flex flex-col">
                {/* Photo Upload */}
                <div className="flex items-start py-6">
                  <span className="w-1/2 shrink-0 text-[var(--on-surface-default)] " style={{ fontSize: "16px" }}>Photo</span>
                  <div className="w-1/2 flex items-center gap-4">
                    <div
                      className="w-18 h-18 rounded-full bg-[#EEF3F7] flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {formData.photoPreview ? (
                        <Image src={formData.photoPreview} alt="Profile" width={56} height={56} className="object-cover w-full h-full" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-5 py-2 border border-[#a37f49] rounded-lg text-sm font-medium text-[#a37f49] hover:bg-[#fdf8f3]"
                    >
                      Attach CV
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[#F0F0F0]" />

                {/* Full Name - Two inputs */}
                <div className="flex items-start py-6">
                  <label className="w-1/2 shrink-0 text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                    Full Name <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 flex flex-col gap-3">
                    <input
                      type="text"
                      name="fullNameArabic"
                      value={formData.fullNameArabic}
                      onChange={handleInputChange}
                      required
                      placeholder="Arabic (As appears in the certificates)"
                      className="w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                      style={{ fontSize: "16px" }}
                    />
                    <input
                      type="text"
                      name="fullNameEnglish"
                      value={formData.fullNameEnglish}
                      onChange={handleInputChange}
                      required
                      placeholder="English (As appears in the certificates)"
                      className="w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[#F0F0F0]" />

                {/* Email Address */}
                <div className="flex items-start py-6">
                  <label className="w-1/2 shrink-0 text-[var(--on-surface-default)] " style={{ fontSize: "16px" }}>
                    Email address <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="relative w-1/2">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C8D5E1]" strokeWidth={1.5} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full h-12 pl-12 pr-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

            

                {/* Mobile Number with country code */}
                <div className="flex items-start py-6">
                  <label className="w-1/2 shrink-0 text-[var(--on-surface-default)] " style={{ fontSize: "16px" }}>
                    Mobile Number <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 flex h-12 bg-white border border-[#C8D5E1] rounded-lg overflow-hidden">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === "countryCode" ? null : "countryCode")}
                        className="h-full px-4 flex items-center gap-1 cursor-pointer border-r border-[#C8D5E1] bg-white"
                      >
                        <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                          {formData.countryCode}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCode" ? "rotate-180" : ""}`} />
                      </button>
                      {openDropdown === "countryCode" && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 min-w-[80px]">
                          {["SA", "AE", "EG", "JO"].map((code) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, countryCode: code }));
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-[#EEF3F7] transition-colors"
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
                      className="flex-1 px-4 py-2.5 focus:outline-none"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[#F0F0F0]" />

                <Dropdown label="Gender" field="gender" options={genderOptions} required />
                <Dropdown label="Nationality" field="nationality" options={nationalityOptions} withDivider={false} required showFlag />
                <InputField label="National/Iqama ID" name="nationalIqamaId" required />
                <Dropdown label="Profession" field="profession" options={professionOptions} required withDivider={false}  />
                <Dropdown label="Speciality" field="specialty" options={specialtyOptions} required withDivider={false}  />
                <Dropdown label="Qualification" field="qualification" options={qualificationOptions} required withDivider={false}  />
                <Dropdown label="Rank" field="rank" options={rankOptions} required  withDivider={false} />

                {/* SCFHS Number Question */}
                <div className="flex flex-col items-start py-6">
                  <label className="w-1/2 shrink-0 text-[var(--on-surface-default)] pt-1" style={{ fontSize: "16px" }}>
                    Do you have a classification number from scfhs? <span className="text-[#dc2626]">*</span>
                  </label>
                  <div className="w-1/2 flex gap-8 pt-3">
                    <Checkbox label="Yes" name="hasScfhsNumber" checked={formData.hasScfhsNumber} />
                    <Checkbox label="No" name="noScfhsNumber" checked={formData.noScfhsNumber} />
                  </div>
                </div>
                <div className="w-full h-px bg-[#F0F0F0]" />

                <InputField label="Twitter" name="twitter" withDivider={false}  />
                <InputField label="LinkedIn" name="linkedIn" withDivider={false} />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Resume Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                Resume
              </h2>
              <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px" }}>
                Select how you&apos;d like to submit your Resume: either create one directly within the app or upload an existing Resume file.
              </p>

              {/* Resume Options */}
              <div className="flex gap-8 mb-8">
                <Checkbox label="Upload your resume" name="uploadResume" checked={formData.uploadResume} />
                <Checkbox label="Create your resume" name="createResume" checked={formData.createResume} />
              </div>

              <div className="flex flex-col gap-8">
                <FileUpload label="Education" field="education" />
                <FileUpload label="Professional Skills" field="professionalSkills" />
                <FileUpload label="Scientific Researches" field="scientificResearches" />
                <FileUpload label="Training Experience" field="trainingExperience" />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Cancel/Save for Resume */}
              <div className="flex justify-end gap-3 mb-10">
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[#C8D5E1] hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" className="h-11 px-6 rounded-lg font-medium text-white btn-gold">
                  Save
                </button>
              </div>

              {/* Bank Account Section */}
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-3" style={{ fontSize: "30px" }}>
                Bank Account
              </h2>

              {/* Thin divider under heading */}
              <div className="w-full h-px bg-[#F0F0F0]" />

              <div className="flex flex-col ">
                <InputField label="Account Holder Name" name="accountHolderName" required />
                <Dropdown label="Bank Name" field="bankName" options={bankOptions} withDivider={false} required />
                <InputField label="IBAN" name="iban" required withDivider={false} />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#F0F0F0] my-10" />

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3">
                <button type="button" className="h-11 px-6 rounded-lg font-medium border border-[#C8D5E1] hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="h-11 px-6 rounded-lg font-medium text-white btn-gold">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden px-4 py-6 pb-24">
        <h1 className="font-semibold text-[var(--on-surface-default)] text-center mb-6" style={{ fontSize: "30px" }}>
          Become a trainer
        </h1>

        {/* Single Card containing all sections */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}>

            {/* Profile Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-5" style={{ fontSize: "24px" }}>
              Profile
            </h2>
             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] my-2" />

            <div className="flex flex-col gap-5">
              {/* Photo Upload */}
              <div className="flex flex-col gap-3">
                <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>Photo</span>
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full bg-[#EEF3F7] flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {formData.photoPreview ? (
                      <Image src={formData.photoPreview} alt="Profile" width={56} height={56} className="object-cover w-full h-full" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-5 py-2 border border-[#a37f49] rounded-lg text-sm font-medium text-[#a37f49] hover:bg-[#fdf8f3]"
                  >
                    Attach CV
                  </button>
                </div>
              </div>

                     {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] my-2" />
              {/* Full Name */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  Full Name <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  name="fullNameArabic"
                  value={formData.fullNameArabic}
                  onChange={handleInputChange}
                  required
                  placeholder="Arabic (As appears in the certificates)"
                  className="w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                  style={{ fontSize: "16px" }}
                />
                <input
                  type="text"
                  name="fullNameEnglish"
                  value={formData.fullNameEnglish}
                  onChange={handleInputChange}
                  required
                  placeholder="English (As appears in the certificates)"
                  className="w-full h-12 px-4 py-2.5 bg-white border border-[#C8D5E1] rounded-lg focus:outline-none focus:border-[var(--outline-focused)]"
                  style={{ fontSize: "16px" }}
                />
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] my-1" />

              <InputField label="Email address" name="email" type="email" required icon={<Mail className="w-5 h-5" strokeWidth={1.5} />} withDivider={false}/>

              {/* Mobile Number */}
              <div className="flex flex-col gap-2">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  Mobile Number <span className="text-[#dc2626]">*</span>
                </label>
                <div className="flex h-12 bg-white border border-[#C8D5E1] rounded-lg overflow-hidden">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "countryCodeMobile" ? null : "countryCodeMobile")}
                      className="h-full px-4 flex items-center gap-1 cursor-pointer border-r border-[#C8D5E1]"
                    >
                      <span className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                        {formData.countryCode}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[var(--on-surface-variant)] transition-transform ${openDropdown === "countryCodeMobile" ? "rotate-180" : ""}`} />
                    </button>
                    {openDropdown === "countryCodeMobile" && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-20 min-w-[80px]">
                        {["SA", "AE", "EG", "JO"].map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, countryCode: code }));
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-[#EEF3F7] transition-colors"
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
                    className="flex-1 px-4 py-2.5 focus:outline-none"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

               {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] " />

              <Dropdown label="Gender" field="gender" options={genderOptions} required />
              <Dropdown label="Nationality" field="nationality" options={nationalityOptions} required showFlag withDivider={false} />
              <InputField label="National/Iqama ID" name="nationalIqamaId" required withDivider={false}/>
              <Dropdown label="Profession" field="profession" options={professionOptions} required withDivider={false}/>
              <Dropdown label="Speciality" field="specialty" options={specialtyOptions} required withDivider={false} />
              <Dropdown label="Qualification" field="qualification" options={qualificationOptions} required withDivider={false} />
              <Dropdown label="Rank" field="rank" options={rankOptions} required  withDivider={false}/>

              {/* SCFHS Number Question */}
              <div className="flex flex-col gap-3">
                <label className="text-[var(--on-surface-default)]" style={{ fontSize: "16px" }}>
                  Do you have a classification number from scfhs? <span className="text-[#dc2626]">*</span>
                </label>
                <div className="flex gap-6">
                  <Checkbox label="Yes" name="hasScfhsNumber" checked={formData.hasScfhsNumber} />
                  <Checkbox label="No" name="noScfhsNumber" checked={formData.noScfhsNumber} />
                </div>
              </div>
               {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] " />

              <InputField label="Twitter" name="twitter" withDivider={false} />
              <InputField label="LinkedIn" name="linkedIn" withDivider={false} />
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#F0F0F0] my-8" />

            {/* Resume Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "24px" }}>
              Resume
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-5" style={{ fontSize: "14px" }}>
              Select how you&apos;d like to submit your Resume: either create one directly within the app or upload an existing Resume file.
            </p>

            {/* Resume Options */}
            <div className="flex flex-col gap-6 mb-5">
              <Checkbox label="Upload your resume" name="uploadResume" checked={formData.uploadResume} />
              <Checkbox label="Create your resume" name="createResume" checked={formData.createResume} />
            </div>

            <div className="flex flex-col gap-5">
              <FileUpload label="Education" field="education" />
              <FileUpload label="Professional Skills" field="professionalSkills" />
              <FileUpload label="Scientific Researches" field="scientificResearches" />
              <FileUpload label="Training Experience" field="trainingExperience" />
            </div>

             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] my-8" />

            {/* Cancel/Save Buttons for Resume */}
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[#C8D5E1] hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" className="flex-1 h-12 rounded-xl font-medium text-white btn-gold">
                Save
              </button>
            </div>

           

            {/* Bank Account Section */}
            <h2 className="font-semibold text-[var(--on-surface-default)] my-6 pt-6" style={{ fontSize: "24px" }}>
              Bank Account
            </h2>

             {/* Divider */}
             <div className="w-full h-px bg-[#F0F0F0] " />

            <div className="flex flex-col ">
              <InputField label="Account Holder Name" name="accountHolderName" required />
              <Dropdown label="Bank Name" field="bankName" options={bankOptions} required withDivider={false} />
              <InputField label="IBAN" name="iban" required />
            </div>

            {/* Cancel/Save Buttons for Bank Account */}
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 h-12 rounded-xl font-medium border border-[#C8D5E1] hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="flex-1 h-12 rounded-xl font-medium text-white btn-gold">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default BecomeTrainerForm;
