import Navbar from "@/components/Navbar";
import BecomeTrainerForm from "@/components/BecomeTrainerForm";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { setRequestLocale } from "next-intl/server";
import { getBecomeTrainerPageData } from "@/lib/strapi";

export default async function BecomeTrainerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    becomeTrainerPage: data,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBecomeTrainerPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#EEF3F7]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BecomeTrainerForm
        pageTitle={data?.pageTitle}
        profileSectionTitle={data?.profileSectionTitle}
        profilePhotoLabel={data?.profilePhotoLabel}
        profileAttachCVLabel={data?.profileAttachCVLabel}
        profileFullNameLabel={data?.profileFullNameLabel}
        profileFullNameArabicPlaceholder={data?.profileFullNameArabicPlaceholder}
        profileFullNameEnglishPlaceholder={data?.profileFullNameEnglishPlaceholder}
        profileEmailLabel={data?.profileEmailLabel}
        profileMobileLabel={data?.profileMobileLabel}
        profileGenderLabel={data?.profileGenderLabel}
        profileNationalityLabel={data?.profileNationalityLabel}
        profileNationalIdLabel={data?.profileNationalIdLabel}
        profileProfessionLabel={data?.profileProfessionLabel}
        profileSpecialityLabel={data?.profileSpecialityLabel}
        profileQualificationLabel={data?.profileQualificationLabel}
        profileRankLabel={data?.profileRankLabel}
        profileScfhsQuestion={data?.profileScfhsQuestion}
        profileTwitterLabel={data?.profileTwitterLabel}
        profileLinkedInLabel={data?.profileLinkedInLabel}
        resumeSectionTitle={data?.resumeSectionTitle}
        resumeDescription={data?.resumeDescription}
        resumeUploadLabel={data?.resumeUploadLabel}
        resumeCreateLabel={data?.resumeCreateLabel}
        resumeEducationLabel={data?.resumeEducationLabel}
        resumeProfessionalSkillsLabel={data?.resumeProfessionalSkillsLabel}
        resumeScientificResearchesLabel={data?.resumeScientificResearchesLabel}
        resumeTrainingExperienceLabel={data?.resumeTrainingExperienceLabel}
        resumeClickToUploadLabel={data?.resumeClickToUploadLabel}
        resumeOrDragDropLabel={data?.resumeOrDragDropLabel}
        resumePdfMaxSizeLabel={data?.resumePdfMaxSizeLabel}
        bankAccountSectionTitle={data?.bankAccountSectionTitle}
        bankAccountHolderLabel={data?.bankAccountHolderLabel}
        bankNameLabel={data?.bankNameLabel}
        bankIbanLabel={data?.bankIbanLabel}
        cancelButtonLabel={data?.cancelButtonLabel}
        saveButtonLabel={data?.saveButtonLabel}
        yesButtonLabel={data?.yesButtonLabel}
        noButtonLabel={data?.noButtonLabel}
      />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
    </main>
  );
}
