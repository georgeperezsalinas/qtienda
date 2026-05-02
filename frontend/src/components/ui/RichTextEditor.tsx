"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, Italic, List, ListOrdered, Eraser,
  Heading2,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        style: [
          "min-height:96px",
          "padding:12px 14px",
          "outline:none",
          "font-size:14px",
          "line-height:1.65",
          "color:var(--ink)",
          "font-family:var(--font-dm)",
        ].join(";"),
      },
    },
    immediatelyRender: false,
  });

  /* Sincroniza el valor cuando cambia desde afuera (ej. abrir otro producto) */
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  function Btn({
    onClick, active, title, children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        title={title}
        className="w-8 h-7 rounded-lg flex items-center justify-center transition-colors"
        style={{
          background: active ? "var(--brand-100)" : "transparent",
          color: active ? "var(--brand-700)" : "var(--ink-2)",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1.5px solid #E2E8F0", background: "var(--surface-0)" }}
      onClick={() => editor.commands.focus()}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: "1px solid #F1F5F9", background: "var(--surface-1)" }}
      >
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Negrita"
        >
          <Bold size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Cursiva"
        >
          <Italic size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Subtítulo"
        >
          <Heading2 size={14} />
        </Btn>

        <div className="w-px h-4 mx-1" style={{ background: "#E2E8F0" }} />

        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Lista con viñetas"
        >
          <List size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Lista numerada"
        >
          <ListOrdered size={14} />
        </Btn>

        <div className="w-px h-4 mx-1" style={{ background: "#E2E8F0" }} />

        <Btn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Limpiar formato"
        >
          <Eraser size={14} />
        </Btn>
      </div>

      {/* Área de edición */}
      <div className="rte-body">
        <EditorContent editor={editor} />
        {!value && (
          <p
            className="absolute top-0 left-0 px-4 py-3 text-sm pointer-events-none select-none"
            style={{ color: "var(--ink-3)" }}
          >
            {placeholder ?? "Talla, material, colores, variantes..."}
          </p>
        )}
      </div>
    </div>
  );
}
