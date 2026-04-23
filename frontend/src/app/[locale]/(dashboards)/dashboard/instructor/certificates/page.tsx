import { setRequestLocale } from "next-intl/server";
import { CertificatesContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Certificates | Instructor Dashboard | PhysioGuidance",
  description: "Review and approve student certificates",
};

export default async function InstructorCertificatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CertificatesContent />
    </main>
  );
}
