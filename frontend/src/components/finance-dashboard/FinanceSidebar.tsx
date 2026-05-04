"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  RotateCcw,
  Tag,
  BarChart3,
  Settings,
  Pencil,
  Wallet,
} from "lucide-react";

interface FinanceProfile {
  name: string;
  email: string;
  revenue: string;
  invoices: number;
  refundRate: number;
  avatar?: string;
}

interface FinanceSidebarProps {
  profile: FinanceProfile;
}

const FinanceSidebar = ({ profile }: FinanceSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("financeDashboard");
  const isRTL = locale === "ar";

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/finance`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.payments"),
      href: `/${locale}/dashboard/finance/payments`,
      icon: CreditCard,
    },
    {
      label: t("sidebar.invoices"),
      href: `/${locale}/dashboard/finance/invoices`,
      icon: FileText,
      badge: 12,
    },
    {
      label: t("sidebar.refunds"),
      href: `/${locale}/dashboard/finance/refunds`,
      icon: RotateCcw,
      badge: 5,
    },
    {
      label: t("sidebar.discounts"),
      href: `/${locale}/dashboard/finance/discounts`,
      icon: Tag,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/finance/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/finance/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-4">
      {/* Profile Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center">
          {/* Avatar with edit button */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center relative">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {profile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)}
                </span>
              )}
              {/* Online badge */}
              <div
                className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center border-2 border-white`}
              >
                <Wallet className="w-3 h-3 text-white" />
              </div>
            </div>
            <button
              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white`}
              aria-label={t("sidebar.editProfile")}
            >
              <Pencil className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {profile.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{profile.email}</p>

          {/* Role Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDF6EC] rounded-full">
            <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-primary)]">
              {t("sidebar.financeManager")}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {profile.revenue}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.revenue")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {profile.invoices}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("sidebar.invoicesCount")}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#16A34A]">
              {profile.refundRate}%
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.refundRate")}</p>
          </div>
        </div>

        {/* View Profile Button */}
        <button className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors">
          {t("sidebar.viewProfile")}
        </button>
      </div>

      {/* Navigation Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
                />
                <span
                  className={`text-sm flex-1 ${active ? "font-medium" : ""}`}
                >
                  {item.label}
                </span>
                {item.badge && (
                  <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default FinanceSidebar;
