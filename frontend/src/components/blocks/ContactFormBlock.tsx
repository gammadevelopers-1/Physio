"use client";

import type { ContactFormBlockData, ContactPage, SideLoadedData } from "@/lib/strapi/types";
import ContactForm from "@/components/ContactForm";

interface ContactFormBlockProps {
  data: ContactFormBlockData;
  sideLoadedData: SideLoadedData;
}

export function ContactFormBlock({ data }: ContactFormBlockProps) {
  // Map block data to ContactPage-shaped object for the existing ContactForm component
  const strapiData: Partial<ContactPage> = {
    title: data.title,
    subtitle: data.subtitle,
    formFullNameLabel: data.formFullNameLabel,
    formEmailLabel: data.formEmailLabel,
    formIssueTypeLabel: data.formIssueTypeLabel,
    formSelectOptionLabel: data.formSelectOptionLabel,
    formPhoneLabel: data.formPhoneLabel,
    formSubjectLabel: data.formSubjectLabel,
    formDescriptionLabel: data.formDescriptionLabel,
    formCharactersLeftLabel: data.formCharactersLeftLabel,
    formSubmitLabel: data.formSubmitLabel,
    issueTypeTechnicalSupport: data.issueTypeTechnicalSupport,
    issueTypeBillingIssue: data.issueTypeBillingIssue,
    issueTypeCourseInquiry: data.issueTypeCourseInquiry,
    issueTypePartnership: data.issueTypePartnership,
    issueTypeOther: data.issueTypeOther,
    generalInquiryLabel: data.generalInquiryLabel,
    generalInquiryEmail: data.generalInquiryEmail,
    technicalSupportLabel: data.technicalSupportLabel,
    technicalSupportPhone: data.technicalSupportPhone,
    address: data.address,
    getDirectionsLabel: data.getDirectionsLabel,
    loadingMapText: data.loadingMapText,
    mapLatitude: data.mapLatitude,
    mapLongitude: data.mapLongitude,
    mapPopupText: data.mapPopupText,
  };

  return <ContactForm strapiData={strapiData as any} />;
}
