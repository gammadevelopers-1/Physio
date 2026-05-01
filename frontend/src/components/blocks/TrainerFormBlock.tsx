"use client";

import type { TrainerFormBlockData, SideLoadedData } from "@/lib/strapi/types";
import BecomeTrainerForm from "@/components/BecomeTrainerForm";

interface TrainerFormBlockProps {
  data: TrainerFormBlockData;
  sideLoadedData: SideLoadedData;
}

export function TrainerFormBlock({ data }: TrainerFormBlockProps) {
  // BecomeTrainerForm accepts individual props matching the TrainerFormBlockData fields directly
  return (
    <BecomeTrainerForm
      pageTitle={data.pageTitle}
      profileSectionTitle={data.profileSectionTitle}
      profilePhotoLabel={data.profilePhotoLabel}
      profileAttachCVLabel={data.profileAttachCVLabel}
      profileFullNameLabel={data.profileFullNameLabel}
      profileFullNameArabicPlaceholder={data.profileFullNameArabicPlaceholder}
      profileFullNameEnglishPlaceholder={data.profileFullNameEnglishPlaceholder}
      profileEmailLabel={data.profileEmailLabel}
      profileMobileLabel={data.profileMobileLabel}
      profileGenderLabel={data.profileGenderLabel}
      profileNationalityLabel={data.profileNationalityLabel}
      profileNationalIdLabel={data.profileNationalIdLabel}
      profileProfessionLabel={data.profileProfessionLabel}
      profileSpecialityLabel={data.profileSpecialityLabel}
      profileQualificationLabel={data.profileQualificationLabel}
      profileRankLabel={data.profileRankLabel}
      profileScfhsQuestion={data.profileScfhsQuestion}
      profileTwitterLabel={data.profileTwitterLabel}
      profileLinkedInLabel={data.profileLinkedInLabel}
      resumeSectionTitle={data.resumeSectionTitle}
      resumeDescription={data.resumeDescription}
      resumeUploadLabel={data.resumeUploadLabel}
      resumeCreateLabel={data.resumeCreateLabel}
      resumeEducationLabel={data.resumeEducationLabel}
      resumeProfessionalSkillsLabel={data.resumeProfessionalSkillsLabel}
      resumeScientificResearchesLabel={data.resumeScientificResearchesLabel}
      resumeTrainingExperienceLabel={data.resumeTrainingExperienceLabel}
      resumeClickToUploadLabel={data.resumeClickToUploadLabel}
      resumeOrDragDropLabel={data.resumeOrDragDropLabel}
      resumePdfMaxSizeLabel={data.resumePdfMaxSizeLabel}
      bankAccountSectionTitle={data.bankAccountSectionTitle}
      bankAccountHolderLabel={data.bankAccountHolderLabel}
      bankNameLabel={data.bankNameLabel}
      bankIbanLabel={data.bankIbanLabel}
      cancelButtonLabel={data.cancelButtonLabel}
      saveButtonLabel={data.saveButtonLabel}
      yesButtonLabel={data.yesButtonLabel}
      noButtonLabel={data.noButtonLabel}
      // Visibility flags — undefined / null treated as "show" (defaults true)
      showProfileSection={data.showProfileSection !== false}
      showResumeSection={data.showResumeSection !== false}
      showBankSection={data.showBankSection !== false}
      showFullNameArabic={data.showFullNameArabic !== false}
      showFullNameEnglish={data.showFullNameEnglish !== false}
      showEmail={data.showEmail !== false}
      showMobileNumber={data.showMobileNumber !== false}
      showGender={data.showGender !== false}
      showNationality={data.showNationality !== false}
      showNationalIqamaId={data.showNationalIqamaId !== false}
      showProfession={data.showProfession !== false}
      showSpecialty={data.showSpecialty !== false}
      showQualification={data.showQualification !== false}
      showAcademicRank={data.showAcademicRank !== false}
      showScfhsToggle={data.showScfhsToggle !== false}
      showTwitter={data.showTwitter !== false}
      showLinkedIn={data.showLinkedIn !== false}
      showPhoto={data.showPhoto !== false}
      // Dropdown overrides — empty arrays use defaults
      nationalityOptions={data.nationalityOptions ?? null}
      professionOptions={data.professionOptions ?? null}
      specialtyOptions={data.specialtyOptions ?? null}
      qualificationOptions={data.qualificationOptions ?? null}
      rankOptions={data.rankOptions ?? null}
      bankOptions={data.bankOptions ?? null}
    />
  );
}
