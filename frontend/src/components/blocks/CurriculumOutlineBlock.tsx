"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface CurriculumModule {
  id: number;
  title: string;
  description?: string;
  lessons?: string;
  duration?: string;
}

interface CurriculumOutlineBlockData {
  __component: "blocks.curriculum-outline-block";
  id: number;
  title?: string;
  description?: string;
  modules?: CurriculumModule[];
  totalDuration?: string;
  totalLessons?: number;
  visibility?: string;
  position?: string;
}

interface CurriculumOutlineBlockProps {
  data: CurriculumOutlineBlockData;
  sideLoadedData: SideLoadedData;
}

export function CurriculumOutlineBlock({ data }: CurriculumOutlineBlockProps) {
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

        {(data.totalDuration || data.totalLessons) && (
          <div className="flex items-center gap-6 text-sm text-[var(--on-surface-variant)]">
            {data.totalLessons && <span>{data.totalLessons} lessons</span>}
            {data.totalDuration && <span>{data.totalDuration}</span>}
          </div>
        )}

        <div className="w-full max-w-[768px] flex flex-col gap-4">
          {data.modules?.map((mod, index) => {
            const lessonList = mod.lessons
              ? mod.lessons.split("\n").filter(Boolean)
              : [];
            return (
              <div
                key={mod.id}
                className="p-5 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h3
                        className="font-semibold text-[var(--on-surface-default)]"
                        style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
                      >
                        {mod.title}
                      </h3>
                      {mod.duration && (
                        <span className="text-xs text-[var(--on-surface-variant)]">
                          {mod.duration}
                        </span>
                      )}
                    </div>
                    {mod.description && (
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        {mod.description}
                      </p>
                    )}
                    {lessonList.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1">
                        {lessonList.map((lesson, i) => (
                          <li
                            key={i}
                            className="text-sm text-[var(--on-surface-default)] pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--color-primary)]"
                          >
                            {lesson}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
