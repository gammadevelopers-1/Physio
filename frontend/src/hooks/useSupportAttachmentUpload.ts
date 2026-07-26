"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { uploadFormData } from "@/lib/api";

// Kept in sync with the storage.controller.ts /storage/upload
// fileFilter allowlist. If they diverge, the client will queue
// files the server rejects (or vice-versa).
export const SUPPORT_ATTACH_MIME_ALLOWLIST = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const SUPPORT_ATTACH_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx," +
  "application/pdf,image/jpeg,image/png,image/webp," +
  "application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type SupportPendingAttachment = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  errorMessage?: string;
};

type Options = {
  maxCount?: number;
  maxBytes?: number;
};

/**
 * Shared upload state for the internal-collab surfaces (chat panels,
 * transfer, loop-in). Handles queueing, per-file upload status,
 * client-side mime/size validation, and dedup on filename+size.
 *
 * Pairs with `<AttachmentPickerBar />` in
 * support-shared/AttachmentPickerBar.tsx.
 *
 * Kept separate from the main ticket-reply upload flow in
 * TicketDetailContent to avoid destabilising an already-shipped path;
 * the two share the same underlying `/storage/upload` endpoint.
 */
export function useSupportAttachmentUpload(opts: Options = {}) {
  const maxCount = opts.maxCount ?? 10;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;

  const [pending, setPending] = useState<SupportPendingAttachment[]>([]);
  // Latest-value ref for the count check inside addFiles so a burst of
  // rapid drops doesn't blow past `maxCount` — React state is stale
  // for a few ms between renders.
  const pendingRef = useRef<SupportPendingAttachment[]>(pending);
  pendingRef.current = pending;

  const uploadOne = useCallback(async (att: SupportPendingAttachment) => {
    setPending((curr) =>
      curr.map((a) =>
        a.id === att.id ? { ...a, status: "uploading" as const } : a,
      ),
    );
    try {
      const fd = new FormData();
      fd.append("file", att.file);
      const data = await uploadFormData<{ url: string; filename: string }>(
        "/storage/upload",
        fd,
      );
      setPending((curr) =>
        curr.map((a) =>
          a.id === att.id
            ? { ...a, status: "done" as const, url: data.url }
            : a,
        ),
      );
    } catch (err) {
      setPending((curr) =>
        curr.map((a) =>
          a.id === att.id
            ? {
                ...a,
                status: "error" as const,
                errorMessage:
                  err instanceof Error ? err.message : String(err),
              }
            : a,
        ),
      );
    }
  }, []);

  type AddResult = {
    accepted: number;
    rejectedType: string[];
    rejectedSize: string[];
    rejectedCap: string[];
  };

  const addFiles = useCallback(
    (files: FileList | File[]): AddResult => {
      const list = Array.from(files);
      const result: AddResult = {
        accepted: 0,
        rejectedType: [],
        rejectedSize: [],
        rejectedCap: [],
      };
      const accepted: SupportPendingAttachment[] = [];
      for (const file of list) {
        if (pendingRef.current.length + accepted.length >= maxCount) {
          result.rejectedCap.push(file.name);
          continue;
        }
        if (!SUPPORT_ATTACH_MIME_ALLOWLIST.has(file.type)) {
          result.rejectedType.push(file.name);
          continue;
        }
        if (file.size > maxBytes) {
          result.rejectedSize.push(file.name);
          continue;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          status: "queued",
        });
      }
      result.accepted = accepted.length;
      if (accepted.length > 0) {
        setPending((curr) => [...curr, ...accepted]);
        for (const att of accepted) void uploadOne(att);
      }
      return result;
    },
    [maxCount, maxBytes, uploadOne],
  );

  const remove = useCallback((id: string) => {
    setPending((curr) => curr.filter((a) => a.id !== id));
  }, []);

  const clear = useCallback(() => setPending([]), []);

  const isUploading = useMemo(
    () =>
      pending.some((a) => a.status === "queued" || a.status === "uploading"),
    [pending],
  );

  /**
   * Serializable payload for the API. Returns only DONE items — the
   * caller should refuse to submit while `isUploading` is true.
   */
  const getDoneRich = useCallback((): {
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }[] => {
    return pending
      .filter((a) => a.status === "done" && a.url)
      .map((a) => ({
        url: a.url!,
        filename: a.file.name,
        mimeType: a.file.type,
        sizeBytes: a.file.size,
      }));
  }, [pending]);

  return {
    pending,
    addFiles,
    remove,
    clear,
    isUploading,
    getDoneRich,
    maxCount,
    maxBytes,
  };
}
