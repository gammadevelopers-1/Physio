"use client";

import { useTranslations } from "next-intl";
import {
  FileText,
  Lock,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { isPreviewable } from "./AttachmentPreviewModal";

type ScanStatus = "clean" | "pending" | "quarantined" | "unknown";

export type Attachment = {
  id?: string;
  url: string;
  filename: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  scanStatus?: ScanStatus;
};

interface Props {
  attachment: Attachment;
  /** Renders the chip in the compact chat-thread style with image
   *  thumbnail / PDF card / fallback chip. When `false` (default),
   *  renders a single-line ticket-header chip. */
  inChat?: boolean;
  /** Click-to-preview handler. When provided AND the file is
   *  previewable, clicks open the preview modal instead of the
   *  storage URL directly. */
  onPreview?: (attachment: Attachment) => void;
  /** Audit hook fired when the user actually downloads (clicks the
   *  raw URL in fallback mode). */
  onDownload?: (attachment: Attachment) => void;
  /** When provided, a staff-only "remove" button appears on the chip. */
  onRemove?: (attachment: Attachment) => void;
}

/**
 * Universal attachment renderer. Three modes depending on type:
 *
 *   image/* → inline thumbnail (160x160 max)
 *   application/pdf → compact "PDF card" (icon + filename + size)
 *   everything else → traditional chip (link + filename + size)
 *
 * Quarantined files render as a blocked chip with no click action,
 * regardless of mode.
 */
export default function AttachmentChip({
  attachment,
  inChat = false,
  onPreview,
  onDownload,
  onRemove,
}: Props) {
  const t = useTranslations("supportDashboard.attachmentChip");
  const scan = attachment.scanStatus ?? "unknown";
  const blocked = scan === "quarantined";
  const isImage = (attachment.mimeType ?? "").toLowerCase().startsWith("image/");
  const isPdf = (() => {
    const mime = (attachment.mimeType ?? "").toLowerCase();
    if (mime === "application/pdf") return true;
    return (attachment.filename ?? attachment.url).toLowerCase().endsWith(".pdf");
  })();
  const previewable = !blocked && isPreviewable(attachment);

  // The click handler: route to preview if possible, else direct
  // download. Either way we audit when the user accesses the file.
  const handleClick = (e: React.MouseEvent) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    if (previewable && onPreview) {
      e.preventDefault();
      onPreview(attachment);
      return;
    }
    // Falling through to the native link click — fire the download
    // audit before the browser navigates.
    onDownload?.(attachment);
  };

  // Chat-thread variant — type-aware rich render
  if (inChat) {
    if (isImage && !blocked) {
      return (
        <ChatImageChip
          attachment={attachment}
          onClick={handleClick}
          onRemove={onRemove}
          scan={scan}
        />
      );
    }
    if (isPdf && !blocked) {
      return (
        <ChatPdfChip
          attachment={attachment}
          onClick={handleClick}
          onRemove={onRemove}
          scan={scan}
        />
      );
    }
    // Other types (or quarantined) fall through to the compact chip.
  }

  // Default / fallback / non-previewable chip
  return (
    <CompactChip
      attachment={attachment}
      blocked={blocked}
      scan={scan}
      onClick={handleClick}
      onRemove={onRemove}
      previewable={previewable}
      t={t}
    />
  );
}

// ─── Chat-thread image thumbnail ────────────────────────────

function ChatImageChip({
  attachment,
  onClick,
  onRemove,
  scan,
}: {
  attachment: Attachment;
  onClick: (e: React.MouseEvent) => void;
  onRemove?: (attachment: Attachment) => void;
  scan: ScanStatus;
}) {
  return (
    <div className="inline-block relative group">
      <button
        type="button"
        onClick={(e) => onClick(e)}
        className="block max-w-[200px] max-h-[200px] rounded-lg overflow-hidden border border-[var(--color-border)] bg-white hover:opacity-90 transition-opacity"
      >
        <img
          src={attachment.url}
          alt={attachment.filename ?? "image"}
          className="max-w-[200px] max-h-[200px] object-cover"
          loading="lazy"
        />
      </button>
      {/* Tiny scan-status corner badge (only when not clean) */}
      {scan !== "clean" && scan !== "unknown" && (
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/95 border border-[var(--color-border)]">
          {scan}
        </span>
      )}
      {onRemove && (
        <RemoveButton attachment={attachment} onRemove={onRemove} corner />
      )}
    </div>
  );
}

