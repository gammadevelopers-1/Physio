"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { instructorApi, materialsApi } from "@/lib/api";
import { toast } from "sonner";
import CaptionEditor from "./CaptionEditor";
import VersionHistoryPanel from "./VersionHistoryPanel";
import VideoRetentionChart from "./VideoRetentionChart";
import type {
  InstructorCourse,
  CourseMaterialResponse,
  MaterialType,
} from "@/types/instructor-dashboard";
import {
  Search,
  Filter,
  ChevronDown,
  Upload,
  FolderOpen,
  FileVideo,
  FileText,
  File,
  Image,
  Check,
  AlertTriangle,
  X,
  Clock,
  Download,
  Trash2,
  Edit3,
  Eye,
  Grid,
  List,
  HardDrive,
  FileCheck,
  Video,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Replace,
  Loader2,
  MoreVertical,
  Subtitles,
  History,
  BarChart3,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────

function formatFileSize(bytes: number | string): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!b || isNaN(b)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = b;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function detectMaterialType(file: File): MaterialType | null {
  const mime = file.type;
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    mime.includes("ms-excel") ||
    mime.includes("spreadsheetml") ||
    mime.includes("ms-powerpoint") ||
    mime.includes("presentationml")
  )
    return "document";
  return null;
}

const ALLOWED_MIMES = [
  "video/mp4", "video/mpeg", "video/webm", "video/quicktime", "video/x-msvideo",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg", "image/png", "image/webp", "image/gif",
];

