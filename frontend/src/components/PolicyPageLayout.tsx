"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface PolicySectionData {
  sectionId: string;
  sidebarLabel: string;
  title: string;
  content: string;
}

interface PolicyPageLayoutProps {
  title?: string | null;
  lastUpdated?: string | null;
  sections: PolicySectionData[];
  isRTL: boolean;
  emptyMessage: string;
}

const PolicyPageLayout = ({ title, lastUpdated, sections, isRTL, emptyMessage }: PolicyPageLayoutProps) => {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSectionIndex(i);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const scrollToSection = (index: number) => {
    const element = document.getElementById(sections[index].sectionId);
    if (element) {
      const navbarHeight = 88;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="bg-[var(--color-surface-page)] px-4 md:px-16 py-12 lg:py-20" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header — each line hides when Strapi has no value */}
      {(title || lastUpdated) && (
        <div className="flex flex-col gap-1 mb-8 text-[var(--on-surface-default)]">
          {title && (
            <h1
              className="font-semibold tracking-[-0.24px]"
              style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
            >
              {title}
            </h1>
          )}
          {lastUpdated && (
            <p
              className="leading-7"
              style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
            >
              {lastUpdated}
            </p>
          )}
        </div>
      )}

      {/* Empty state when Strapi returns no sections */}
      {sections.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 md:p-8 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
          <p
            className="leading-7 text-[var(--on-surface-default)] text-center"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {emptyMessage}
          </p>
        </div>
      ) : (
      /* Content Container */
      <div className="flex flex-col lg:flex-row gap-8 w-full">
        {/* Sidebar Navigation - Hidden on mobile */}
        <div className="hidden lg:block lg:w-[320px] xl:w-[395px] shrink-0">
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl p-8 sticky top-24 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
          >
            <nav className="flex flex-col gap-6">
              {sections.map((section, index) => (
                <button
                  key={section.sectionId}
                  onClick={() => scrollToSection(index)}
                  className={`text-start leading-7 transition-colors cursor-pointer ${
                    activeSectionIndex === index
                      ? "text-[var(--on-surface-default)] font-medium"
                      : "text-[var(--on-surface-default)] hover:text-[var(--on-surface-primary)]"
                  }`}
                  style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                >
                  {section.sidebarLabel}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl p-6 md:p-8 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
          >
            <div className="flex flex-col gap-12">
              {sections.map((section) => (
                <section
                  key={section.sectionId}
                  id={section.sectionId}
                  className="flex flex-col gap-6"
                >
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {section.title}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)] policy-content"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc">{children}</ul>,
                        li: ({ children }) => (
                          <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2 last:mb-0`}>
                            <span className="leading-7">{children}</span>
                          </li>
                        ),
                      }}
                    >
                      {section.content}
                    </ReactMarkdown>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </section>
  );
};

export default PolicyPageLayout;
