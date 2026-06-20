/**
 * Functional status color constants for the finance dashboard.
 * Brand colors come from Strapi via CSS variables (var(--color-primary), etc.).
 * Status colors below are semantic and universal — green=success, red=fail,
 * amber=pending — and intentionally NOT themable.
 */

export const FINANCE_COLORS = {
  success: {
    bg: "bg-[#DCFCE7]",
    bgSoft: "bg-[#F0FDF4]",
    text: "text-[#16A34A]",
    textDark: "text-[#15803D]",
    hex: "#16A34A",
  },
  warning: {
    bg: "bg-[#FEF3C7]",
    bgSoft: "bg-[#FFFBEB]",
    text: "text-[#D97706]",
    textDark: "text-[#92400E]",
    hex: "#D97706",
  },
  error: {
    bg: "bg-[#FEE2E2]",
    bgSoft: "bg-[#FEF2F2]",
    text: "text-[#DC2626]",
    textDark: "text-[#B91C1C]",
    hex: "#DC2626",
  },
  info: {
    bg: "bg-[#DBEAFE]",
    bgSoft: "bg-[#EFF6FF]",
    text: "text-[#2563EB]",
    textDark: "text-[#1D4ED8]",
    hex: "#3B82F6",
  },
  violet: {
    bg: "bg-[#EDE9FE]",
    bgSoft: "bg-[#F5F3FF]",
    text: "text-[#7C3AED]",
    textDark: "text-[#6D28D9]",
    hex: "#8B5CF6",
  },
  slate: {
    bg: "bg-[#F1F5F9]",
    bgSoft: "bg-[#F8FAFC]",
    text: "text-[#475569]",
    textDark: "text-[#334155]",
    hex: "#64748B",
  },
} as const;

export const GATEWAY_COLORS: Record<string, string> = {
  moyasar: "#8B5CF6",
  tamara: "#22C55E",
  tabby: "#F59E0B",
  bank_transfer: "#4338CA",
  tap: "#0EA5E9",
};

export function gatewayColor(gateway: string | null | undefined): string {
  if (!gateway) return "#94A3B8";
  return GATEWAY_COLORS[gateway.toLowerCase()] || "#94A3B8";
}

export const CHART_PALETTE = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#EF4444",
  "#84CC16",
];
