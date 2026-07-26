import type { MaterialType } from "@/types/instructor-dashboard";

/**
 * Material upload limits — kept in sync with the backend constants in
 * backends/src/modules/materials/materials.service.ts (SIZE_LIMITS,
 * ALLOWED_MIMES). If you change one, change both.
 *
 * The frontend uses these BEFORE the request goes out so users get an
 * instant, meaningful error instead of waiting for a 500 MB upload to
 * finish and then seeing "Upload failed". The server-side check is still
 * authoritative — clients can be spoofed.
 */

export const SIZE_LIMITS: Record<MaterialType, number> = {
  video: 500 * 1024 * 1024, // 500 MB
  pdf: 50 * 1024 * 1024, // 50 MB
  document: 50 * 1024 * 1024, // 50 MB
  image: 20 * 1024 * 1024, // 20 MB
};

/** Per-material-type allowed MIME types (mirrors backend). */
export const ALLOWED_MIMES_BY_TYPE: Record<MaterialType, string[]> = {
  video: [
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
  ],
  pdf: ["application/pdf"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

/** Flat list of every accepted MIME — used for the file-picker `accept` attribute. */
export const ALL_ALLOWED_MIMES: string[] = Array.from(
  new Set(
    (Object.values(ALLOWED_MIMES_BY_TYPE) as string[][]).flat(),
  ),
);

/** Detect the material type from a File's MIME. Returns null if unrecognised. */
export function detectMaterialType(file: File): MaterialType | null {
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
  ) {
    return "document";
  }
  return null;
}

/** Format bytes as "1.2 MB" / "500 MB" / "2 GB" — used in error messages + UI. */
export function formatFileSize(bytes: number | string): string {
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

/** Round bytes to a whole-MB integer — used in error messages when we want the raw number. */
export function bytesToMB(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

export type UploadValidationError =
  | { code: "unsupported_type" }
  | { code: "too_large"; sizeMB: number; limitMB: number; materialType: MaterialType }
  | { code: "type_mismatch"; expected: MaterialType; got: MaterialType | null };

export type UploadValidationResult =
  | { ok: true; materialType: MaterialType }
  | { ok: false; error: UploadValidationError };

/**
 * Validate a File the user picked (or a Replace target). Returns either
 * the detected material type on success, or a structured error the UI
 * can localize.
 */
export function validateUploadFile(
  file: File,
  opts?: { expectedType?: MaterialType },
): UploadValidationResult {
  const detected = detectMaterialType(file);

  if (!detected || !ALL_ALLOWED_MIMES.includes(file.type)) {
    return { ok: false, error: { code: "unsupported_type" } };
  }

  if (opts?.expectedType && detected !== opts.expectedType) {
    return {
      ok: false,
      error: { code: "type_mismatch", expected: opts.expectedType, got: detected },
    };
  }

  const limit = SIZE_LIMITS[detected];
  if (file.size > limit) {
    return {
      ok: false,
      error: {
        code: "too_large",
        sizeMB: bytesToMB(file.size),
        limitMB: bytesToMB(limit),
        materialType: detected,
      },
    };
  }

  return { ok: true, materialType: detected };
}
