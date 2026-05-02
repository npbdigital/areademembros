"use client";

import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect, useState } from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Pilcrow,
  Strikethrough,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { videoEmbedUrl } from "@/lib/community";
import { VideoEmbed } from "@/lib/tiptap-video-embed";

interface RichTextEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  /**
   * Quando passado, habilita botão de upload de imagem na toolbar.
   * A função recebe o File e devolve a URL pública pra inserir no editor.
   */
  uploadImage?: (file: File) => Promise<string>;
}

export function RichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Comece a escrever...",
  uploadImage,
}: RichTextEditorProps) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-npb-gold underline hover:text-npb-gold-light",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-md border border-npb-border my-3 max-w-full h-auto",
        },
      }),
      VideoEmbed,
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          "community-html max-w-none min-h-[200px] px-4 py-3 text-sm text-npb-text focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    immediatelyRender: false,
  });

  // Sync external defaultValue change (rare, but keeps form reset coherent)
  useEffect(() => {
    if (editor && defaultValue !== editor.getHTML()) {
      editor.commands.setContent(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  return (
    <div className="rounded-md border border-npb-border bg-npb-bg3">
      <Toolbar editor={editor} uploadImage={uploadImage} />
      <div className="border-t border-npb-border">
        {editor ? (
          <EditorContent editor={editor} placeholder={placeholder} />
        ) : (
          <div className="px-4 py-3 text-sm text-npb-text-muted">
            Carregando editor...
          </div>
        )}
      </div>
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({
  editor,
  uploadImage,
}: {
  editor: Editor | null;
  uploadImage?: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);

  if (!editor) {
    return <div className="h-10 bg-npb-bg2" />;
  }

  async function handleUpload(file: File) {
    if (!uploadImage || !editor) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-npb-bg2">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Negrito"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Itálico"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Tachado"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Parágrafo"
      >
        <Pilcrow className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Título grande (H1)"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Subtítulo (H2)"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Subtítulo menor (H3)"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Lista"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Lista numerada"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL do link:", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        label="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      {uploadImage && (
        <label
          title={uploading ? "Enviando…" : "Inserir imagem"}
          className={cn(
            "flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors",
            uploading
              ? "text-npb-gold"
              : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
          )}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
      <ToolbarButton
        onClick={() => {
          const url = window.prompt(
            "Cole a URL do YouTube ou Vimeo:",
            "https://",
          );
          if (!url) return;
          const embed = videoEmbedUrl(url);
          if (!embed) {
            toast.error("URL não reconhecida (use YouTube ou Vimeo).");
            return;
          }
          editor.chain().focus().setVideoEmbed({ src: embed }).run();
        }}
        label="Inserir vídeo (YouTube/Vimeo)"
      >
        <Video className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        label="Desfazer"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-npb-gold/20 text-npb-gold"
          : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-4 w-px bg-npb-border" />;
}
