import { setRequestLocale } from "next-intl/server";
import { ComplianceContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "NELC Compliance | Admin Dashboard | PhysioGuidance",
  description: "NELC compliance management and audit tracking",
};

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <ComplianceContent />
    </main>
  );
}