// ─── Actions Dropdown ─────────────────────────────────────

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const ActionsDropdown = ({ actions }: { actions: ActionItem[] }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors"
        aria-label="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {actions.map((a, i) => (
        <DropdownMenuItem key={i} danger={a.danger} onClick={a.onClick}>
          {a.icon}
          {a.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

// ─── Modal Overlay ─────────────────────────────────────────

const ModalOverlay = ({ children, onClose, ariaLabelledBy }: { children: React.ReactNode; onClose: () => void; ariaLabelledBy?: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
    {children}
  </div>
);

// ─── Upload Modal ──────────────────────────────────────────

interface UploadModalProps {
  courses: InstructorCourse[];
  onClose: () => void;
  onUploaded: () => void;
  t: ReturnType<typeof useTranslations>;
}

const UploadModal = ({ courses, onClose, onUploaded, t }: UploadModalProps) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [courseModules, setCourseModules] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<MaterialType | null>(null);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch modules when course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseModules([]);
      setSelectedModuleId("");
      return;
    }
    let cancelled = false;
    instructorApi.getCourseDetail(selectedCourseId).then((data) => {
      if (!cancelled && data?.modules) {
        setCourseModules(data.modules.map((m: { id: string; title: string }) => ({ id: m.id, title: m.title })));
      }
    }).catch(() => {
      if (!cancelled) setCourseModules([]);
    });
    setSelectedModuleId("");
    return () => { cancelled = true; };
  }, [selectedCourseId]);

  const handleFileSelect = (f: File) => {
    if (!ALLOWED_MIMES.includes(f.type)) {
      setError(t("content.unsupportedType"));
      return;
    }
    setFile(f);
    setError("");
    const type = detectMaterialType(f);
    setDetectedType(type);
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleUpload = async () => {
    if (!file || !selectedCourseId || !title.trim() || !detectedType) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      await materialsApi.uploadWithProgress(
        selectedCourseId,
        file,
        title.trim(),
        detectedType,
        (pct) => setProgress(pct),
        selectedModuleId || undefined,
        detectedType === "video" ? autoTranscribe : undefined,
      );
      toast.success(t("content.uploadSuccess"));
      onUploaded();
      onClose();
    } catch {
      setError(t("content.uploadError"));
      toast.error(t("content.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} ariaLabelledBy="upload-modal-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 id="upload-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{t("content.uploadTitle")}</h3>
            <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors" aria-label={t("content.cancel")}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              file ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[var(--color-border)] hover:border-[#3B82F6]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_MIMES.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {file ? (
              <div>
                <Check className="w-8 h-8 mx-auto mb-2 text-[#22C55E]" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{file.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {formatFileSize(file.size)} &bull; {detectedType?.toUpperCase()}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setDetectedType(null); }}
                  className="mt-2 text-xs text-[#EF4444] hover:underline"
                >
                  {t("content.removeFile")}
                </button>
              </div>
            ) : (
              <div>
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#3B82F6]" />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">{t("content.dragDrop")}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t("content.orBrowse")}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t("content.supportedFormats")}</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.materialTitle")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("content.titlePlaceholder")}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
          </div>

          {/* Course */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.selectCourse")}</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              {courses.filter((c) => c.status !== "completed" && c.status !== "archived").map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Module (optional) */}
          {courseModules.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.selectModule")}</label>
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="">{t("content.noModule")}</option>
                {courseModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Auto-Transcribe Toggle (video only) */}
          {detectedType === "video" && (
            <div className="mt-4 flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("content.autoTranscribe")}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t("content.autoTranscribeDesc")}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoTranscribe}
                onClick={() => setAutoTranscribe((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 ${
                  autoTranscribe ? "bg-[#3B82F6]" : "bg-[var(--color-border)]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoTranscribe ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                <span>{t("content.uploading")}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                <div
                  className="bg-[#3B82F6] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-[#EF4444]">{error}</p>}

          {/* WCAG Notice */}
          <div className="mt-4 flex items-start gap-3 p-3 bg-[#EFF6FF] rounded-lg">
            <FileCheck className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#1D4ED8]">{t("content.wcagNotice")}</p>
              <p className="text-xs text-[#3B82F6] mt-1">{t("content.wcagNoticeDesc")}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} disabled={uploading} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-50">
              {t("content.cancel")}
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim() || !selectedCourseId || !detectedType}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? t("content.uploading") : t("content.upload")}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ─── Replace Modal ─────────────────────────────────────────

interface ReplaceModalProps {
  material: CourseMaterialResponse;
  onClose: () => void;
  onReplaced: () => void;
  t: ReturnType<typeof useTranslations>;
}

const ReplaceModal = ({ material, onClose, onReplaced, t }: ReplaceModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (f: File) => {
    const detectedType = detectMaterialType(f);
    if (detectedType !== material.type) {
      setError(t("content.typeMismatch"));
      return;
    }
    setFile(f);
    setError("");
  };

  const handleReplace = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      await materialsApi.replaceWithProgress(material.id, file, (pct) => setProgress(pct));
      toast.success(t("content.replaceSuccess"));
      onReplaced();
      onClose();
    } catch {
      setError(t("content.replaceError"));
      toast.error(t("content.replaceError"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} ariaLabelledBy="replace-modal-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 id="replace-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{t("content.replaceTitle")}</h3>
            <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors" aria-label={t("content.cancel")}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current file info */}
          <div className="p-3 bg-[var(--color-surface-page)] rounded-lg mb-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{material.title}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              v{material.version} &bull; {formatFileSize(material.fileSize)} &bull; {material.type.toUpperCase()}
            </p>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("content.replaceDesc")}</p>

          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              file ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[var(--color-border)] hover:border-[#3B82F6]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_MIMES.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {file ? (
              <div>
                <Check className="w-6 h-6 mx-auto mb-2 text-[#22C55E]" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{file.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{formatFileSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <Replace className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-secondary)]" />
                <p className="text-sm text-[var(--color-text-secondary)]">{t("content.selectNewFile")}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("content.sameTypeRequired")}</p>
              </div>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                <span>{t("content.uploading")}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                <div className="bg-[#3B82F6] h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-[#EF4444]">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} disabled={uploading} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50">
              {t("content.cancel")}
            </button>
            <button
              onClick={handleReplace}
              disabled={uploading || !file}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F97316] text-white rounded-lg text-sm font-medium hover:bg-[#EA580C] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
              {uploading ? t("content.uploading") : t("content.replace")}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ─── Edit Modal ────────────────────────────────────────────

interface EditModalProps {
  material: CourseMaterialResponse;
  onClose: () => void;
  onUpdated: () => void;
  t: ReturnType<typeof useTranslations>;
}

const EditModal = ({ material, onClose, onUpdated, t }: EditModalProps) => {
  const [title, setTitle] = useState(material.title);
  const [captionsUrl, setCaptionsUrl] = useState(material.captionsUrl || "");
  const [transcriptUrl, setTranscriptUrl] = useState(material.transcriptUrl || "");
  const [autoTranscribe, setAutoTranscribe] = useState(material.autoTranscribe !== false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, string | boolean> = {};
      if (title.trim() !== material.title) data.title = title.trim();
      if (captionsUrl !== (material.captionsUrl || "")) data.captionsUrl = captionsUrl;
      if (transcriptUrl !== (material.transcriptUrl || "")) data.transcriptUrl = transcriptUrl;
      if (material.type === "video" && autoTranscribe !== (material.autoTranscribe !== false)) {
        data.autoTranscribe = autoTranscribe;
      }

      if (Object.keys(data).length === 0) {
        onClose();
        return;
      }

      await materialsApi.update(material.id, data as Parameters<typeof materialsApi.update>[1]);
      toast.success(t("content.updateSuccess"));
      onUpdated();
      onClose();
    } catch {
      toast.error(t("content.updateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} ariaLabelledBy="edit-modal-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 id="edit-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{t("content.editTitle")}</h3>
            <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors" aria-label={t("content.cancel")}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.materialTitle")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
          </div>

          {/* WCAG Status display */}
          <div className="mb-4 p-3 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t("content.wcagStatus")}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              material.wcagStatus === "pass" ? "bg-[#DCFCE7] text-[#22C55E]" :
              material.wcagStatus === "warning" ? "bg-[#FEF9C3] text-[#EAB308]" :
              material.wcagStatus === "fail" ? "bg-[#FEE2E2] text-[#EF4444]" :
              "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
            }`}>
              {material.wcagStatus === "pass" ? <Check className="w-3 h-3" /> :
               material.wcagStatus === "warning" ? <AlertTriangle className="w-3 h-3" /> :
               material.wcagStatus === "fail" ? <X className="w-3 h-3" /> :
               <Clock className="w-3 h-3" />}
              {material.wcagStatus === "pass" ? t("content.wcagPass") :
               material.wcagStatus === "warning" ? t("content.wcagWarning") :
               material.wcagStatus === "fail" ? t("content.wcagFail") :
               t("content.wcagPending")}
            </span>
            {/* WCAG Check Details */}
            {material.wcagDetails && (() => {
              try {
                const checks = JSON.parse(material.wcagDetails) as { rule: string; label: string; passed: boolean; detail: string }[];
                return (
                  <ul className="mt-2 space-y-1">
                    {checks.filter((c) => c.rule !== "INFO").map((check, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        {check.passed ? (
                          <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                        )}
                        <span>
                          <span className="font-medium">{check.label}</span>
                          <span className="text-[var(--color-text-secondary)]"> — {check.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              } catch {
                return null;
              }
            })()}
          </div>

          {/* Auto-generated captions/transcript download links */}
          {material.type === "video" && (material.captionsUrl || material.transcriptUrl) && (
            <div className="mb-4 p-3 bg-[#F0FDF4] rounded-lg">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">{t("content.autoGenerated")}</p>
              <div className="flex flex-wrap gap-2">
                {material.captionsUrl && (
                  <a
                    href={material.captionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {t("content.downloadCaptions")}
                  </a>
                )}
                {material.transcriptUrl && (
                  <a
                    href={material.transcriptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {t("content.downloadTranscript")}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Captions URL (for videos) */}
          {material.type === "video" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.captionsUrl")}</label>
                <input
                  type="text"
                  value={captionsUrl}
                  onChange={(e) => setCaptionsUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("content.captionsUrlHint")}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("content.transcriptUrl")}</label>
                <input
                  type="text"
                  value={transcriptUrl}
                  onChange={(e) => setTranscriptUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>

              {/* Auto-Transcribe Toggle */}
              <div className="mb-4 flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("content.autoTranscribe")}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t("content.autoTranscribeDesc")}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoTranscribe}
                  onClick={() => setAutoTranscribe((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 ${
                    autoTranscribe ? "bg-[#3B82F6]" : "bg-[var(--color-border)]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoTranscribe ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </>
          )}

          {/* Info */}
          <div className="p-3 bg-[var(--color-surface-page)] rounded-lg text-xs text-[var(--color-text-secondary)] space-y-1">
            <p>{t("content.version")}: v{material.version}</p>
            <p>{t("content.type")}: {material.type.toUpperCase()}</p>
            <p>{t("content.tableSize")}: {formatFileSize(material.fileSize)}</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50">
              {t("content.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t("content.save")}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ─── Delete Confirm ────────────────────────────────────────

interface DeleteConfirmProps {
  material: CourseMaterialResponse;
  onClose: () => void;
  onDeleted: () => void;
  t: ReturnType<typeof useTranslations>;
}

const DeleteConfirm = ({ material, onClose, onDeleted, t }: DeleteConfirmProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await materialsApi.delete(material.id);
      toast.success(t("content.deleteSuccess"));
      onDeleted();
      onClose();
    } catch {
      toast.error(t("content.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} ariaLabelledBy="delete-modal-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#FEE2E2] flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-[#EF4444]" />
          </div>
          <h3 id="delete-modal-title" className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{t("content.deleteConfirmTitle")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{t("content.deleteConfirmDesc")}</p>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-6">&ldquo;{material.title}&rdquo;</p>

          <div className="flex gap-3">
            <button onClick={onClose} disabled={deleting} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50">
              {t("content.cancel")}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("content.delete")}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ─── Main Component ────────────────────────────────────────

const ContentManagementContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();

  // Data
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [materials, setMaterials] = useState<CourseMaterialResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [replacingMaterial, setReplacingMaterial] = useState<CourseMaterialResponse | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<CourseMaterialResponse | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<CourseMaterialResponse | null>(null);
  const [captionEditingMaterial, setCaptionEditingMaterial] = useState<CourseMaterialResponse | null>(null);
  const [versionHistoryMaterial, setVersionHistoryMaterial] = useState<CourseMaterialResponse | null>(null);
  const [analyticsViewMaterial, setAnalyticsViewMaterial] = useState<CourseMaterialResponse | null>(null);

  // ── Fetch courses ────────────────────────────────────────
  const fetchCourses = useCallback(async () => {
    try {
      const res = await instructorApi.getCourses({ limit: 100 });
      setCourses(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  // ── Fetch materials ──────────────────────────────────────
  const fetchMaterials = useCallback(async (courseList: InstructorCourse[], courseFilter: string) => {
    try {
      if (courseFilter !== "all") {
        const data = await materialsApi.list(courseFilter);
        setMaterials(data);
      } else {
        // Fetch materials for all courses in parallel
        const results = await Promise.all(
          courseList.map((c) => materialsApi.list(c.id).catch(() => [] as CourseMaterialResponse[]))
        );
        setMaterials(results.flat());
      }
    } catch {
      setError(t("content.loadError"));
    }
  }, [t]);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const courseList = await fetchCourses();
      if (cancelled) return;
      if (courseList.length === 0) {
        setLoading(false);
        return;
      }
      await fetchMaterials(courseList, "all");
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [fetchCourses, fetchMaterials]);

  // ── Refetch when course filter changes ───────────────────
  const handleCourseChange = useCallback(async (courseId: string) => {
    setSelectedCourse(courseId);
    setCurrentPage(1);
    setLoading(true);
    await fetchMaterials(courses, courseId);
    setLoading(false);
  }, [courses, fetchMaterials]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    await fetchMaterials(courses, selectedCourse);
    setLoading(false);
  }, [courses, selectedCourse, fetchMaterials]);

  // ── Poll for processing status updates ────────────────────
  const hasProcessingMaterials = useMemo(
    () => materials.some((m) => m.status === "processing"),
    [materials],
  );

  useEffect(() => {
    if (!hasProcessingMaterials || courses.length === 0) return;

    const interval = setInterval(async () => {
      try {
        await fetchMaterials(courses, selectedCourse);
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasProcessingMaterials, courses, selectedCourse, fetchMaterials]);

  // ── Filtering & pagination ───────────────────────────────
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === "all" || m.type === selectedType;
      const matchesStatus = selectedStatus === "all" || m.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [materials, searchQuery, selectedType, selectedStatus]);

  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMaterials, currentPage]);

  // ── Derived stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const totalFiles = materials.length;
    const totalBytes = materials.reduce((sum, m) => {
      const size = typeof m.fileSize === "string" ? parseInt(m.fileSize, 10) : m.fileSize;
      return sum + (isNaN(size) ? 0 : size);
    }, 0);
    const liveFiles = materials.filter((m) => m.status === "live").length;
    const wcagPass = materials.filter((m) => m.wcagStatus === "pass").length;
    return { totalFiles, totalStorage: formatFileSize(totalBytes), liveFiles, wcagPass };
  }, [materials]);

  // ── Course name lookup ───────────────────────────────────
  const courseNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => { map[c.id] = c.title; });
    return map;
  }, [courses]);

  // ── Icon helpers ─────────────────────────────────────────
  const getFileIcon = (type: string) => {
    switch (type) {
      case "video": return <FileVideo className="w-5 h-5" />;
      case "pdf": return <FileText className="w-5 h-5" />;
      case "document": return <File className="w-5 h-5" />;
      case "image": return <Image className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  const getFileIconBg = (type: string) => {
    switch (type) {
      case "video": return "bg-[#FEE2E2] text-[#EF4444]";
      case "pdf": return "bg-[#FFEDD5] text-[#F97316]";
      case "document": return "bg-[#DBEAFE] text-[#3B82F6]";
      case "image": return "bg-[#D1FAE5] text-[#10B981]";
      default: return "bg-[#F3F4F6] text-[var(--color-text-secondary)]";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "live": return "bg-[#DCFCE7] text-[#22C55E]";
      case "processing": return "bg-[#FEF9C3] text-[#EAB308]";
      case "failed": return "bg-[#FEE2E2] text-[#EF4444]";
      case "pending_review": return "bg-[#DBEAFE] text-[#3B82F6]";
      case "changes_requested": return "bg-[#FEF3C7] text-[#D97706]";
      default: return "bg-[#F3F4F6] text-[var(--color-text-secondary)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live": return <Check className="w-3 h-3" />;
      case "processing": return <Clock className="w-3 h-3 animate-spin" />;
      case "failed": return <X className="w-3 h-3" />;
      case "pending_review": return <Clock className="w-3 h-3" />;
      case "changes_requested": return <AlertTriangle className="w-3 h-3" />;
      default: return null;
    }
  };

  const getProcessingStepLabel = (step: string | null): string => {
    switch (step) {
      case "transcoding": return t("content.stepTranscoding");
      case "extracting_audio": return t("content.stepExtractingAudio");
      case "generating_captions": return t("content.stepGeneratingCaptions");
      case "generating_transcript": return t("content.stepGeneratingTranscript");
      case "wcag_check": return t("content.stepWcagCheck");
      case "complete": return t("content.stepComplete");
      default: return t("content.statusProcessing");
    }
  };

  const getWcagStyle = (wcag: string) => {
    if (wcag === "pass" || wcag === "compliant") return "bg-[#DCFCE7] text-[#22C55E]";
    if (wcag === "warning") return "bg-[#FEF9C3] text-[#EAB308]";
    if (wcag === "fail") return "bg-[#FEE2E2] text-[#EF4444]";
    return "bg-[#F3F4F6] text-[var(--color-text-secondary)]"; // pending (gray)
  };

  const getWcagIcon = (wcag: string) => {
    if (wcag === "pass" || wcag === "compliant") return <Check className="w-3 h-3" />;
    if (wcag === "warning") return <AlertTriangle className="w-3 h-3" />;
    if (wcag === "fail") return <X className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />; // pending
  };

  const getWcagLabel = (wcag: string) => {
    if (wcag === "pass" || wcag === "compliant") return t("content.wcagPass");
    if (wcag === "warning") return t("content.wcagWarning");
    if (wcag === "fail") return t("content.wcagFail");
    return t("content.wcagPending"); // pending
  };

  /** Parse wcagDetails JSON and build tooltip text showing each check result */
  const getWcagTooltip = (m: CourseMaterialResponse): string => {
    if (!m.wcagDetails) return t("content.wcagCompliance");
    try {
      const details = JSON.parse(m.wcagDetails) as { rule: string; label: string; passed: boolean; detail: string }[];
      return details
        .map((d) => `${d.passed ? "\u2713" : "\u2717"} ${d.label}: ${d.detail}`)
        .join("\n");
    } catch {
      return t("content.wcagCompliance");
    }
  };

  const handlePreview = (m: CourseMaterialResponse) => {
    if (m.fileUrl) {
      window.open(m.fileUrl, "_blank");
    }
  };

  const handleDownload = (m: CourseMaterialResponse) => {
    if (m.fileUrl) {
      const a = document.createElement("a");
      a.href = m.fileUrl;
      a.download = m.title;
      a.click();
    }
  };

  // ── Types & statuses filter options ──────────────────────
  const types = [
    { id: "all", name: t("content.allTypes") },
    { id: "video", name: t("content.typeVideo") },
    { id: "pdf", name: t("content.typePDF") },
    { id: "document", name: t("content.typeDocument") },
    { id: "image", name: t("content.typeImage") },
  ];

  const statuses = [
    { id: "all", name: t("content.allStatuses") },
    { id: "live", name: t("content.statusLive") },
    { id: "processing", name: t("content.statusProcessing") },
    { id: "pending_review", name: t("content.statusPending_review") },
    { id: "changes_requested", name: t("content.statusChanges_requested") },
    { id: "failed", name: t("content.statusFailed") },
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <>
      <InstructorNavbar instructor={instructor} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">{t("content.title")}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("content.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refetch}
                    className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
                    aria-label={t("content.refresh")}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (courses.length === 0) {
                        toast.error(t("content.noCourseError"));
                        return;
                      }
                      setShowUploadModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    {t("content.uploadNew")}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.totalFiles}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("content.totalFiles")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.totalStorage}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("content.storageUsed")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.liveFiles}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("content.liveContent")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FCE7F3] flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-[#EC4899]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.wcagPass}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("content.wcagCompliant")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading / Error states */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                  <span className="ml-3 text-[var(--color-text-secondary)]">{t("content.loading")}</span>
                </div>
              )}

              {error && !loading && (
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-[#EF4444] mb-4">{error}</p>
                  <button onClick={refetch} className="px-4 py-2 btn-gold text-white rounded-lg text-sm">
                    {t("content.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Search and Filters */}
                  <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                        <input
                          type="text"
                          placeholder={t("content.searchPlaceholder")}
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                          className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                        >
                          <Filter className="w-4 h-4" />
                          {t("content.filters")}
                          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                        </button>

                        {/* View Mode Toggle */}
                        <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
                          <button
                            onClick={() => setViewMode("list")}
                            className={`p-2.5 ${viewMode === "list" ? "bg-[#3B82F6] text-white" : "bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"}`}
                          >
                            <List className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2.5 ${viewMode === "grid" ? "bg-[#3B82F6] text-white" : "bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"}`}
                          >
                            <Grid className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Desktop Filters */}
                      <div className="hidden md:flex gap-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => handleCourseChange(e.target.value)}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          <option value="all">{t("content.allCourses")}</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                        <select
                          value={selectedType}
                          onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mobile Filters */}
                    {showFilters && (
                      <div className="md:hidden mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-3 gap-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => handleCourseChange(e.target.value)}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          <option value="all">{t("content.allCourses")}</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                        <select
                          value={selectedType}
                          onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Empty state */}
                  {filteredMaterials.length === 0 && (
                    <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
                      <FolderOpen className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{t("content.noFiles")}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("content.noFilesDesc")}</p>
                      {courses.length > 0 && (
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg text-sm font-medium"
                        >
                          <Upload className="w-4 h-4" />
                          {t("content.uploadNew")}
                        </button>
                      )}
                    </div>
                  )}

                  {/* List View */}
                  {viewMode === "list" && filteredMaterials.length > 0 && (
                    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-[35%]" />
                            <col className="w-[18%]" />
                            <col className="w-[10%]" />
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                            <col className="w-[12%]" />
                          </colgroup>
                          <thead>
                            <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableFile")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableCourse")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableSize")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableStatus")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableWCAG")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                {t("content.tableActions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {paginatedMaterials.map((m) => (
                              <tr key={m.id} className="hover:bg-[var(--color-surface-page)] transition-colors">
                                <td className="px-4 py-4 overflow-hidden">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getFileIconBg(m.type)}`}>
                                      {getFileIcon(m.type)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{m.title}</p>
                                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                        <span>v{m.version}</span>
                                        <span>&bull;</span>
                                        <span>{formatDateHijri(m.createdAt, calendarFormat, { locale })}</span>
                                        {m.version > 1 && (
                                          <span className="px-1.5 py-0.5 bg-[#DBEAFE] text-[#3B82F6] rounded text-[10px] font-medium">
                                            {t("content.newVersion")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 overflow-hidden">
                                  <span className="text-sm text-[var(--color-text-secondary)] truncate block">
                                    {courseNameMap[m.courseId] || m.courseId}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-sm text-[var(--color-text-secondary)]">{formatFileSize(m.fileSize)}</span>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(m.status)}`}
                                    title={m.status === "changes_requested" && m.reviewNote ? `${t("content.reviewFeedback")}: ${m.reviewNote}` : m.status === "failed" && m.processingError ? m.processingError : ""}
                                  >
                                    {getStatusIcon(m.status)}
                                    {m.status === "processing"
                                      ? getProcessingStepLabel(m.processingStep)
                                      : t(`content.status${m.status.charAt(0).toUpperCase() + m.status.slice(1)}`)}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-help ${getWcagStyle(m.wcagStatus)}`}
                                    title={getWcagTooltip(m)}
                                  >
                                    {getWcagIcon(m.wcagStatus)}
                                    {getWcagLabel(m.wcagStatus)}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <ActionsDropdown
                                    actions={[
                                      ...(m.fileUrl ? [{
                                        label: t("content.preview"),
                                        icon: <Eye className="w-4 h-4" />,
                                        onClick: () => handlePreview(m),
                                      }] : []),
                                      ...(m.fileUrl ? [{
                                        label: t("content.download"),
                                        icon: <Download className="w-4 h-4" />,
                                        onClick: () => handleDownload(m),
                                      }] : []),
                                      {
                                        label: t("content.edit"),
                                        icon: <Edit3 className="w-4 h-4" />,
                                        onClick: () => setEditingMaterial(m),
                                      },
                                      {
                                        label: t("content.replace"),
                                        icon: <Replace className="w-4 h-4" />,
                                        onClick: () => setReplacingMaterial(m),
                                      },
                                      ...(m.type === "video" ? [{
                                        label: t("content.editCaptions"),
                                        icon: <Subtitles className="w-4 h-4" />,
                                        onClick: () => setCaptionEditingMaterial(m),
                                      }, {
                                        label: t("content.viewAnalytics"),
                                        icon: <BarChart3 className="w-4 h-4" />,
                                        onClick: () => setAnalyticsViewMaterial(m),
                                      }] : []),
                                      {
                                        label: t("content.versionHistory"),
                                        icon: <History className="w-4 h-4" />,
                                        onClick: () => setVersionHistoryMaterial(m),
                                      },
                                      {
                                        label: t("content.delete"),
                                        icon: <Trash2 className="w-4 h-4" />,
                                        onClick: () => setDeletingMaterial(m),
                                        danger: true,
                                      },
                                    ]}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("content.showing")} {paginatedMaterials.length} {t("content.of")} {filteredMaterials.length} {t("content.files")}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          <span className="px-3 py-1 text-sm text-[var(--color-text-secondary)]">
                            {currentPage} / {totalPages || 1}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid View */}
                  {viewMode === "grid" && filteredMaterials.length > 0 && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {paginatedMaterials.map((m) => (
                          <div key={m.id} className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden hover:shadow-md transition-shadow">
                            {/* File Preview */}
                            <div className={`h-32 flex items-center justify-center relative ${
                              m.type === "video" ? "bg-[#FEE2E2]" :
                              m.type === "pdf" ? "bg-[#FFEDD5]" :
                              m.type === "image" ? "bg-[#D1FAE5]" : "bg-[#DBEAFE]"
                            }`}>
                              {m.type === "video" ? <Video className="w-12 h-12 text-[#EF4444] opacity-50" /> :
                               m.type === "pdf" ? <FileText className="w-12 h-12 text-[#F97316] opacity-50" /> :
                               m.type === "image" ? <Image className="w-12 h-12 text-[#10B981] opacity-50" /> :
                               <File className="w-12 h-12 text-[#3B82F6] opacity-50" />}
                              {m.version > 1 && (
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#3B82F6] text-white rounded text-[10px] font-medium">
                                  v{m.version}
                                </span>
                              )}
                            </div>

                            <div className="p-4">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate mb-1">{m.title}</p>
                              <p className="text-xs text-[var(--color-text-secondary)] truncate mb-3">{courseNameMap[m.courseId] || ""}</p>

                              <div className="flex items-center justify-between mb-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(m.status)}`}>
                                  {getStatusIcon(m.status)}
                                  {m.status === "processing"
                                    ? getProcessingStepLabel(m.processingStep)
                                    : t(`content.status${m.status.charAt(0).toUpperCase() + m.status.slice(1)}`)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${getWcagStyle(m.wcagStatus)}`}
                                  title={getWcagTooltip(m)}
                                >
                                  {getWcagIcon(m.wcagStatus)}
                                  WCAG
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                <span>{formatFileSize(m.fileSize)}</span>
                                <span>v{m.version}</span>
                              </div>

                              <div className="flex items-center justify-end mt-3 pt-3 border-t border-[var(--color-border)]">
                                <ActionsDropdown
                                  actions={[
                                    ...(m.fileUrl ? [{
                                      label: t("content.preview"),
                                      icon: <Eye className="w-4 h-4" />,
                                      onClick: () => handlePreview(m),
                                    }] : []),
                                    {
                                      label: t("content.edit"),
                                      icon: <Edit3 className="w-4 h-4" />,
                                      onClick: () => setEditingMaterial(m),
                                    },
                                    {
                                      label: t("content.replace"),
                                      icon: <Replace className="w-4 h-4" />,
                                      onClick: () => setReplacingMaterial(m),
                                    },
                                    ...(m.type === "video" ? [{
                                      label: t("content.editCaptions"),
                                      icon: <Subtitles className="w-4 h-4" />,
                                      onClick: () => setCaptionEditingMaterial(m),
                                    }, {
                                      label: t("content.viewAnalytics"),
                                      icon: <BarChart3 className="w-4 h-4" />,
                                      onClick: () => setAnalyticsViewMaterial(m),
                                    }] : []),
                                    {
                                      label: t("content.versionHistory"),
                                      icon: <History className="w-4 h-4" />,
                                      onClick: () => setVersionHistoryMaterial(m),
                                    },
                                    {
                                      label: t("content.delete"),
                                      icon: <Trash2 className="w-4 h-4" />,
                                      onClick: () => setDeletingMaterial(m),
                                      danger: true,
                                    },
                                  ]}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Grid Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg disabled:opacity-50"
                          >
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          <span className="text-sm text-[var(--color-text-secondary)]">{currentPage} / {totalPages}</span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg disabled:opacity-50"
                          >
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          courses={courses}
          onClose={() => setShowUploadModal(false)}
          onUploaded={refetch}
          t={t}
        />
      )}
      {replacingMaterial && (
        <ReplaceModal
          material={replacingMaterial}
          onClose={() => setReplacingMaterial(null)}
          onReplaced={refetch}
          t={t}
        />
      )}
      {editingMaterial && (
        <EditModal
          material={editingMaterial}
          onClose={() => setEditingMaterial(null)}
          onUpdated={refetch}
          t={t}
        />
      )}
      {deletingMaterial && (
        <DeleteConfirm
          material={deletingMaterial}
          onClose={() => setDeletingMaterial(null)}
          onDeleted={refetch}
          t={t}
        />
      )}
      {captionEditingMaterial && (
        <CaptionEditor
          materialId={captionEditingMaterial.id}
          materialTitle={captionEditingMaterial.title}
          onClose={() => setCaptionEditingMaterial(null)}
          onSaved={refetch}
        />
      )}
      {versionHistoryMaterial && (
        <VersionHistoryPanel
          materialId={versionHistoryMaterial.id}
          materialTitle={versionHistoryMaterial.title}
          onClose={() => setVersionHistoryMaterial(null)}
          onRollback={refetch}
        />
      )}
      {analyticsViewMaterial && (
        <VideoRetentionChart
          materialId={analyticsViewMaterial.id}
          materialTitle={analyticsViewMaterial.title}
          onClose={() => setAnalyticsViewMaterial(null)}
        />
      )}
    </>
  );
};

export default ContentManagementContent;
