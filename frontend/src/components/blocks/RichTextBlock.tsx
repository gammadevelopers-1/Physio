"use client";

import ReactMarkdown from "react-markdown";
import Image from "next/image";
import type {
  RichTextBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";

interface RichTextBlockProps {
  data: RichTextBlockData;
  sideLoadedData: SideLoadedData;
}

const widthClasses: Record<RichTextBlockData["maxWidth"], string> = {
  narrow: "max-w-2xl",
  medium: "max-w-4xl",
  full: "max-w-full",
};

export function RichTextBlock({ data }: RichTextBlockProps) {
  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div
        className={`${widthClasses[data.maxWidth]} mx-auto`}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-[36px] lg:text-[48px] font-semibold text-[var(--on-surface-default)] leading-tight tracking-[-0.24px] mb-6">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-[28px] lg:text-[36px] font-semibold text-[var(--on-surface-default)] leading-tight tracking-[-0.15px] mb-5 mt-8">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-[22px] lg:text-[28px] font-semibold text-[var(--on-surface-default)] leading-tight mb-4 mt-6">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-[18px] lg:text-[22px] font-semibold text-[var(--on-surface-default)] leading-tight mb-3 mt-5">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-[16px] lg:text-[18px] text-[var(--on-surface-variant)] leading-7 mb-4">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-2 mb-6 text-[16px] lg:text-[18px] text-[var(--on-surface-variant)] leading-7 pl-2">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-2 mb-6 text-[16px] lg:text-[18px] text-[var(--on-surface-variant)] leading-7 pl-2">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-[var(--on-surface-variant)]">{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[#a37f49] pl-6 py-2 my-6 bg-[var(--surface-container-low)] rounded-r-lg italic text-[var(--on-surface-variant)]">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-[#a37f49] underline hover:opacity-80 transition-opacity"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-[var(--on-surface-default)]">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            img: ({ src, alt }) => (
              <span className="block my-6 rounded-2xl overflow-hidden">
                <Image
                  src={String(src || "")}
                  alt={String(alt || "")}
                  width={1200}
                  height={675}
                  className="w-full h-auto object-cover rounded-2xl"
                  unoptimized={String(src || "").startsWith("http")}
                />
              </span>
            ),
            hr: () => (
              <hr className="border-t border-[var(--outline-subtle)] my-8" />
            ),
            code: ({ children }) => (
              <code className="bg-[var(--surface-container-low)] px-2 py-1 rounded text-sm font-mono">
                {children}
              </code>
            ),
          }}
        >
          {data.content}
        </ReactMarkdown>
      </div>
    </section>
  );
}
