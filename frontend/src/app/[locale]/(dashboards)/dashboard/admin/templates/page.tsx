import { setRequestLocale } from "next-intl/server";
import TemplatesContent from "@/components/admin-dashboard/templates/TemplatesContent";

export const metadata = {
  title: "Templates | Admin Dashboard | PhysioGuidance",
  description: "Edit transactional email and WhatsApp templates",
};

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TemplatesContent />
    </main>
  );
}
