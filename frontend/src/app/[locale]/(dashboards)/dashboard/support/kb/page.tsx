import { setRequestLocale } from "next-intl/server";
import { KnowledgeBaseContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Knowledge Base | Support Dashboard | PhysioGuidance",
  description: "Internal and public knowledge base management",
};

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <KnowledgeBaseContent />
    </main>
  );
}
