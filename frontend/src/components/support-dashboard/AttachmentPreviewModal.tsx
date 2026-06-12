"use client";

import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";

export type PreviewableAttachment = {
  id?: string;
  url: string;
  filename: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  /** ISO timestamp — optional context shown in the modal footer. */
  uploadedAt?: string | null;
  /** Free-form name shown in "Uploaded by" caption. */
  uploadedBy?: string | null;
  scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
};

interface Props {
  attachment: PreviewableAttachment | null;
  /** Fired when the user actually downloads — used for audit logging. */
  onDownload?: (attachment: PreviewableAttachment) => void;
  onClose: () => void;
}

/** Returns true when the file can be rendered inline in the modal. */
export function isPreviewable(att: {
  mimeType?: string | null;
  filename?: string | null;
  url: string;
}): boolean {
  const mime = (att.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  // Last-resort filename sniff for legacy rows where mimeType wasn't
  // captured (sizeBytes default was -1, mime can be null on older
  // attachments). Conservative — only the formats we know browsers
  // render natively.
  const lower = (att.filename ?? att.url).toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
}

export default function AttachmentPreviewModal({
  attachment,
  onDownload,
  onClose,
}: Props) {
  const t = useTranslations("supportDashboard.attachmentPreview");
  const locale = useLocale();

  // ESC closes — match the rest of the modal stack.
  useEffect(() => {
    if (!attachment) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const isImage = (attachment.mimeType ?? "").toLowerCase().startsWith("image/");
  const isPdf = (() => {
    const mime = (attachment.mimeType ?? "").toLowerCase();
    if (mime === "application/pdf") return true;
    const lower = (attachment.filename ?? attachment.url).toLowerCase();
    return lower.endsWith(".pdf");
  })();

  const blocked = attachment.scanStatus === "quarantined";

  const handleDownload = () => {
    if (blocked) return;
    onDownload?.(attachment);
    // Open the storage URL in a new tab — the browser will save (PDF)
    // or display (image). We rely on Content-Disposition headers from
    // the storage layer; if absent, the OS handles it as a download.
    window.open(attachment.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {attachment.filename ?? t("untitled")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)]"
            aria-label={t("close")}
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Body — renders the actual preview content */}
        <div className="flex-1 min-h-0 overflow-auto bg-[#0F172A] flex items-center justify-center">
          {blocked ? (
            <div className="text-center p-8 text-white">
              <AlertTriangle className="w-10 h-10 text-[#FCA5A5] mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">
                {t("blockedTitle")}
              </p>
              <p className="text-xs text-white/70">{t("blockedBody")}</p>
            </div>
          ) : isImage ? (
            <img
              src={attachment.url}
              alt={attachment.filename ?? "attachment"}
              className="max-w-full max-h-[80vh] object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={attachment.url}
              title={attachment.filename ?? "PDF preview"}
              className="w-full h-[80vh] bg-white"
            />
          ) : (
            <div className="text-center p-8 text-white">
              <FileText className="w-10 h-10 text-white/60 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">
                {t("unsupportedTitle")}
              </p>
              <p className="text-xs text-white/70 mb-4">
                {t("unsupportedBody")}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white text-[var(--color-text-primary)] text-sm font-semibold rounded-lg"
              >
                <Download className="w-4 h-4" />
                {t("download")}
              </button>
            </div>
          )}
        </div>

        {/* Footer — metadata + actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-t border-[var(--color-border)] flex-wrap">
          <div className="text-[11px] text-[var(--color-text-secondary)] flex flex-wrap gap-x-3 gap-y-0.5 min-w-0">
            {attachment.sizeBytes != null &&
              attachment.sizeBytes > 0 && (
                <span>{formatBytes(attachment.sizeBytes)}</span>
              )}
            {attachment.mimeType && (
              <span className="uppercase tracking-wide">
                {attachment.mimeType}
              </span>
            )}
            {attachment.uploadedBy && (
              <span>{t("uploadedBy", { name: attachment.uploadedBy })}</span>
            )}
            {attachment.uploadedAt && (
              <span>{formatDate(attachment.uploadedAt, locale)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onDownload?.(attachment)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("openInNewTab")}
            </a>
            <button
              type="button"
              onClick={handleDownload}
              disabled={blocked}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-[var(--color-primary)] rounded-lg disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {t("download")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
