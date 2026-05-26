"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Variable, Info, Eye, Loader2 } from "lucide-react";
import type { EditorRef, EmailEditorProps } from "react-email-editor";
import { ActionBar } from "./TemplateEditorContent";
import EmailPreviewModal from "./EmailPreviewModal";
import type { TemplateDetail } from "@/lib/api";

// Unlayer is iframe-based and SSR-incompatible — dynamic import strips
// it from the server bundle.
const EmailEditor = dynamic(
  () => import("react-email-editor").then((m) => m.default),
  { ssr: false },
);

interface EmailTemplateEditorProps {
  detail: TemplateDetail;
  saving: boolean;
  resetting: boolean;
  onSave: (payload: {
    subject?: string | null;
    preheader?: string | null;
    body: string;
    designJson?: unknown | null;
  }) => Promise<void>;
  onReset: () => Promise<void>;
}

export default function EmailTemplateEditor({
  detail,
  saving,
  resetting,
  onSave,
  onReset,
}: EmailTemplateEditorProps) {
  const t = useTranslations("adminDashboard.templatesPage");
  const editorRef = useRef<EditorRef>(null);
  const [subject, setSubject] = useState(detail.subject ?? "");
  const [preheader, setPreheader] = useState(detail.preheader ?? "");
  const [editorReady, setEditorReady] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Build Unlayer merge tags from the registry variables. Tags use
  // `{{variableKey}}` so the substitution model matches what the
  // backend dispatcher will swap in at send time.
  const mergeTags = detail.meta.variables.reduce<
    Record<string, { name: string; value: string; sample: string }>
  >((acc, v) => {
    acc[v.key] = {
      name: v.label,
      value: `{{${v.key}}}`,
      sample: v.example,
    };
    return acc;
  }, {});

  const onEditorReady: EmailEditorProps["onReady"] = (unlayer) => {
    setEditorReady(true);
    // Preferred: load the previously-saved Unlayer design verbatim so
    // every block stays editable in its native form.
    if (detail.designJson && typeof detail.designJson === "object") {
      try {
        unlayer.loadDesign(
          detail.designJson as unknown as Parameters<typeof unlayer.loadDesign>[0],
        );
        return;
      } catch {
        // fall through to HTML pre-fill
      }
    }

    // Fallback: this template has no saved design yet (admin hasn't
    // edited it before). Pre-fill the canvas with the default body
    // HTML wrapped in a single HTML block, so the admin sees the
    // existing content to tweak instead of a blank slate.
    if (detail.body && detail.body.trim().length > 0) {
      try {
        unlayer.loadDesign(
          designFromHtml(detail.body) as unknown as Parameters<typeof unlayer.loadDesign>[0],
        );
      } catch {
        // ignore — leave the canvas blank if even the wrap fails
      }
    }
  };

  const handleSave = () => {
    const unlayer = editorRef.current?.editor;
    if (!unlayer) return;
    unlayer.exportHtml((data) => {
      const html = data.html;
      const design = data.design;
      void onSave({
        subject: subject.trim() ? subject.trim() : null,
        preheader: preheader.trim() ? preheader.trim() : null,
        body: html,
        designJson: design,
      });
    });
  };

  // Export current Unlayer HTML, then open the inbox-style preview
  // modal. The modal does the {{var}} → sample substitution.
  const handlePreview = () => {
    const unlayer = editorRef.current?.editor;
    if (!unlayer) return;
    setPreviewing(true);
    unlayer.exportHtml((data) => {
      setPreviewHtml(data.html);
      setPreviewing(false);
    });
  };

  const insertVariableIntoSubject = (varKey: string) => {
    setSubject((prev) => `${prev}{{${varKey}}}`);
  };

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Subject + preheader strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("preheader")}
          </label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder={t("preheaderPlaceholder")}
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Variables strip — clickable chips drop into the subject line */}
      <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
        <div className="flex items-start gap-2">
          <Variable className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("variablesTitle")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detail.meta.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariableIntoSubject(v.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-page)] text-[10px] font-mono text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                  title={`${v.label} — ${t("clickToInsertSubject")}`}
                >
                  <code>{`{{${v.key}}}`}</code>
                  <span className="text-[var(--color-text-secondary)] font-sans">
                    {v.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
              {t("variablesHint")}
            </p>
          </div>
        </div>
      </div>

      {/* Unlayer editor */}
      <div className="bg-white" style={{ height: "700px" }}>
        <EmailEditor
          ref={editorRef}
          onReady={onEditorReady}
          minHeight="700px"
          options={{
            mergeTags,
            features: { textEditor: { tables: true } },
            appearance: {
              theme: "light",
              panels: {
                tools: { dock: "left" as const },
              },
            },
          }}
        />
      </div>

      {!editorReady && (
        <div className="flex items-start gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[#FFFBEB]">
          <Info className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#92400E]">{t("editorLoadingHint")}</p>
        </div>
      )}

      {/* Action row — Preview lives next to Save/Reset so it's
          always visible without scrolling. */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing || !editorReady}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
        >
          {previewing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          {t("previewEmail")}
        </button>
        <ActionBar
          saving={saving}
          resetting={resetting}
          hasOverride={detail.hasOverride}
          onSave={handleSave}
          onReset={onReset}
        />
      </div>

      <EmailPreviewModal
        open={previewHtml !== null}
        onClose={() => setPreviewHtml(null)}
        subject={subject}
        preheader={preheader}
        bodyHtml={previewHtml ?? ""}
        variables={detail.meta.variables}
      />
    </div>
  );
}

/**
 * Wrap raw template HTML in a minimal Unlayer design so the editor
 * opens with the existing content visible and editable. The HTML
 * content-block ("html" type) is what shows up under the "Custom HTML"
 * tool in the right-hand panel — admins can replace it with text /
 * image / button blocks block-by-block from there.
 */
function designFromHtml(html: string): Record<string, unknown> {
  return {
    counters: { u_column: 1, u_row: 1, u_content_html: 1 },
    body: {
      id: "body",
      rows: [
        {
          id: "row-1",
          cells: [1],
          columns: [
            {
              id: "col-1",
              contents: [
                {
                  id: "html-1",
                  type: "html",
                  values: {
                    html,
                    hideDesktop: false,
                    hideMobile: false,
                    containerPadding: "10px",
                    _meta: { htmlID: "u_content_html_1", htmlClassNames: "u_content_html" },
                  },
                },
              ],
              values: {
                _meta: { htmlID: "u_column_1", htmlClassNames: "u_column" },
              },
            },
          ],
          values: {
            displayCondition: null,
            columns: false,
            backgroundColor: "",
            columnsBackgroundColor: "",
            backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
            padding: "0px",
            hideDesktop: false,
            hideMobile: false,
            noStackMobile: false,
            _meta: { htmlID: "u_row_1", htmlClassNames: "u_row" },
            selectable: true,
            draggable: true,
            duplicatable: true,
            deletable: true,
          },
        },
      ],
      values: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
        contentWidth: "600px",
        fontFamily: { label: "Arial", value: "arial,helvetica,sans-serif" },
        preheaderText: "",
        linkStyle: {
          body: true,
          linkColor: "#0000ee",
          linkHoverColor: "#0000ee",
          linkUnderline: true,
          linkHoverUnderline: true,
        },
        _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
      },
    },
    schemaVersion: 7,
  };
}
