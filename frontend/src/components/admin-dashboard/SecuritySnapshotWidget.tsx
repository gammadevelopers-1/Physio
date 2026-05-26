"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Shield, Lock, Ban, Users, KeyRound, ArrowRight } from "lucide-react";

interface Props {
  data: {
    failedLogins: number;
    ipsBlocked: number;
    activeSessions: number;
    twoFaAdoption: number;
  };
}

export default function SecuritySnapshotWidget({ data }: Props) {
  const t = useTranslations("adminDashboard.securityHealth");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const items = [
    {
      id: "failedLogins",
      label: t("failedLogins"),
      value: data.failedLogins.toString(),
      icon: Lock,
      status: data.failedLogins > 20 ? "warning" : "healthy",
    },
    {
      id: "ipsBlocked",
      label: t("ipsBlocked"),
      value: data.ipsBlocked.toString(),
      icon: Ban,
      status: data.ipsBlocked > 0 ? "warning" : "healthy",
    },
    {
      id: "activeSessions",
      label: t("activeSessions"),
      value: data.activeSessions.toString(),
      icon: Users,
      status: "healthy",
    },
    {
      id: "twoFaAdoption",
      label: t("twoFaAdoption"),
      value: `${data.twoFaAdoption}%`,
      icon: KeyRound,
      status: data.twoFaAdoption >= 70 ? "healthy" : "warning",
    },
  ];

  const dotStyle = (s: string) =>
    s === "healthy"
      ? "bg-[var(--functional-green-600)]"
      : s === "warning"
        ? "bg-[var(--functional-amber-500)]"
        : "bg-[var(--functional-red-600)]";

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/security`}
          className="text-sm text-[#0066FF] hover:underline inline-flex items-center gap-1"
        >
          {t("viewLogs")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      <ul className="space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li
              key={it.id}
              className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {it.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotStyle(it.status)}`} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {it.value}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
