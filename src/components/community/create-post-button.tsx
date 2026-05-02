"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPostAction,
  uploadPostImageAction,
} from "@/app/(student)/community/actions";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface Props {
  pageId: string;
  pageTitle: string;
  /**
   * Quando passado, opera em modo de edição: pré-preenche título/body/vídeo
   * e, no submit, chama editPostAction em vez de createPostAction.
   */
  editing?: {
    topicId: string;
    title: string;
    bodyHtml: string;
    videoUrl: string | null;
  };
  /** Trigger custom (substitui o botão "+ Nova publicação" padrão). */
  trigger?: React.ReactNode;
}

export function CreatePostButton({
  pageId,
  pageTitle,
  editing,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light"
        >
          <Plus className="h-4 w-4" />
          Nova publicação
        </button>
      )}
      {open && (
        <PostModal
          pageId={pageId}
          pageTitle={pageTitle}
          editing={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function PostModal({
  pageId,
  pageTitle,
  editing,
  onClose,
}: {
  pageId: string;
  pageTitle: string;
  editing?: Props["editing"];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /** Upload pra Supabase Storage; retorna URL pública. */
  async function uploadImage(file: File): Promise<string> {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Imagem maior que 10MB.");
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadPostImageAction(fd);
    if (!res.ok || !res.data) {
      throw new Error(res.error ?? "Falha no upload.");
    }
    return res.data.url;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Preencha o título.");
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("page_id", pageId);
    fd.set("title", title.trim());
    if (editing?.topicId) fd.set("topic_id", editing.topicId);
    startTransition(async () => {
      // Importação dinâmica pra evitar circular dep no editPostAction
      const { editPostAction } = await import(
        "@/app/(student)/community/actions"
      );
      const res = editing
        ? await editPostAction(editing.topicId, fd)
        : await createPostAction(null, fd);
      if (res.ok) {
        toast.success(
          editing
            ? "Publicação atualizada."
            : "Publicação enviada! Aguardando aprovação dos moderadores.",
        );
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-npb-text">
              {editing ? "Editar publicação" : "Nova publicação"}
            </h2>
            <p className="text-xs text-npb-text-muted">em {pageTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto npb-scrollbar p-5"
        >
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da publicação"
              maxLength={150}
              required
              className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-base font-semibold text-npb-text outline-none placeholder:text-npb-text-muted focus:border-npb-gold-dim"
            />
            <p className="mt-1 text-[10px] text-npb-text-muted">
              {title.length}/150
            </p>
          </div>

          <div>
            <RichTextEditor
              name="body"
              defaultValue={editing?.bodyHtml ?? ""}
              uploadImage={uploadImage}
            />
            <p className="mt-1 text-[10px] text-npb-text-muted">
              Use os ícones de imagem e vídeo na barra de ferramentas pra
              inserir mídia no meio do texto. Vídeo aceita link do YouTube ou
              Vimeo.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-npb-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-npb-text-muted hover:text-npb-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editing ? "Salvando…" : "Publicando…"}
                </>
              ) : editing ? (
                "Salvar alterações"
              ) : (
                "Publicar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
