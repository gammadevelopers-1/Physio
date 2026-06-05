"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  Undo2,
  Redo2,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  minHeight?: number;
  /**
   * Optional image upload handler. Receives a File the user picked and
   * must return the public URL of the uploaded image. When provided,
   * an Image button is added to the toolbar that opens a file picker.
   */
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  dir = "ltr",
  minHeight = 140,
  onImageUpload,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        // Tiptap's Image extension renders inline by default — switching
        // to block so images don't disrupt prose flow on resize.
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2",
        dir,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes into editor
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current && !(next === "" && current === "<p></p>")) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({
    onClick,
    isActive,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-[#F3F4F6] transition-colors ${
        isActive ? "bg-[var(--color-border)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-[var(--color-input-border)] rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-[var(--color-input-border)] bg-[var(--color-surface-page)]">
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </Btn>
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </Btn>
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </Btn>
        {onImageUpload && (
          <>
            <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
            <Btn
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Insert image"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </Btn>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setIsUploading(true);
                try {
                  const url = await onImageUpload(file);
                  if (url) {
                    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
                  }
                } catch {
                  // Caller is expected to surface a toast — swallow here.
                } finally {
                  setIsUploading(false);
                }
              }}
            />
          </>
        )}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </Btn>
      </div>

      {/* Editor */}
      <div
        className="text-sm text-[var(--color-text-primary)] tiptap-content"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Placeholder styles */}
      <style jsx global>{`
        .tiptap-content .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--color-text-secondary);
          pointer-events: none;
          height: 0;
        }
        .tiptap-content .ProseMirror:focus {
          outline: none;
        }
        .tiptap-content .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0.5em 0 0.25em;
        }
        .tiptap-content .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.5em 0 0.25em;
        }
        .tiptap-content .ProseMirror h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0.5em 0 0.25em;
        }
        .tiptap-content .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.25em 0;
        }
        .tiptap-content .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin: 0.25em 0;
        }
        .tiptap-content .ProseMirror blockquote {
          border-left: 3px solid var(--color-border);
          padding-left: 1rem;
          margin: 0.5em 0;
          color: var(--color-text-secondary);
          font-style: italic;
        }
        .tiptap-content .ProseMirror[dir="rtl"] ul,
        .tiptap-content .ProseMirror[dir="rtl"] ol {
          padding-left: 0;
          padding-right: 1.5rem;
        }
        .tiptap-content .ProseMirror[dir="rtl"] blockquote {
          border-left: none;
          border-right: 3px solid var(--color-border);
          padding-left: 0;
          padding-right: 1rem;
        }
        .tiptap-content .ProseMirror img.tiptap-image,
        .tiptap-content .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.75em 0;
          display: block;
        }
        .tiptap-content .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid var(--color-primary);
        }
      `}</style>
    </div>
  );
}
