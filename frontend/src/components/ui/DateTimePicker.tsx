"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" format (datetime-local equivalent)
  onChange: (value: string) => void;
  min?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combined date + time picker. The date portion uses our custom Hijri-aware
 * DatePicker; the time portion uses a standard time input.
 */
export default function DateTimePicker({
  value,
  onChange,
  min,
  id,
  className = "",
  disabled,
}: DateTimePickerProps) {
  const datePart = value ? value.split("T")[0] : "";
  const timePart = value ? value.split("T")[1] || "12:00" : "12:00";

  const handleDateChange = (isoDate: string) => {
    onChange(`${isoDate}T${timePart}`);
  };

  const handleTimeChange = (time: string) => {
    if (datePart) {
      onChange(`${datePart}T${time}`);
    }
  };

  const minDate = min ? min.split("T")[0] : undefined;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1">
        <DatePicker
          value={datePart}
          onChange={handleDateChange}
          min={minDate}
          id={id}
          disabled={disabled}
        />
      </div>
      <input
        type="time"
        value={timePart}
        onChange={(e) => handleTimeChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
      />
    </div>
  );
}
