"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { materialsApi } from "@/lib/api";
import { toast } from "sonner";
import {
  X,
  Plus,
  Trash2,
  Upload,
  Save,
  Loader2,
  FileText,
} from "lucide-react";

interface CaptionEntry {
  startTime: string;
  endTime: string;
  text: string;
}

interface CaptionEditorProps {
  materialId: string;
  materialTitle: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function CaptionEditor({
  materialId,
  materialTitle,
  onClose,
  onSaved,
}: CaptionEditorProps) {
  const t = useTranslations("instructorDashboard");
  const [entries, setEntries] = useState<CaptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"editor" | "upload">("editor");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await materialsApi.getCaptions(materialId);
        setEntries(data.entries);
      } catch {
        toast.error(t("captions.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [materialId, t]);

  const updateEntry = (index: number, field: keyof CaptionEntry, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const addEntry = () => {
    const last = entries[entries.length - 1];
    const newStart = last ? last.endTime : "00:00:00.000";
    const newEnd = last
      ? incrementTime(last.endTime, 5)
      : "00:00:05.000";
    setEntries((prev) => [...prev, { startTime: newStart, endTime: newEnd, text: "" }]);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await materialsApi.saveCaptions(materialId, entries);
      toast.success(t("captions.saveSuccess"));
      onSaved?.();
      onClose();
    } catch {
      toast.error(t("captions.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      await materialsApi.uploadCaptionFile(materialId, file);
      toast.success(t("captions.uploadSuccess"));
      // Reload captions
      const data = await materialsApi.getCaptions(materialId);
      setEntries(data.entries);
      setTab("editor");
      onSaved?.();
    } catch {
      toast.error(t("captions.uploadError"));
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2937]">{t("captions.title")}</h3>
            <p className="text-sm text-[#6B7280] truncate max-w-[400px]">{materialTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E7EB]">
          <button
            onClick={() => setTab("editor")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "editor" ? "text-[#3B82F6] border-b-2 border-[#3B82F6]" : "text-[#6B7280] hover:text-[#374151]"}`}
          >
            <FileText className="w-4 h-4 inline me-1.5" />
            {t("captions.editorTab")}
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "upload" ? "text-[#3B82F6] border-b-2 border-[#3B82F6]" : "text-[#6B7280] hover:text-[#374151]"}`}
          >
            <Upload className="w-4 h-4 inline me-1.5" />
            {t("captions.uploadTab")}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
            </div>
          ) : tab === "editor" ? (
            <div className="space-y-3">
              {entries.length === 0 && (
                <p className="text-sm text-[#9CA3AF] text-center py-8">{t("captions.noCaptions")}</p>
              )}
              {entries.map((entry, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-[#F9FAFB] rounded-lg">
                  <div className="flex-shrink-0 text-xs text-[#9CA3AF] w-6 pt-2">{i + 1}</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={entry.startTime}
                        onChange={(e) => updateEntry(i, "startTime", e.target.value)}
                        className="w-[130px] px-2 py-1.5 border border-[#E5E7EB] rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                        placeholder="00:00:00.000"
                      />
                      <span className="text-[#9CA3AF] text-xs pt-1.5">&rarr;</span>
                      <input
                        type="text"
                        value={entry.endTime}
                        onChange={(e) => updateEntry(i, "endTime", e.target.value)}
                        className="w-[130px] px-2 py-1.5 border border-[#E5E7EB] rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                        placeholder="00:00:05.000"
                      />
                    </div>
                    <textarea
                      value={entry.text}
                      onChange={(e) => updateEntry(i, "text", e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 border border-[#E5E7EB] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#3B82F6] resize-none"
                    />
                  </div>
                  <button
                    onClick={() => removeEntry(i)}
                    className="flex-shrink-0 p-1.5 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addEntry}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t("captions.addEntry")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Upload className="w-12 h-12 text-[#D1D5DB] mb-4" />
              <p className="text-sm text-[#6B7280] mb-4">{t("captions.uploadDesc")}</p>
              <label className="px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] cursor-pointer">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline me-1.5" /> : <Upload className="w-4 h-4 inline me-1.5" />}
                {t("captions.selectFile")}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".vtt,.srt"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={saving}
                />
              </label>
              <p className="text-xs text-[#9CA3AF] mt-2">{t("captions.acceptedFormats")}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "editor" && (
          <div className="flex justify-end gap-2 p-4 border-t border-[#E5E7EB]">
            <button onClick={onClose} className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]">
              {t("captions.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("captions.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function incrementTime(time: string, seconds: number): string {
  const parts = time.split(":");
  if (parts.length !== 3) return time;
  const [h, m, rest] = parts;
  const [s, ms] = rest.split(".");
  let totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + seconds;
  const hh = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${ms || "000"}`;
}
