import Navbar from "@/components/Navbar";
import BecomeTrainerForm from "@/components/BecomeTrainerForm";
import Footer from "@/components/Footer";
import { setRequestLocale } from "next-intl/server";
import { getBecomeTrainerPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

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

  const blocks = data?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
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
        nationalityOptions={data?.nationalityOptions ?? null}
        professionOptions={data?.professionOptions ?? null}
        specialtyOptions={data?.specialtyOptions ?? null}
        qualificationOptions={data?.qualificationOptions ?? null}
        rankOptions={data?.rankOptions ?? null}
        bankOptions={data?.bankOptions ?? null}
      />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
