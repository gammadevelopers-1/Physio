"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Lock,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { isPreviewable } from "./AttachmentPreviewModal";
import ConfirmDialog from "@/components/support-shared/ConfirmDialog";

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
 * Universal attachment renderer. Uniform chip size (~56px tall) for
 * every type — image, PDF, or other — so a row of attachments stays
 * visually tidy.
 *
 *   image/*           → 56x56 thumbnail + filename + size
 *   application/pdf   → red-tinted PDF icon + filename + size
 *   everything else   → generic file icon + filename + size
 *
 * Quarantined files render as a blocked chip with no click action,
 * regardless of mime type.
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

  // Chat-thread variant — uniform compact card for every type.
  if (inChat && !blocked) {
    return (
      <ChatUniformChip
        attachment={attachment}
        isImage={isImage}
        isPdf={isPdf}
        onClick={handleClick}
        onRemove={onRemove}
        scan={scan}
      />
    );
  }

  // Default / fallback / non-previewable / quarantined chip.
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

// ─── Uniform chat-thread chip (240×56 across all types) ─────

function ChatUniformChip({
  attachment,
  isImage,
  isPdf,
  onClick,
  onRemove,
  scan,
}: {
  attachment: Attachment;
  isImage: boolean;
  isPdf: boolean;
  onClick: (e: React.MouseEvent) => void;
  onRemove?: (attachment: Attachment) => void;
  scan: ScanStatus;
}) {
  const t = useTranslations("supportDashboard.attachmentChip");
  const label = (() => {
    if (isImage) return "IMAGE";
    if (isPdf) return "PDF";
    const ext = (attachment.filename ?? attachment.url).split(".").pop();
    return ext ? ext.toUpperCase() : "FILE";
  })();

  return (
    <div className="inline-block relative group align-top">
      <button
        type="button"
        onClick={(e) => onClick(e)}
        className="inline-flex items-center gap-3 w-[240px] h-[56px] px-2.5 py-2 border border-[var(--color-border)] bg-white rounded-lg hover:border-[var(--color-primary)] hover:shadow-sm transition-all text-start"
      >
        {/* Left tile — same 40×40 frame for every type */}
        <div
          className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center ${
            isImage
              ? "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              : isPdf
                ? "bg-[#FEE2E2]"
                : "bg-[var(--color-bg-secondary)]"
          }`}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.filename ?? "image"}
              className="w-10 h-10 object-cover"
              loading="lazy"
            />
          ) : isPdf ? (
            <FileText className="w-5 h-5 text-[#DC2626]" />
          ) : (
            <FileText className="w-5 h-5 text-[var(--color-text-secondary)]" />
          )}
        </div>

        {/* Right text block */}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate leading-tight">
            {attachment.filename ?? t("untitled")}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mt-0.5">
            {label}
            {attachment.sizeBytes != null && attachment.sizeBytes > 0 && (
              <> · {formatBytes(attachment.sizeBytes)}</>
            )}
          </div>
        </div>
      </button>

      {/* Scan status badge (only when not clean/unknown) */}
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

// ─── Default compact chip (header / fallback / quarantined) ─

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

// ─── Remove button + shadcn confirm dialog ──────────────────

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
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        className={
          corner
            ? "absolute -top-2 -end-2 w-6 h-6 rounded-full bg-white border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[#DC2626] hover:border-[#DC2626] hover:bg-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
            : "p-1 text-[var(--color-text-secondary)] hover:text-[#DC2626]"
        }
        aria-label={t("remove")}
        title={t("remove")}
      >
        <X className="w-3 h-3" />
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmDescription", {
          name: attachment.filename ?? t("untitled"),
        })}
        confirmLabel={t("remove")}
        destructive
        onConfirm={() => onRemove(attachment)}
      />
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
