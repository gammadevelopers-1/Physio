import { setRequestLocale } from "next-intl/server";
import { UsersContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Users Management | Admin Dashboard | PhysioGuidance",
  description: "Manage platform users, roles, and permissions",
};

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <UsersContent />
    </main>
  );
}
