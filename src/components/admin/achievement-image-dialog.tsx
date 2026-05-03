"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  clearAchievementImageAction,
  uploadAchievementImageAction,
} from "@/app/(admin)/admin/achievements/actions";

interface Props {
  achievement: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    imageUrl: string | null;
  };
  onClose: () => void;
}

/**
 * Dialog admin pra setar/trocar/remover a imagem custom de uma conquista.
 *
 * Features:
 *  - Upload de arquivo (JPG/PNG/WebP, max 5MB)
 *  - Preview ao vivo de como o popup vai aparecer pro aluno
 *  - Orientação de tamanho recomendado (1:1 quadrada, 800x800+)
 *  - Botão "Remover" pra voltar ao emoji default
 */
export function AchievementImageDialog({ achievement, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    achievement.imageUrl,
  );
  const [uploading, setUploading] = useState(false);
  const [pendingClear, startClear] = useTransition();

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

  async function handleUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem maior que 5MB.");
      return;
    }
    // Preview local imediato (objectURL)
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadAchievementImageAction(achievement.id, fd);
    setUploading(false);

    URL.revokeObjectURL(localUrl);

    if (res.ok && res.url) {
      setPreviewUrl(res.url);
      toast.success("Imagem salva!");
      router.refresh();
    } else {
      // Reverte preview pra imagem antiga
      setPreviewUrl(achievement.imageUrl);
      toast.error(res.error ?? "Falha no upload.");
    }
  }

  function handleRemove() {
    if (!confirm("Remover imagem custom? Volta a usar o emoji default.")) return;
    startClear(async () => {
      const res = await clearAchievementImageAction(achievement.id);
      if (res.ok) {
        setPreviewUrl(null);
        toast.success("Imagem removida.");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-npb-text">
              Imagem da conquista
            </h2>
            <p className="text-xs text-npb-text-muted">{achievement.name}</p>
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

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto npb-scrollbar p-6 md:flex-row md:gap-8">
          {/* Coluna esquerda: upload + orientação */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-npb-text">
                Imagem personalizada
              </h3>
              <p className="mt-1 text-xs text-npb-text-muted">
                Substitui o emoji default no popup celebrativo e nos posts
                compartilhados em <code>/community/resultados</code>.
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-npb-gold/30 bg-npb-gold/5 p-3">
              <p className="text-xs font-semibold text-npb-gold">
                📐 Orientação de tamanho
              </p>
              <ul className="space-y-1 text-xs text-npb-text-muted">
                <li>
                  • <strong className="text-npb-text">Formato:</strong> quadrada
                  (1:1)
                </li>
                <li>
                  • <strong className="text-npb-text">Resolução:</strong>{" "}
                  800×800 ou maior (1200×1200 ideal)
                </li>
                <li>
                  • <strong className="text-npb-text">Tipo:</strong> JPG, PNG
                  ou WebP
                </li>
                <li>
                  • <strong className="text-npb-text">Peso máximo:</strong> 5MB
                </li>
                <li>
                  • <strong className="text-npb-text">Estilo:</strong> visual
                  comemorativo, com elementos centralizados (canto pode ser
                  cortado em alguns lugares)
                </li>
              </ul>
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 px-4 py-6 text-sm text-npb-text-muted transition hover:border-npb-gold hover:text-npb-text">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" />
                  {previewUrl ? "Trocar imagem" : "Escolher imagem"}
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading || pendingClear}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>

            {previewUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading || pendingClear}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {pendingClear ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remover imagem (volta ao emoji)
              </button>
            )}
          </div>

          {/* Coluna direita: preview do template */}
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
              Como vai ficar
            </p>
            <div className="space-y-4 rounded-2xl border border-npb-gold/40 bg-npb-bg3 p-6 text-center">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-npb-gold">
                <Sparkles className="h-3 w-3" />
                Conquista desbloqueada
              </div>
              <div className="flex justify-center">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={achievement.name}
                    className="h-40 w-40 rounded-2xl object-cover shadow-xl shadow-npb-gold/30"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-npb-gold to-npb-gold-dim text-6xl shadow-xl shadow-npb-gold/30">
                    {achievement.icon}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-npb-text">
                {achievement.name}
              </h3>
              {achievement.description && (
                <p className="text-xs text-npb-text-muted">
                  {achievement.description}
                </p>
              )}
              <p className="text-xs font-semibold text-npb-gold">
                Parabéns! 🎉
              </p>
            </div>
            <p className="text-[11px] text-npb-text-muted">
              Pra ver com confetti animado, use o botão{" "}
              <strong>Preview</strong> na lista de conquistas.
            </p>
          </div>
        </div>

        <div className="border-t border-npb-border bg-npb-bg3 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