// ─── Chat-thread PDF card ────────────────────────────────────

function ChatPdfChip({
  attachment,
  onClick,
  onRemove,
  scan,
}: {
  attachment: Attachment;
  onClick: (e: React.MouseEvent) => void;
  onRemove?: (attachment: Attachment) => void;
  scan: ScanStatus;
}) {
  const t = useTranslations("supportDashboard.attachmentChip");
  return (
    <div className="inline-block relative group">
      <button
        type="button"
        onClick={(e) => onClick(e)}
        className="inline-flex items-center gap-3 max-w-xs px-3 py-2.5 border border-[var(--color-border)] bg-white rounded-lg hover:border-[var(--color-primary)] transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-[#DC2626]" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
            {attachment.filename ?? t("untitled")}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
            PDF
            {attachment.sizeBytes != null && attachment.sizeBytes > 0 && (
              <> · {formatBytes(attachment.sizeBytes)}</>
            )}
          </div>
        </div>
      </button>
      {scan !== "clean" && scan !== "unknown" && (
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-[var(--color-border)]">
          {scan}
        </span>
      )}
      {onRemove && (
        <RemoveButton attachment={attachment} onRemove={onRemove} corner />
      )}
    </div>
  );
}

// ─── Default compact chip ───────────────────────────────────

function CompactChip({
  attachment,
  blocked,
  scan,
  onClick,
  onRemove,
  previewable,
  t,
}: {
  attachment: Attachment;
  blocked: boolean;
  scan: ScanStatus;
  onClick: (e: React.MouseEvent) => void;
  onRemove?: (attachment: Attachment) => void;
  previewable: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const ScanIcon: LucideIcon =
    scan === "clean"
      ? ShieldCheck
      : scan === "pending"
        ? Loader2
        : scan === "quarantined"
          ? Lock
          : FileText;
  const scanTone =
    scan === "clean"
      ? "text-[#15803D]"
      : scan === "pending"
        ? "text-[#92400E] animate-spin"
        : scan === "quarantined"
          ? "text-[#991B1B]"
          : "text-[var(--color-text-secondary)]";
  return (
    <div className="inline-flex items-center gap-1.5 relative">
      <a
        href={blocked ? undefined : attachment.url}
        target={previewable ? undefined : "_blank"}
        rel="noopener noreferrer"
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border ${
          blocked
            ? "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] cursor-not-allowed"
            : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] text-[var(--color-text-primary)]"
        }`}
      >
        <ScanIcon className={`w-3.5 h-3.5 flex-shrink-0 ${scanTone}`} />
        <span className="truncate max-w-[200px]">
          {attachment.filename ?? t("untitled")}
        </span>
        {attachment.sizeBytes != null && attachment.sizeBytes > 0 && (
          <span className="text-[10px] text-[var(--color-text-secondary)] flex-shrink-0">
            {formatBytes(attachment.sizeBytes)}
          </span>
        )}
      </a>
      {onRemove && !blocked && (
        <RemoveButton attachment={attachment} onRemove={onRemove} />
      )}
    </div>
  );
}

function RemoveButton({
  attachment,
  onRemove,
  corner = false,
}: {
  attachment: Attachment;
  onRemove: (att: Attachment) => void;
  corner?: boolean;
}) {
  const t = useTranslations("supportDashboard.attachmentChip");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(t("removeConfirm"))) {
          onRemove(attachment);
        }
      }}
      className={
        corner
          ? "absolute top-1 right-1 p-1 rounded-md bg-white/90 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 transition-opacity"
          : "p-1 text-[var(--color-text-secondary)] hover:text-[#DC2626]"
      }
      aria-label={t("remove")}
      title={t("remove")}
    >
      <Trash2 className="w-3 h-3" />
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
