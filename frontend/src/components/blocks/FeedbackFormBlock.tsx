"use client";

import type { FeedbackFormBlockData, FeedbackPage, SideLoadedData } from "@/lib/strapi/types";
import FeedbackForm from "@/components/FeedbackForm";

interface FeedbackFormBlockProps {
  data: FeedbackFormBlockData;
  sideLoadedData: SideLoadedData;
}

export function FeedbackFormBlock({ data }: FeedbackFormBlockProps) {
  // Map block data to FeedbackPage-shaped object for the existing FeedbackForm component
  const strapiData: Partial<FeedbackPage> = {
    title: data.title,
    description: data.description,
    formFullNameLabel: data.formFullNameLabel,
    formEmailLabel: data.formEmailLabel,
    formSubjectLabel: data.formSubjectLabel,
    formDescriptionLabel: data.formDescriptionLabel,
    formCharactersLeftPrefix: data.formCharactersLeftPrefix,
    formCharactersLeftSuffix: data.formCharactersLeftSuffix,
    formSubmitLabel: data.formSubmitLabel,
  };

  return <FeedbackForm strapiData={strapiData as any} />;
}
