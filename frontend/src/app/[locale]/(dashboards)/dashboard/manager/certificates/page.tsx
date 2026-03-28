import { setRequestLocale } from "next-intl/server";
import { CertificatesContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Certificates | Course Manager Dashboard | PhysioGuidance",
  description: "Review and approve student certificates for your courses",
};

export default async function ManagerCertificatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <CertificatesContent />
    </main>
  );
}
