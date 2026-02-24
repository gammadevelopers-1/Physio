import { Calendar, Video, MapPin, Globe } from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";

export function getDeliveryIcon(sessionType: string) {
  switch (sessionType) {
    case "zoom":
      return { Icon: Video, color: "text-blue-500" };
    case "onsite":
      return { Icon: MapPin, color: "text-green-600" };
    case "hybrid":
    case "blended":
      return { Icon: Globe, color: "text-purple-500" };
    default:
      return { Icon: Calendar, color: "text-gray-400" };
  }
}

export function isJoinable(scheduledAt: string): boolean {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  return diff <= 15 * 60 * 1000; // within 15 minutes or already started
}

export function generateIcs(event: CalendarEvent): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + event.durationMinutes * 60 * 1000);

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PhysioGuidance//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.courseTitle}${event.instructorName ? " - " + event.instructorName : ""}`,
  ];

  if (event.zoomLink) {
    lines.push(`LOCATION:${event.zoomLink}`);
  } else if (event.venueAddress) {
    lines.push(`LOCATION:${event.venueAddress}`);
  } else if (event.roomName) {
    lines.push(`LOCATION:${event.roomName}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(event: CalendarEvent) {
  const icsContent = generateIcs(event);
  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
