import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

// Phase 2 — guest tracking is retired. Old tokenized URLs redirect
// to the marketing /support page which now points to sign-in. We
// keep this route returning a 308 so any links printed in older
// emails or shared by users don't 404.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TrackTicketPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/support`);
}
