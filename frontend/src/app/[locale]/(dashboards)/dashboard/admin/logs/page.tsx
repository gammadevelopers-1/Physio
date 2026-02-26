import { setRequestLocale } from "next-intl/server";
import { LogsContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Audit Logs | Admin Dashboard | PhysioGuidance",
  description: "View platform audit logs and activity history",
};

export default async function LogsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <LogsContent />
    </main>
  );
}
