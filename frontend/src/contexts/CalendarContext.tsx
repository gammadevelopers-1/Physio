"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { preferencesApi } from "@/lib/api";
import type { CalendarFormat } from "@/lib/hijri";

interface CalendarContextValue {
  calendarFormat: CalendarFormat;
  setCalendarFormat: (format: CalendarFormat) => void;
  loading: boolean;
}

const CalendarContext = createContext<CalendarContextValue>({
  calendarFormat: "gregorian",
  setCalendarFormat: () => {},
  loading: true,
});

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendarFormat, setCalendarFormatState] = useState<CalendarFormat>("gregorian");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    preferencesApi
      .get()
      .then((prefs) => {
        // Legacy "both" rows are coerced to "gregorian" — the 3-way toggle
        // was retired in favour of a binary Gregorian | Hijri choice.
        const fmt = (prefs as Record<string, unknown>).calendarFormat;
        if (fmt === "hijri") setCalendarFormatState("hijri");
        else if (fmt === "gregorian" || fmt === "both")
          setCalendarFormatState("gregorian");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setCalendarFormat = useCallback((format: CalendarFormat) => {
    setCalendarFormatState(format);
    preferencesApi.updateUi({ calendarFormat: format }).catch(() => {});
  }, []);

  return (
    <CalendarContext.Provider value={{ calendarFormat, setCalendarFormat, loading }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarPreference() {
  return useContext(CalendarContext);
}
