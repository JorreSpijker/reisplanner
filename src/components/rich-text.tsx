"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

/**
 * Notitieveld met opmaak, op Tiptap.
 *
 * De HTML die hier ontstaat wordt alleen door Tiptap zelf weer getoond, nooit
 * ergens met `dangerouslySetInnerHTML` ingevoegd. Verandert dat ooit, dan moet
 * er eerst gesaneerd worden.
 */
export function RichText({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
      }),
    ],
    content: value,
    // Zonder dit rendert Tiptap al op de server en wijkt de HTML af bij hydratie.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // Expliciet wit: de editor staat ook op de grijze band van de
        // dagplanning en moet daar losstaan.
        class:
          "prose-notities min-h-24 rounded-b-md border border-t-0 border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Bij het wisselen van dagdeel moet de inhoud mee.
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-32 rounded-md border border-border-strong bg-surface-sunken" />
    );
  }

  return (
    <div className="flex flex-col">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const buttons = [
    {
      label: "B",
      title: "Vet",
      className: "font-bold",
      isActive: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "I",
      title: "Cursief",
      className: "italic",
      isActive: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Kop",
      title: "Kopje",
      className: "font-semibold",
      isActive: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "•",
      title: "Opsomming",
      className: "",
      isActive: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "1.",
      title: "Genummerde lijst",
      className: "",
      isActive: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="flex gap-1 rounded-t-md border border-border-strong bg-surface-raised px-2 py-1.5">
      {buttons.map((button) => (
        <button
          key={button.title}
          type="button"
          title={button.title}
          aria-label={button.title}
          aria-pressed={button.isActive}
          // Zonder dit haalt de knop de focus uit de editor weg en verliest de
          // gebruiker zijn cursorpositie.
          onMouseDown={(event) => event.preventDefault()}
          onClick={button.run}
          className={`min-w-7 rounded-sm px-1.5 py-0.5 text-xs hover:bg-surface-sunken pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
            button.className
          } ${button.isActive ? "bg-primary text-on-primary hover:bg-primary-hover" : ""}`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
