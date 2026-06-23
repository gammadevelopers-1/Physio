"use client";

import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" format (datetime-local equivalent)
  onChange: (value: string) => void;
  min?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combined date + time picker. Both halves are our custom design-system
 * pickers — no browser-native widgets so the look is consistent across
 * Chrome / Firefox / Safari and matches the rest of the dashboard.
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
      <div className="flex-1 min-w-0">
        <DatePicker
          value={datePart}
          onChange={handleDateChange}
          min={minDate}
          id={id}
          disabled={disabled}
        />
      </div>
      <div className="w-[150px] flex-shrink-0">
        <TimePicker
          value={timePart}
          onChange={handleTimeChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
