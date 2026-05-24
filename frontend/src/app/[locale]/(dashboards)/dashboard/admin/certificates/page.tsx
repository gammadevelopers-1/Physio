import { setRequestLocale } from "next-intl/server";
import { CertificatesContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Certificates | Admin Dashboard | PhysioGuidance",
  description: "Platform-wide certificate management — approve, reject, revoke",
};

export default async function AdminCertificatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CertificatesContent role="admin" />
    </main>
  );
}
