"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SideLoadedData } from "@/lib/strapi/types";

interface TabItem {
  id: number;
  label: string;
  content: string;
  icon?: string;
}

interface TabsBlockData {
  __component: "blocks.tabs-block";
  id: number;
  title?: string;
  tabs?: TabItem[];
  variant?: "horizontal" | "vertical";
  visibility?: string;
  position?: string;
}

interface TabsBlockProps {
  data: TabsBlockData;
  sideLoadedData: SideLoadedData;
}

export function TabsBlock({ data }: TabsBlockProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!data.tabs || data.tabs.length === 0) return null;

  const tabs = data.tabs || [];
  const isVertical = data.variant === "vertical";

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8">
        {data.title && (
          <h2
            className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px] text-center"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {data.title}
          </h2>
        )}

        <div className={isVertical ? "flex flex-col lg:flex-row gap-6" : "flex flex-col gap-0"}>
          {/* Tab buttons */}
          <div
            className={
              isVertical
                ? "flex flex-row lg:flex-col gap-1 lg:w-56 flex-shrink-0 overflow-x-auto"
                : "flex border-b border-[var(--outline-subtle)] overflow-x-auto"
            }
          >
            {tabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  idx === activeIndex
                    ? isVertical
                      ? "bg-[var(--color-primary)]/10 text-[var(--surface-container-primary)] rounded-lg"
                      : "text-[var(--surface-container-primary)] border-b-2 border-[var(--surface-container-primary)]"
                    : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)]"
                }`}
              >
                {tab.icon && <span className="mr-2">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tabs[activeIndex] && (
            <div className="p-4 lg:p-6 flex-1">
              <div className="prose prose-sm max-w-none text-[var(--on-surface-default)]">
                <ReactMarkdown>{tabs[activeIndex].content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
