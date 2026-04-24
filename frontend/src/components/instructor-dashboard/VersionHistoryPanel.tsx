"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { materialsApi } from "@/lib/api";
import { toast } from "sonner";
import {
  X,
  History,
  RotateCcw,
  Loader2,
  CheckCircle,
  Archive,
} from "lucide-react";

interface VersionEntry {
  id: string;
  version: number;
  title: string;
  fileSize: number | null;
  mimeType: string | null;
  status: string;
  createdAt: string;
  isCurrent: boolean;
}

interface VersionHistoryPanelProps {
  materialId: string;
  materialTitle: string;
  onClose: () => void;
  onRollback?: () => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VersionHistoryPanel({
  materialId,
  materialTitle,
  onClose,
  onRollback,
}: VersionHistoryPanelProps) {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await materialsApi.getVersionHistory(materialId);
        setVersions(data);
      } catch {
        toast.error(t("versions.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [materialId, t]);

  const handleRollback = async (versionId: string) => {
    setRolling(versionId);
    try {
      await materialsApi.rollback(materialId, versionId);
      toast.success(t("versions.rollbackSuccess"));
      onRollback?.();
      onClose();
    } catch {
      toast.error(t("versions.rollbackError"));
    } finally {
      setRolling(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
              <History className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("versions.title")}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-[300px]">{materialTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">{t("versions.noHistory")}</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className={`p-3 rounded-lg border ${v.isCurrent ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]" : "border-[var(--color-border)] bg-[var(--color-surface-card)]"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${v.isCurrent ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}>
                        v{v.version}
                      </span>
                      {v.isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)]">
                          <CheckCircle className="w-3 h-3" />
                          {t("versions.current")}
                        </span>
                      )}
                      {v.status === "archived" && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                          <Archive className="w-3 h-3" />
                          {t("versions.archived")}
                        </span>
                      )}
                    </div>
                    {!v.isCurrent && v.status !== "processing" && (
                      <>
                        {confirmId === v.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRollback(v.id)}
                              disabled={rolling === v.id}
                              className="px-3 py-1 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                            >
                              {rolling === v.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t("versions.confirm")}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="px-3 py-1 border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                            >
                              {t("versions.cancel")}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(v.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {t("versions.rollback")}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {/* File title */}
                  {v.title && (
                    <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-2 truncate">{v.title}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-secondary)]">
                    <span>{formatDateHijri(v.createdAt, calendarFormat, { locale, includeTime: true })}</span>
                    <span>{formatSize(v.fileSize)}</span>
                    {v.mimeType && <span>{v.mimeType.split("/").pop()}</span>}
                  </div>
                  {/* Rollback explanation */}
                  {confirmId === v.id && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2 bg-[var(--color-surface-page)] p-2 rounded">
                      {t("versions.rollbackDesc")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]">
            {t("versions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
