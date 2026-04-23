import { setRequestLocale } from "next-intl/server";
import RoleRequestReviewContent from "@/components/admin-dashboard/RoleRequestReviewContent";

export const metadata = {
  title: "Review Application | Admin Dashboard | PhysioGuidance",
  description: "Review instructor role application details",
};

export default async function RoleRequestReviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <RoleRequestReviewContent applicationId={id} />
    </main>
  );
}
