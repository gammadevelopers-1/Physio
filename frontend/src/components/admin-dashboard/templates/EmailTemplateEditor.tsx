"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Variable, Info } from "lucide-react";
import type { EditorRef, EmailEditorProps } from "react-email-editor";
import { ActionBar } from "./TemplateEditorContent";
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
    // Load existing design if we have one; otherwise leave the canvas blank.
    if (detail.designJson && typeof detail.designJson === "object") {
      try {
        unlayer.loadDesign(detail.designJson as unknown as Parameters<typeof unlayer.loadDesign>[0]);
      } catch {
        // ignore — fresh canvas
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

      <ActionBar
        saving={saving}
        resetting={resetting}
        hasOverride={detail.hasOverride}
        onSave={handleSave}
        onReset={onReset}
      />
    </div>
  );
}
