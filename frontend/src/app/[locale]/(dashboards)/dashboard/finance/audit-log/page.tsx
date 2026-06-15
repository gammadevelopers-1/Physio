import { setRequestLocale } from "next-intl/server";
import { AuditLogContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Audit Log | Finance Dashboard | PhysioGuidance",
  description:
    "Immutable audit trail of all financial events — NELC compliant",
};

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <AuditLogContent />
    </main>
  );
}
