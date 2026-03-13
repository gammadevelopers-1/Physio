import { setRequestLocale } from "next-intl/server";
import TACourseDetailContent from "@/components/ta-dashboard/TACourseDetailContent";

export const metadata = {
  title: "Course Detail | Teaching Assistant Dashboard",
  description: "View course details",
};

export default async function TACourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  return <TACourseDetailContent courseId={courseId} />;
}
