"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPostAction,
  uploadPostImageAction,
} from "@/app/(student)/community/actions";
import { videoEmbedUrl } from "@/lib/community";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface Props {
  galleryId: string;
  galleryTitle: string;
}

export function CreatePostButton({ galleryId, galleryTitle }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light"
      >
        <Plus className="h-4 w-4" />
        Nova publicação
      </button>
      {open && (
        <CreatePostModal
          galleryId={galleryId}
          galleryTitle={galleryTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreatePostModal({
  galleryId,
  galleryTitle,
  onClose,
}: {
  galleryId: string;
  galleryTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

  async function handleImage(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem maior que 10MB.");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadPostImageAction(fd);
    setUploading(false);
    if (res.ok && res.data) {
      setImageUrl(res.data.url);
    } else {
      toast.error(res.error ?? "Falha no upload.");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Preencha o título.");
    const form = e.currentTarget;
    // Pega `body` direto do hidden input do RichTextEditor
    const fd = new FormData(form);
    fd.set("gallery_id", galleryId);
    fd.set("title", title.trim());
    if (videoUrl.trim()) fd.set("video_url", videoUrl.trim());
    if (imageUrl) fd.set("image_url", imageUrl);
    startTransition(async () => {
      const res = await createPostAction(null, fd);
      if (res.ok) {
        toast.success(
          "Publicação enviada! Aguardando aprovação dos moderadores.",
        );
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao publicar.");
      }
    });
  }

  if (!mounted) return null;

  const embed = videoEmbedUrl(videoUrl);

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
              Nova publicação
            </h2>
            <p className="text-xs text-npb-text-muted">em {galleryTitle}</p>
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
            <RichTextEditor name="body" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-npb-text-muted">
                <Video className="h-3.5 w-3.5" />
                Vídeo (YouTube/Vimeo) — opcional
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
              {videoUrl && !embed && (
                <p className="mt-1 text-[10px] text-yellow-400">
                  URL não reconhecida.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-npb-text-muted">
                <ImagePlus className="h-3.5 w-3.5" />
                Imagem — opcional
              </label>
              {imageUrl ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-10 w-16 rounded border border-npb-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="text-xs text-npb-text-muted hover:text-red-400"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 px-3 py-2 text-xs text-npb-text-muted hover:border-npb-gold-dim">
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-3.5 w-3.5" />
                      Escolher imagem (max 10MB)
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImage(f);
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
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
              disabled={pending || uploading}
              className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publicando…
                </>
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
