"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  id: string;
  /** Header text — already locale-resolved. */
  title: string;
  /** Body content — already locale-resolved. */
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** When true, only one item can be open at a time. Defaults to true. */
  singleOpen?: boolean;
  /** Optional id of the item that should be open initially. */
  defaultOpenId?: string;
  className?: string;
}

/**
 * Lightweight accordion with chevron + slide-in-spirit transitions.
 * Stateless on header/content rendering — caller pre-localises strings.
 */
const Accordion = ({ items, singleOpen = true, defaultOpenId, className = "" }: AccordionProps) => {
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    defaultOpenId ? new Set([defaultOpenId]) : new Set(),
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (singleOpen) return new Set([id]);
      next.add(id);
      return next;
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-start hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <span
                className={`text-sm sm:text-base font-medium ${
                  isOpen ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
                }`}
              >
                {item.title}
              </span>
              <ChevronDown
                className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  isOpen ? "rotate-180 text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-4 sm:px-5 pb-4 pt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border-subtle)]">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;
