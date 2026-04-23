import { setRequestLocale } from "next-intl/server";
import { RolesContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Roles & Permissions | Admin Dashboard | PhysioGuidance",
  description: "Manage roles and permission settings",
};

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <RolesContent />
    </main>
  );
}
