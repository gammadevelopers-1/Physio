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
    steps: data.steps,
    nelcLogo: data.nelcLogo,
    scfhsLogo: data.scfhsLogo,
    certificateImage: data.certificateImage,
  };

  return <CertificationsContent strapiData={strapiData as any} />;
}
