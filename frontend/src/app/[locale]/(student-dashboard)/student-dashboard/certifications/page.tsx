import { setRequestLocale } from "next-intl/server";

export const metadata = {
  title: "Certifications | Student Dashboard | PhysioGuidance",
  description: "View and download your certifications",
};

export default async function StudentCertificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      {/* Student Certifications - Content will be implemented from Figma designs */}
      <div className="p-8">
        <h1 className="text-2xl font-bold">Certifications</h1>
        <p className="text-gray-600 mt-2">View and download your certifications</p>
      </div>
    </main>
  );
}
