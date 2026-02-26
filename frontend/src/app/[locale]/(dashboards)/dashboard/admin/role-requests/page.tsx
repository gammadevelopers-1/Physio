import { setRequestLocale } from "next-intl/server";
import { RoleRequestsContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Role Requests | Admin Dashboard | PhysioGuidance",
  description: "Review and manage instructor role applications",
};

export default async function RoleRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <RoleRequestsContent />
    </main>
  );
}
