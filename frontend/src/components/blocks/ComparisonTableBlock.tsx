"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface ComparisonColumn {
  id: number;
  heading: string;
  highlighted?: boolean;
  price?: string;
  features?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

interface ComparisonTableBlockData {
  __component: "blocks.comparison-table-block";
  id: number;
  title?: string;
  description?: string;
  columns?: ComparisonColumn[];
  featureLabels?: string;
  visibility?: string;
  position?: string;
}

interface ComparisonTableBlockProps {
  data: ComparisonTableBlockData;
  sideLoadedData: SideLoadedData;
}

export function ComparisonTableBlock({ data }: ComparisonTableBlockProps) {
  const labels = data.featureLabels
    ? data.featureLabels.split("\n").filter(Boolean)
    : [];

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

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {labels.length > 0 && (
                  <th className="p-4 text-left text-sm font-medium text-[var(--on-surface-variant)] border-b border-[var(--outline-subtle)]" />
                )}
                {data.columns?.map((col) => (
                  <th
                    key={col.id}
                    className={`p-4 text-center border-b border-[var(--outline-subtle)] ${col.highlighted ? "bg-[var(--color-primary)]/5" : ""}`}
                  >
                    <div className="font-semibold text-[var(--on-surface-default)]">
                      {col.heading}
                    </div>
                    {col.price && (
                      <div className="text-lg font-bold text-[var(--surface-container-primary)] mt-1">
                        {col.price}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {labels.length > 0 && (
              <tbody>
                {labels.map((label, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-[var(--outline-subtle)]">
                    <td className="p-4 text-sm text-[var(--on-surface-default)]">
                      {label}
                    </td>
                    {data.columns?.map((col) => {
                      const features = col.features
                        ? col.features.split("\n")
                        : [];
                      return (
                        <td
                          key={col.id}
                          className={`p-4 text-center text-sm ${col.highlighted ? "bg-[var(--color-primary)]/5" : ""}`}
                        >
                          {features[rowIdx] || "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            )}
            <tfoot>
              <tr>
                {labels.length > 0 && <td />}
                {data.columns?.map((col) => (
                  <td key={col.id} className="p-4 text-center">
                    {col.buttonUrl && col.buttonLabel && (
                      <a
                        href={col.buttonUrl}
                        className={`inline-block px-6 py-2 rounded-full text-sm font-medium ${
                          col.highlighted
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-[var(--outline-subtle)] text-[var(--on-surface-default)] hover:bg-gray-50"
                        }`}
                      >
                        {col.buttonLabel}
                      </a>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
