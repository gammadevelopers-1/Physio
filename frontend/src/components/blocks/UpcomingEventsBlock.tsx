"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { FmtDate } from "@/components/ui/Fmt";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface EventItem {
  id: number;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  location?: string;
  registrationUrl?: string;
  image?: StrapiMedia;
}

interface UpcomingEventsBlockData {
  __component: "blocks.upcoming-events-block";
  id: number;
  title?: string;
  description?: string;
  events?: EventItem[];
  viewAllLabel?: string;
  viewAllUrl?: string;
  emptyMessage?: string;
  variant?: "list" | "grid" | "calendar";
  visibility?: string;
  position?: string;
}

interface UpcomingEventsBlockProps {
  data: UpcomingEventsBlockData;
  sideLoadedData: SideLoadedData;
}

export function UpcomingEventsBlock({ data }: UpcomingEventsBlockProps) {
  if (
    (!data.events || data.events.length === 0) &&
    !data.title?.trim() &&
    !data.description?.trim()
  ) {
    return null;
  }

  const variant = data.variant || "list";
  const events = data.events || [];

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

        {events.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {data.emptyMessage || "No upcoming events."}
          </p>
        ) : variant === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm overflow-hidden"
              >
                {evt.image && (
                  <div className="w-full h-40 overflow-hidden">
                    <img
                      src={getStrapiMediaUrl(evt.image.url)}
                      alt={evt.image.alternativeText || evt.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-col gap-2">
                  <span className="text-xs text-[var(--surface-container-primary)] font-medium">
                    <FmtDate value={evt.date} variant="readable" includeTime />
                  </span>
                  <h3
                    className="font-semibold text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
                  >
                    {evt.title}
                  </h3>
                  {evt.description && (
                    <p className="text-sm text-[var(--on-surface-variant)] line-clamp-2">
                      {evt.description}
                    </p>
                  )}
                  {evt.location && (
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {evt.location}
                    </span>
                  )}
                  {evt.registrationUrl && (
                    <a
                      href={evt.registrationUrl}
                      className="mt-2 text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
                    >
                      Register
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full max-w-[768px]">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="flex gap-4 p-4 bg-[var(--color-surface-card)] rounded-xl border border-[var(--outline-subtle)] shadow-sm"
              >
                {evt.image && (
                  <img
                    src={getStrapiMediaUrl(evt.image.url)}
                    alt={evt.image.alternativeText || evt.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-xs text-[var(--surface-container-primary)] font-medium">
                    <FmtDate value={evt.date} variant="readable" includeTime />
                  </span>
                  <h3 className="font-semibold text-sm text-[var(--on-surface-default)]">
                    {evt.title}
                  </h3>
                  {evt.description && (
                    <p className="text-xs text-[var(--on-surface-variant)] line-clamp-2">
                      {evt.description}
                    </p>
                  )}
                  {evt.location && (
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {evt.location}
                    </span>
                  )}
                </div>
                {evt.registrationUrl && (
                  <a
                    href={evt.registrationUrl}
                    className="self-center text-sm font-medium text-[var(--surface-container-primary)] hover:underline flex-shrink-0"
                  >
                    Register
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {data.viewAllUrl && (
          <a
            href={data.viewAllUrl}
            className="text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
          >
            {data.viewAllLabel || "View all events"}
          </a>
        )}
      </div>
    </section>
  );
}
