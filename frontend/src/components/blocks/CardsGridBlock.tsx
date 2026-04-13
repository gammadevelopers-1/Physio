"use client";

import type {
  CardsGridBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi";

interface CardsGridBlockProps {
  data: CardsGridBlockData;
  sideLoadedData: SideLoadedData;
}

const columnClasses: Record<CardsGridBlockData["columns"], string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function CardsGridBlock({ data }: CardsGridBlockProps) {
  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {/* Optional title and description */}
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h1)",
                }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        {/* Cards grid */}
        <div className={`grid ${columnClasses[data.columns]} gap-6 lg:gap-8 w-full`}>
          {data.cards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col gap-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-[var(--outline-subtle)]"
            >
              {card.image && (
                <div className="relative w-full h-48 overflow-hidden">
                  <img
                    src={getStrapiMediaUrl(card.image.url)}
                    alt={card.image.alternativeText || card.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2 p-5">
                <h3
                  className="font-semibold text-[var(--on-surface-default)]"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-h5)",
                  }}
                >
                  {card.title}
                </h3>
                {card.description && (
                  <p
                    className="text-[var(--on-surface-variant)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {card.description}
                  </p>
                )}
                {card.linkUrl && card.linkLabel && (
                  <a
                    href={card.linkUrl}
                    className="mt-2 text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
                  >
                    {card.linkLabel}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
