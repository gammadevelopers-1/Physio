"use client";

import Image from "next/image";
import { BlogContent as BlogContentType } from "@/data/blogDetails";

interface BlogContentProps {
  content: BlogContentType[];
  variant?: "desktop" | "mobile";
}

const BlogContent = ({ content, variant = "desktop" }: BlogContentProps) => {
  const isMobile = variant === "mobile";

  return (
    <div className="prose max-w-none">
      {content.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={index}
                className={`text-[var(--on-surface-default)] ${isMobile ? "mb-5 text-sm" : "mb-6"}`}
                style={{ fontSize: isMobile ? undefined : "16px", lineHeight: "1.8" }}
              >
                {block.text}
              </p>
            );
          case "heading":
            return (
              <h2
                key={index}
                className={`font-semibold text-[var(--on-surface-default)] ${isMobile ? "mt-8 mb-3" : "mt-10 mb-4"}`}
                style={{ fontSize: isMobile ? "20px" : "24px" }}
              >
                {block.text}
              </h2>
            );
          case "image":
            return (
              <div
                key={index}
                className={`relative w-full ${isMobile ? "h-[200px] my-6" : "h-[350px] my-8"} rounded-xl overflow-hidden`}
              >
                <Image
                  src={block.src || ""}
                  alt={block.alt || ""}
                  fill
                  className="object-cover"
                />
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className={`border-l-4 border-[#002D87] ${isMobile ? "pl-4 py-3 my-6" : "pl-6 py-4 my-8"} bg-[#F8FAFC] rounded-r-xl`}
              >
                <p
                  className={`text-[var(--on-surface-default)] italic ${isMobile ? "text-sm" : ""}`}
                  style={{ fontSize: isMobile ? undefined : "16px", lineHeight: "1.8" }}
                >
                  &ldquo;{block.text}&rdquo;
                </p>
              </blockquote>
            );
          case "conclusion":
            return (
              <div
                key={index}
                className={`bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl ${isMobile ? "p-4 my-8" : "p-6 my-10"}`}
              >
                <h3
                  className={`font-semibold text-[var(--on-surface-default)] ${isMobile ? "mb-2" : "mb-3"}`}
                  style={{ fontSize: isMobile ? "18px" : "20px" }}
                >
                  Conclusion
                </h3>
                <p
                  className={`text-[var(--on-surface-default)] ${isMobile ? "text-sm" : ""}`}
                  style={{ fontSize: isMobile ? undefined : "16px", lineHeight: "1.8" }}
                >
                  {block.text}
                </p>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

export default BlogContent;
