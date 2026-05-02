"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptWelcomeAction } from "@/app/(student)/welcome-actions";

interface Props {
  title: string;
  description: string;
  videoId: string | null;
  terms: string;
  buttonLabel: string;
}

export function WelcomeModal({
  title,
  description,
  videoId,
  terms,
  buttonLabel,
}: Props) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    if (!agreed) {
      toast.error("Marque a caixa de aceite antes de continuar.");
      return;
    }
    startTransition(async () => {
      const res = await acceptWelcomeAction();
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao registrar aceite.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-[5vh] backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
        <div className="border-b border-npb-border px-6 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-npb-gold">
            Boas-vindas
          </div>
          <h1 className="mt-1 text-xl font-bold text-npb-text">{title}</h1>
        </div>

        <div className="max-h-[70vh] overflow-y-auto npb-scrollbar px-6 py-5">
          {videoId && (
            <div className="mb-5 aspect-video w-full overflow-hidden rounded-xl border border-npb-border bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3`}
                title="Vídeo de boas-vindas"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}

          {description && (
            <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed text-npb-text">
              {description}
            </p>
          )}

          {terms && (
            <div className="mb-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-npb-text-muted">
                Termos de uso
              </p>
              <div className="max-h-72 overflow-y-auto npb-scrollbar rounded-lg border border-npb-border bg-npb-bg3 p-4 text-sm leading-relaxed text-npb-text whitespace-pre-wrap">
                {terms}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-npb-border bg-npb-bg2 px-6 py-4">
          <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-npb-gold"
            />
            <div className="flex-1 text-sm font-medium text-npb-text">
              Li e estou de acordo com os termos acima.
            </div>
          </label>

          <button
            type="button"
            onClick={handleAccept}
            disabled={pending || !agreed}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-3 text-sm font-bold text-black transition hover:bg-npb-gold-light disabled:opacity-40 disabled:hover:bg-npb-gold"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {buttonLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
