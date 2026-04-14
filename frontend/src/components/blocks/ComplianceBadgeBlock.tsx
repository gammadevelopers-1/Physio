"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface ComplianceBadgeItem {
  id: number;
  name: string;
  description?: string;
  badgeImage?: StrapiMedia;
  verificationUrl?: string;
  status?: "active" | "pending" | "expired";
}

interface ComplianceBadgeBlockData {
  __component: "blocks.compliance-badge-block";
  id: number;
  title?: string;
  description?: string;
  badges?: ComplianceBadgeItem[];
  variant?: "row" | "grid" | "detailed";
  visibility?: string;
  position?: string;
}

interface ComplianceBadgeBlockProps {
  data: ComplianceBadgeBlockData;
  sideLoadedData: SideLoadedData;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
};

export function ComplianceBadgeBlock({ data }: ComplianceBadgeBlockProps) {
  const variant = data.variant || "row";

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        <div
          className={
            variant === "row"
              ? "flex flex-wrap items-center justify-center gap-8"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
          }
        >
          {data.badges?.map((badge) => (
            <div
              key={badge.id}
              className={`flex ${variant === "detailed" ? "flex-col p-6 bg-white rounded-2xl border border-[var(--outline-subtle)] shadow-sm" : "flex-col items-center"} gap-3`}
            >
              {badge.badgeImage && (
                <img
                  src={getStrapiMediaUrl(badge.badgeImage.url)}
                  alt={badge.badgeImage.alternativeText || badge.name}
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className={variant === "detailed" ? "" : "text-center"}>
                <h3 className="font-semibold text-sm text-[var(--on-surface-default)]">
                  {badge.name}
                </h3>
                {variant === "detailed" && badge.description && (
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {badge.description}
                  </p>
                )}
                {badge.status && (
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[badge.status] || ""}`}
                  >
                    {badge.status}
                  </span>
                )}
              </div>
              {variant === "detailed" && badge.verificationUrl && (
                <a
                  href={badge.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--surface-container-primary)] hover:underline mt-1"
                >
                  Verify
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
