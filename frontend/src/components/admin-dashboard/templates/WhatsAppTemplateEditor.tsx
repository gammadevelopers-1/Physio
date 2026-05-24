"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Variable, MessageCircle, Eye } from "lucide-react";
import { ActionBar } from "./TemplateEditorContent";
import type { TemplateDetail } from "@/lib/api";

interface WhatsAppTemplateEditorProps {
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

/**
 * WhatsApp templates are plain text — no HTML, no blocks. A drag-drop
 * builder doesn't apply. We give the admin a single bilingual textarea
 * (since both WhatsApp messages today bundle EN + AR in one body) and
 * a live preview that resolves variables with example values.
 */
export default function WhatsAppTemplateEditor({
  detail,
  saving,
  resetting,
  onSave,
  onReset,
}: WhatsAppTemplateEditorProps) {
  const t = useTranslations("adminDashboard.templatesPage");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(detail.body || "");

  const handleSave = () => {
    void onSave({
      subject: null,
      preheader: null,
      body,
      designJson: null,
    });
  };

  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const insert = `{{${varKey}}}`;
    const next = `${before}${insert}${after}`;
    setBody(next);
    // restore caret after the insertion
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  // Live preview — substitute each {{key}} with its example value.
  const preview = detail.meta.variables.reduce(
    (acc, v) => acc.split(`{{${v.key}}}`).join(v.example),
    body,
  );

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Variables strip */}
      <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
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
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[10px] font-mono text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                  title={`${v.label} — ${t("clickToInsertBody")}`}
                >
                  <code>{`{{${v.key}}}`}</code>
                  <span className="text-[var(--color-text-secondary)] font-sans">
                    {v.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
              {t("whatsappVariablesHint")}
            </p>
          </div>
        </div>
      </div>

      {/* Editor + Preview side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Editor */}
        <div className="p-5 border-b lg:border-b-0 lg:border-e border-[var(--color-border)]">
          <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider">
            {t("messageBody")}
          </label>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            placeholder={t("whatsappPlaceholder")}
            className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:border-[var(--color-primary)] resize-y"
            dir="ltr"
          />
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
            {t("whatsappEditorHint")}
          </p>
        </div>

        {/* Preview */}
        <div className="p-5 bg-[var(--color-surface-page)]">
          <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {t("livePreview")}
          </label>
          {/* WhatsApp-style bubble */}
          <div className="bg-[#E5DDD5] rounded-lg p-4 min-h-[400px]">
            <div className="bg-white rounded-lg shadow-sm p-3 max-w-md ms-auto">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#ECE5DD]">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[#075E54]">
                  WhatsApp
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-words text-sm text-[#303030] font-sans leading-relaxed">
                {preview || (
                  <span className="text-gray-400 italic">
                    {t("whatsappEmptyPreview")}
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>

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
