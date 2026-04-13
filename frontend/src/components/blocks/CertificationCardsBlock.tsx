"use client";

import type {
  CertificationCardsBlockData,
  CertificationsPage,
  SideLoadedData,
} from "@/lib/strapi/types";
import CertificationsContent from "@/components/CertificationsContent";

interface CertificationCardsBlockProps {
  data: CertificationCardsBlockData;
  sideLoadedData: SideLoadedData;
}

export function CertificationCardsBlock({ data }: CertificationCardsBlockProps) {
  // Map block data to CertificationsPage-shaped object for the existing component
  const strapiData: Partial<CertificationsPage> = {
    breadcrumb: data.breadcrumb,
    heroTitle: data.heroTitle,
    heroDescription: data.heroDescription,
    heroButtonLabel: data.heroButtonLabel,
    nelcTitle: data.nelcTitle,
    nelcDescription: data.nelcDescription,
    nelcLicenseLabel: data.nelcLicenseLabel,
    nelcLicenseNumber: data.nelcLicenseNumber,
    scfhsTitle: data.scfhsTitle,
    scfhsDescription: data.scfhsDescription,
    scfhsAccreditationLabel: data.scfhsAccreditationLabel,
    scfhsAccreditationNumber: data.scfhsAccreditationNumber,
    verificationTitle: data.verificationTitle,
    verificationSubtitle: data.verificationSubtitle,
    verificationPlaceholder: data.verificationPlaceholder,
    verificationButtonLabel: data.verificationButtonLabel,
    claimCMETitle: data.claimCMETitle,
    step1Title: data.step1Title,
    step1Description: data.step1Description,
    step2Title: data.step2Title,
    step2Description: data.step2Description,
    step3Title: data.step3Title,
    step3Description: data.step3Description,
    nelcLogo: data.nelcLogo,
    scfhsLogo: data.scfhsLogo,
    certificateImage: data.certificateImage,
  };

  return <CertificationsContent strapiData={strapiData as any} />;
}
