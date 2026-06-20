"use client";

import { useLocale } from "next-intl";
import SaudiRiyalIcon from "./SaudiRiyalIcon";

interface MoneyProps {
  amount: number | string;
  decimals?: number;
  abbreviate?: boolean;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
  showIcon?: boolean;
}

function formatNumber(num: number, decimals: number, locale: string): string {
  const loc = locale === "ar" ? "ar-SA" : "en-US";
  return num.toLocaleString(loc, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function abbreviateNumber(num: number, locale: string): string {
  const loc = locale === "ar" ? "ar-SA" : "en-US";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return (num / 1_000_000).toLocaleString(loc, { maximumFractionDigits: 2 }) + "M";
  }
  if (abs >= 1_000) {
    return (num / 1_000).toLocaleString(loc, { maximumFractionDigits: 1 }) + "K";
  }
  return num.toLocaleString(loc);
}

const Money = ({
  amount,
  decimals = 2,
  abbreviate = false,
  className = "",
  iconClassName = "",
  iconSize = 14,
  showIcon = true,
}: MoneyProps) => {
  const locale = useLocale();
  const num = typeof amount === "string" ? Number(amount) : amount;
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = abbreviate
    ? abbreviateNumber(safe, locale)
    : formatNumber(safe, decimals, locale);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} dir="ltr">
      {showIcon && (
        <SaudiRiyalIcon
          size={iconSize}
          className={iconClassName || "text-current opacity-90"}
        />
      )}
      <span>{formatted}</span>
    </span>
  );
};

export default Money;
