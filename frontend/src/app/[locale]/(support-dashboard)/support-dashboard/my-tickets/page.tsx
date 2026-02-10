import { setRequestLocale } from "next-intl/server";
import { MyTicketsContent } from "@/components/support-dashboard";

export const metadata = {
  title: "My Tickets | Support Dashboard | PhysioGuidance",
  description: "Your assigned tickets and personal queue",
};

export default async function MyTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <MyTicketsContent />
    </main>
  );
}
