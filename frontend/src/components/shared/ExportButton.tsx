"use client";

import { useState } from "react";
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

  const handleExport = async (format: string) => {
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
    <div className="relative group">
      <button
        disabled={exporting}
        className="inline-flex items-center gap-2 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label}
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-[#E5E7EB] shadow-lg py-1 hidden group-hover:block z-10 min-w-[120px]">
        <button
          onClick={() => handleExport("csv")}
          className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
        >
          CSV
        </button>
        <button
          onClick={() => handleExport("pdf")}
          className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
        >
          PDF
        </button>
        <button
          onClick={() => handleExport("xlsx")}
          className="w-full px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
        >
          Excel
        </button>
      </div>
    </div>
  );
};

export default ExportButton;
