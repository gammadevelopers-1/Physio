import { setRequestLocale } from "next-intl/server";
import CancelDeletionContent from "./CancelDeletionContent";

export const metadata = {
  title: "Cancel account deletion | PhysioGuidance",
  description: "Restore your account after cancellation",
};

export default async function CancelDeletionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center px-4 py-12"
    >
      <CancelDeletionContent />
    </main>
  );
}
