"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  SUPPORT_ATTACH_ACCEPT,
  type SupportPendingAttachment,
} from "@/hooks/useSupportAttachmentUpload";

interface Props {
  pending: SupportPendingAttachment[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  maxCount: number;
  maxBytes: number;
  /** Visual density — chat surfaces stay compact, modals get a
   *  bit more breathing room. */
  compact?: boolean;
}

/**
 * Shared attach-files bar for the internal-collab surfaces (chat
 * panels, transfer modal, loop-in modal). Renders a "Attach files"
 * button + chip list of pending files with per-file status
 * (uploading spinner, done tick, error) and a remove-X on hover.
 *
 * Pair with the useSupportAttachmentUpload hook — the parent owns
 * upload state so it can gate its "send" button on `isUploading`
 * and pass `getDoneRich()` to the API.
 */
export default function AttachmentPickerBar({
  pending,
  onAdd,
  onRemove,
  disabled,
  maxCount,
  maxBytes,
  compact = false,
}: Props) {
  const t = useTranslations("supportDashboard.attachmentPicker");
  const inputRef = useRef<HTMLInputElement>(null);
  const atCap = pending.length >= maxCount;
  const btnDisabled = disabled || atCap;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={btnDisabled}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${compact ? "" : "px-3 py-1.5 text-xs"}`}
          title={
            atCap
              ? t("capReached", { max: maxCount })
              : t("attachHint", {
                  max: maxCount,
                  size: Math.round(maxBytes / (1024 * 1024)),
                })
          }
        >
          <Paperclip className="w-3.5 h-3.5" />
          {t("attachButton")}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORT_ATTACH_ACCEPT}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAdd(e.target.files);
              // Reset value so re-selecting the same file re-fires
              // the change handler (browsers don't refire onChange
              // for an identical selection otherwise).
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        {pending.length > 0 && (
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {t("countOfMax", {
              current: pending.length,
              max: maxCount,
            })}
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pending.map((att) => (
            <PickerChip
              key={att.id}
              att={att}
              onRemove={() => onRemove(att.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PickerChip({
  att,
  onRemove,
}: {
  att: SupportPendingAttachment;
  onRemove: () => void;
}) {
  const t = useTranslations("supportDashboard.attachmentPicker");
  const isImg = att.file.type.startsWith("image/");
  return (
    <div
      className={`group inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
        att.status === "error"
          ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-primary)]"
      }`}
      title={
        att.status === "error"
          ? att.errorMessage || t("uploadFailed")
          : att.file.name
      }
    >
      {isImg ? (
        <ImageIcon className="w-3 h-3 flex-shrink-0 text-[var(--color-text-secondary)]" />
      ) : (
        <FileText className="w-3 h-3 flex-shrink-0 text-[var(--color-text-secondary)]" />
      )}
      <span className="truncate max-w-[140px]">{att.file.name}</span>
      {att.status === "uploading" || att.status === "queued" ? (
        <Loader2 className="w-3 h-3 animate-spin text-[var(--color-text-secondary)]" />
      ) : att.status === "error" ? (
        <AlertTriangle className="w-3 h-3 text-[#DC2626]" />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("remove")}
        title={t("remove")}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-text-secondary)] hover:text-[#DC2626] transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
