"use client";

import { useState, useEffect } from "react";
import { supportApi } from "@/lib/api";

export interface BusinessHoursConfig {
  utcOffsetHours: number;
  businessDays: number[];
  startHour: number;
  endHour: number;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  utcOffsetHours: 3,
  businessDays: [0, 1, 2, 3, 4],
  startHour: 9,
  endHour: 18,
};

export function parseHourFromHHMM(hhmm: string, fallback: number): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
  if (!match) return fallback;
  const h = parseInt(match[1], 10);
  return Number.isFinite(h) ? h : fallback;
}

export function isWithinBusinessHours(config: BusinessHoursConfig, now: Date = new Date()): boolean {
  const localDate = new Date(now.getTime() + config.utcOffsetHours * 60 * 60 * 1000);
  const localDay = localDate.getUTCDay();
  const localTimeInMinutes = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
  const isBusinessDay = config.businessDays.includes(localDay);
  const isBusinessTime =
    localTimeInMinutes >= config.startHour * 60 &&
    localTimeInMinutes < config.endHour * 60;
  return isBusinessDay && isBusinessTime;
}

export interface SupportOnlineStatus {
  isOnline: boolean | null;
  config: BusinessHoursConfig | null;
}

export function useSupportOnlineStatus(overrideConfig?: BusinessHoursConfig): SupportOnlineStatus {
  const [config, setConfig] = useState<BusinessHoursConfig | null>(overrideConfig ?? null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (overrideConfig) {
      setConfig(overrideConfig);
      return;
    }
    let cancelled = false;
    supportApi
      .getBusinessHours()
      .then((d) => {
        if (cancelled) return;
        setConfig({
          utcOffsetHours: d.timezoneOffsetHours,
          businessDays: d.workingDays,
          startHour: parseHourFromHHMM(d.openTime, DEFAULT_BUSINESS_HOURS.startHour),
          endHour: parseHourFromHHMM(d.closeTime, DEFAULT_BUSINESS_HOURS.endHour),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setConfig(DEFAULT_BUSINESS_HOURS);
      });
    return () => {
      cancelled = true;
    };
  }, [overrideConfig]);

  useEffect(() => {
    if (!config) return;
    setIsOnline(isWithinBusinessHours(config));
    const interval = setInterval(() => {
      setIsOnline(isWithinBusinessHours(config));
    }, 60_000);
    return () => clearInterval(interval);
  }, [config]);

  return { isOnline, config };
}
