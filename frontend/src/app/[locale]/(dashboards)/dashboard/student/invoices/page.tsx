import { setRequestLocale } from "next-intl/server";
import { InvoicesContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Invoices | Student Dashboard | PhysioGuidance",
  description: "View and manage your invoices",
};

export default async function StudentInvoicesPage({
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
