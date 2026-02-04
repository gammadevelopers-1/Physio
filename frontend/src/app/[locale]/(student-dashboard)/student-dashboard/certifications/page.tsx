import { setRequestLocale } from "next-intl/server";
import { CertificationsContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Certifications | Student Dashboard | PhysioGuidance",
  description: "View and download your certifications",
};

export default async function StudentCertificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CertificationsContent />;
}
