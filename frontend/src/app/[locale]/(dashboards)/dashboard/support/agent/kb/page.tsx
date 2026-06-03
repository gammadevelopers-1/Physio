import KnowledgeBaseContent from "@/components/support-dashboard/KnowledgeBaseContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Knowledge Base | Agent Dashboard" };

export default async function AgentKBPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KnowledgeBaseContent />;
}
