import { setRequestLocale } from "next-intl/server";
import { InvoicesContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Invoices | Finance Dashboard | PhysioGuidance",
  description: "Create, manage, and track all invoices",
};

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <InvoicesContent />
    </main>
  );
}
