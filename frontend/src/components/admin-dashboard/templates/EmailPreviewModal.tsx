"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Monitor, Smartphone } from "lucide-react";

interface Variable {
  key: string;
  label: string;
  example: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subject: string;
  preheader: string;
  bodyHtml: string;
  variables: Variable[];
  /** Friendly "from" line shown at the top — defaults to PhysioGuidance. */
  fromName?: string;
  fromEmail?: string;
}

/**
 * Substitute every `{{key}}` in `input` with the matching variable's
 * `example` value. Unknown keys are kept intact so an admin typo is
 * obvious in the preview.
 */
function substitute(input: string, vars: Variable[]): string {
  const map = new Map(vars.map((v) => [v.key, v.example]));
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key) => {
    return map.has(key) ? (map.get(key) as string) : full;
  });
}

export default function EmailPreviewModal({
  open,
  onClose,
  subject,
  preheader,
  bodyHtml,
  variables,
  fromName = "PhysioGuidance",
  fromEmail = "no-reply@physioguidance.org",
}: Props) {
  const t = useTranslations("adminDashboard.templatesPage");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  // Substitute sample values into subject / preheader / body so the
  // preview reads like a real inbox message.
  const rendered = useMemo(() => {
    return {
      subject: substitute(subject || "(no subject)", variables),
      preheader: substitute(preheader, variables),
      body: substitute(bodyHtml || "", variables),
    };
  }, [subject, preheader, bodyHtml, variables]);

  // Write the rendered HTML into the iframe each time it changes.
  useEffect(() => {
    if (!open) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(rendered.body);
    doc.close();
  }, [open, rendered.body]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--color-surface-page)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              {t("previewTitle")}
            </p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {t("previewSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 ${
                  device === "desktop"
                    ? "bg-[var(--color-text-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> {t("previewDesktop")}
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 ${
                  device === "mobile"
                    ? "bg-[var(--color-text-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> {t("previewMobile")}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--color-border-subtle)]"
              aria-label="Close preview"
            >
              <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Inbox-style email header */}
        <div className="px-6 py-4 bg-[var(--color-surface-card)] border-b border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold flex-shrink-0">
              P
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {rendered.subject}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                <span className="font-medium text-[var(--color-text-primary)]">
                  {fromName}
                </span>{" "}
                &lt;{fromEmail}&gt;
              </p>
              {rendered.preheader && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 italic line-clamp-1">
                  {rendered.preheader}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rendered email body inside an iframe so its styles don't
            leak into the admin app's stylesheet. The iframe is
            constrained to a "mobile" width when that device is
            selected — same visual model as Unlayer's own preview. */}
        <div className="flex-1 overflow-auto bg-[#E5E7EB] p-4 flex justify-center">
          <iframe
            ref={iframeRef}
            title="email-preview"
            className="bg-white shadow-lg transition-all"
            style={{
              width: device === "desktop" ? "100%" : "390px",
              maxWidth: device === "desktop" ? "720px" : "390px",
              height: "100%",
              minHeight: "520px",
              border: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
