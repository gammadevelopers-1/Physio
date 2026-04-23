"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { getAccessToken, getDeviceId } from "@/lib/api";

interface ExportButtonProps {
  tableType: string;
  filters?: Record<string, string>;
  label?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

const ExportButton = ({ tableType, filters, label = "Export" }: ExportButtonProps) => {
  const [exporting, setExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleExport = async (format: string) => {
    setIsOpen(false);
    setExporting(true);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const deviceId = getDeviceId();
      if (deviceId) headers["X-Device-Id"] = deviceId;

      const response = await fetch(
        `${API_URL}/instructor/reports/export-table`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ type: tableType, format, filters }),
        }
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get("content-disposition");
      let filename = `${tableType}-export.${format === "xlsx" ? "xlsx" : format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently handle
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
        aria-label="Export options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-[var(--color-border)] shadow-lg py-1 z-10 min-w-[120px]" role="menu">
          <button
            onClick={() => handleExport("csv")}
            className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
            role="menuitem"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
            role="menuitem"
          >
            PDF
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
            role="menuitem"
          >
            Excel
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
