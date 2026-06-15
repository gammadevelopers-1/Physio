"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/contexts";
import { financeApi } from "@/lib/api";

export interface FinanceProfile {
  name: string;
  email: string;
  revenue: string;
  invoices: number;
  refundRate: number;
  avatar?: string;
}

export function useFinanceProfile(): FinanceProfile {
  const user = useUser();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [refundRate, setRefundRate] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      financeApi.getSummary(),
      financeApi.getRefundRate(),
    ])
      .then(([summaryResult, rateResult]) => {
        if (!cancelled) {
          setTotalRevenue(summaryResult?.totalRevenue || 0);
          setTotalPayments(summaryResult?.totalPayments || 0);
          setRefundRate(parseFloat(rateResult?.refundRate || "0"));
        }
      })
      .catch(() => {
        // Silently fail — sidebar will show 0
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      name: user
        ? `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email
        : "",
      email: user?.email || "",
      revenue: totalRevenue > 0 ? `${Math.round(totalRevenue / 1000)}K` : "0",
      invoices: totalPayments,
      refundRate,
      avatar: user?.avatar || undefined,
    }),
    [user, totalRevenue, totalPayments, refundRate]
  );
}
