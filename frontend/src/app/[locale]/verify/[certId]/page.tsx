import { setRequestLocale } from "next-intl/server";
import CertificateVerifyContent from "@/components/student-dashboard/CertificateVerifyContent";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string; certId: string }>;
}) {
  const { locale, certId } = await params;
  setRequestLocale(locale);

  return <CertificateVerifyContent certId={certId} />;
}
