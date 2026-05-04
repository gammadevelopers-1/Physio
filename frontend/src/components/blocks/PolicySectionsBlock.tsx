"use client";

import type { PolicySectionsBlockData, SideLoadedData } from "@/lib/strapi/types";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { useLocale } from "next-intl";

interface PolicySectionsBlockProps {
  data: PolicySectionsBlockData;
  sideLoadedData: SideLoadedData;
}

export function PolicySectionsBlock({ data }: PolicySectionsBlockProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  if (
    (!data.sections || data.sections.length === 0) &&
    !data.title?.trim()
  ) {
    return null;
  }

  const emptyMessage = isRTL
    ? "جاري تحديث هذه السياسة — يرجى المراجعة لاحقاً"
    : "This policy is being updated — please check back soon";

  return (
    <PolicyPageLayout
      title={data.title}
      lastUpdated={data.lastUpdated ?? ""}
      sections={data.sections.map((s) => ({
        sectionId: s.sectionId,
        sidebarLabel: s.sidebarLabel,
        title: s.title,
        content: s.content,
      }))}
      isRTL={isRTL}
      emptyMessage={emptyMessage}
    />
  );
}
