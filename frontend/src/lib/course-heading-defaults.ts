import { getCourseDetailPage } from "@/lib/strapi";
import type { SectionHeadingKey } from "@/lib/api";

export type HeadingDefaults = {
  en?: Partial<Record<SectionHeadingKey, string>>;
  ar?: Partial<Record<SectionHeadingKey, string>>;
};

/** Static fallbacks for sections that Strapi doesn't currently cover.
 *  Kept here so the public renderer and the manager form agree.        */
export const HARDCODED_HEADING_FALLBACKS: Record<
  SectionHeadingKey,
  { en: string; ar: string }
> = {
  overview: { en: "Overview", ar: "نبذة تعريفية" },
  objectives: { en: "Objectives", ar: "الأهداف" },
  features: { en: "Features", ar: "المميزات" },
  contents: { en: "Contents", ar: "المحتوى" },
  schedule: { en: "Schedule", ar: "الجدول" },
  requirements: { en: "Requirements", ar: "المتطلبات" },
  notices: { en: "Notices", ar: "ملاحظات" },
  reviews: { en: "Reviews", ar: "المراجعات" },
  targetAudience: { en: "Target Audience", ar: "الفئة المستهدفة" },
  courseDetails: { en: "Course Details", ar: "تفاصيل الدورة" },
  faqs: { en: "FAQs", ar: "الأسئلة الشائعة" },
};

function extract(
  page: Awaited<ReturnType<typeof getCourseDetailPage>>,
  fallbackLang: "en" | "ar",
): Partial<Record<SectionHeadingKey, string>> {
  return {
    overview: page?.overviewHeading || HARDCODED_HEADING_FALLBACKS.overview[fallbackLang],
    objectives: page?.objectivesHeading || HARDCODED_HEADING_FALLBACKS.objectives[fallbackLang],
    features: page?.featuresHeading || HARDCODED_HEADING_FALLBACKS.features[fallbackLang],
    contents: page?.contentsHeading || HARDCODED_HEADING_FALLBACKS.contents[fallbackLang],
    schedule: page?.scheduleHeading || HARDCODED_HEADING_FALLBACKS.schedule[fallbackLang],
    requirements: page?.requirementsHeading || HARDCODED_HEADING_FALLBACKS.requirements[fallbackLang],
    notices: page?.noticesHeading || HARDCODED_HEADING_FALLBACKS.notices[fallbackLang],
    reviews: page?.reviewsHeading || HARDCODED_HEADING_FALLBACKS.reviews[fallbackLang],
    targetAudience: page?.targetAudienceHeading || HARDCODED_HEADING_FALLBACKS.targetAudience[fallbackLang],
    courseDetails: page?.courseDetailsHeading || HARDCODED_HEADING_FALLBACKS.courseDetails[fallbackLang],
    faqs: HARDCODED_HEADING_FALLBACKS.faqs[fallbackLang],
  };
}

/** Fetch both locales' Strapi defaults so the course-editor form can show
 *  them as placeholders side by side. Called from server components. */
export async function fetchHeadingDefaults(): Promise<HeadingDefaults> {
  const [en, ar] = await Promise.all([
    getCourseDetailPage("en"),
    getCourseDetailPage("ar"),
  ]);
  return {
    en: extract(en, "en"),
    ar: extract(ar, "ar"),
  };
}
