import { setRequestLocale } from "next-intl/server";
import TemplateEditorContent from "@/components/admin-dashboard/templates/TemplateEditorContent";

export const metadata = {
  title: "Edit Template | Admin Dashboard | PhysioGuidance",
};

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ locale: string; eventKey: string; templateLocale: string }>;
}) {
  const { locale, eventKey, templateLocale } = await params;
  setRequestLocale(locale);

  const safeLocale: "en" | "ar" = templateLocale === "ar" ? "ar" : "en";

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TemplateEditorContent eventKey={eventKey} templateLocale={safeLocale} />
    </main>
  );
}
