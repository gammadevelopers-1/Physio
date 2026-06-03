import KnowledgeBaseContent from "@/components/support-dashboard/KnowledgeBaseContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Knowledge Base | Supervisor Dashboard" };

export default async function SupervisorKBPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KnowledgeBaseContent />;
}
