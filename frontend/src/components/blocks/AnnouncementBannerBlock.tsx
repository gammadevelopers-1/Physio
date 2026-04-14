"use client";

import { useState } from "react";
import type { SideLoadedData } from "@/lib/strapi/types";

interface AnnouncementBannerBlockData {
  __component: "blocks.announcement-banner-block";
  id: number;
  message: string;
  linkLabel?: string;
  linkUrl?: string;
  variant?: "info" | "warning" | "success" | "promotion";
  dismissible?: boolean;
  backgroundColor?: string;
  textColor?: string;
  visibility?: string;
  position?: string;
}

interface AnnouncementBannerBlockProps {
  data: AnnouncementBannerBlockData;
  sideLoadedData: SideLoadedData;
}

const variantClasses: Record<string, string> = {
  info: "bg-blue-50 text-blue-900",
  warning: "bg-yellow-50 text-yellow-900",
  success: "bg-green-50 text-green-900",
  promotion: "bg-purple-50 text-purple-900",
};

export function AnnouncementBannerBlock({ data }: AnnouncementBannerBlockProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const variant = data.variant || "info";
  const customStyle: React.CSSProperties = {};
  if (data.backgroundColor) customStyle.backgroundColor = data.backgroundColor;
  if (data.textColor) customStyle.color = data.textColor;

  return (
    <div
      className={`w-full px-4 lg:px-16 py-3 ${!data.backgroundColor ? variantClasses[variant] : ""}`}
      style={customStyle}
    >
      <div className="max-w-[1280px] mx-auto flex items-center justify-center gap-4">
        <p className="text-sm font-medium">{data.message}</p>
        {data.linkUrl && data.linkLabel && (
          <a
            href={data.linkUrl}
            className="text-sm font-semibold underline whitespace-nowrap"
          >
            {data.linkLabel}
          </a>
        )}
        {data.dismissible !== false && (
          <button
            onClick={() => setDismissed(true)}
            className="ml-2 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
