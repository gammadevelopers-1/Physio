"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface NewsletterBlockData {
  __component: "blocks.newsletter-block";
  id: number;
  title: string;
  description?: string;
  emailPlaceholder?: string;
  submitLabel?: string;
  successMessage?: string;
  privacyNote?: string;
  backgroundColor?: string;
  visibility?: string;
  position?: string;
}

interface NewsletterBlockProps {
  data: NewsletterBlockData;
  sideLoadedData: SideLoadedData;
}

export function NewsletterBlock({ data }: NewsletterBlockProps) {
  return (
    <section
      className="px-4 lg:px-16 py-12 lg:py-20"
      style={{ backgroundColor: data.backgroundColor || "#f8f9fa" }}
    >
      <div className="max-w-[600px] mx-auto flex flex-col gap-6 items-center text-center">
        <h2
          className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
          style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
        >
          {data.title}
        </h2>
        {data.description && (
          <p
            className="text-[var(--on-surface-default)] leading-7"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {data.description}
          </p>
        )}
        <div className="flex w-full max-w-[440px] gap-2">
          <input
            type="email"
            placeholder={data.emailPlaceholder || "Enter your email"}
            className="flex-1 px-4 py-3 rounded-full border border-[var(--outline-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--surface-container-primary)]"
            readOnly
          />
          <button
            type="button"
            className="px-6 py-3 rounded-full bg-[var(--surface-container-primary)] text-white text-sm font-medium"
          >
            {data.submitLabel || "Subscribe"}
          </button>
        </div>
        {data.privacyNote && (
          <p className="text-xs text-[var(--on-surface-variant)]">
            {data.privacyNote}
          </p>
        )}
      </div>
    </section>
  );
}
