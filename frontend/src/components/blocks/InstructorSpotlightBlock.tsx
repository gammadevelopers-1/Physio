"use client";

import ReactMarkdown from "react-markdown";
import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface InstructorSpotlightBlockData {
  __component: "blocks.instructor-spotlight-block";
  id: number;
  title?: string;
  instructorName: string;
  instructorRole?: string;
  bio?: string;
  credentials?: string;
  photo?: StrapiMedia;
  socialLinks?: string;
  variant?: "side-by-side" | "centered";
  visibility?: string;
  position?: string;
}

interface InstructorSpotlightBlockProps {
  data: InstructorSpotlightBlockData;
  sideLoadedData: SideLoadedData;
}

export function InstructorSpotlightBlock({ data }: InstructorSpotlightBlockProps) {
  if (!data.instructorName?.trim() && !data.title?.trim() && !data.photo) {
    return null;
  }

  const credList = data.credentials
    ? data.credentials.split("\n").filter(Boolean)
    : [];
  const isCentered = data.variant === "centered";

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {data.title && (
          <h2
            className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px] text-center"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {data.title}
          </h2>
        )}

        <div
          className={
            isCentered
              ? "flex flex-col items-center gap-6 text-center"
              : "grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start"
          }
        >
          {data.photo && (
            <div className="flex-shrink-0">
              <img
                src={getStrapiMediaUrl(data.photo.url)}
                alt={data.photo.alternativeText || data.instructorName}
                className="w-48 h-48 lg:w-64 lg:h-64 rounded-2xl object-cover"
              />
            </div>
          )}
          <div className={`flex flex-col gap-3 ${isCentered ? "items-center" : ""}`}>
            <h3
              className="font-semibold text-[var(--on-surface-default)]"
              style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
            >
              {data.instructorName}
            </h3>
            {data.instructorRole && (
              <p className="text-sm text-[var(--surface-container-primary)] font-medium">
                {data.instructorRole}
              </p>
            )}
            {data.bio && (
              <div className="prose prose-sm max-w-none text-[var(--on-surface-default)]">
                <ReactMarkdown>{data.bio}</ReactMarkdown>
              </div>
            )}
            {credList.length > 0 && (
              <ul className="flex flex-col gap-1 mt-2">
                {credList.map((c, i) => (
                  <li key={i} className="text-sm text-[var(--on-surface-variant)] flex items-center gap-2">
                    <span className="text-green-500">&#10003;</span> {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
