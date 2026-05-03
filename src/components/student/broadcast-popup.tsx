"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Megaphone, X } from "lucide-react";
import type { PendingPopup } from "@/lib/push";
import { markBroadcastPopupSeenAction } from "@/app/(student)/broadcasts/actions";

interface Props {
  popup: PendingPopup;
}

/**
 * Modal full-screen pra anúncio em formato popup grande. Aparece UMA vez
 * no próximo acesso do aluno; ao fechar (X, clique fora ou CTA), marca
 * em broadcast_popup_seen e nunca mais aparece pra esse user.
 *
 * Renderizado pelo BroadcastPopupGate (server component que decide se
 * tem popup pendente).
 */
export function BroadcastPopup({ popup }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    startTransition(async () => {
      await markBroadcastPopupSeenAction(popup.id);
      router.refresh();
    });
  }

  function handleCta() {
    // Marca como visto antes de seguir o link
    startTransition(async () => {
      await markBroadcastPopupSeenAction(popup.id);
      // router.push é client-side, então rota navega normalmente
      if (popup.link) router.push(popup.link);
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-npb-gold/40 bg-npb-bg2 shadow-2xl shadow-npb-gold/20">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          disabled={pending}
          className="absolute right-3 top-3 z-10 rounded-md bg-black/40 p-1.5 text-white backdrop-blur hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.imageUrl}
            alt=""
            className="block w-full object-cover"
            style={{ maxHeight: "50vh" }}
          />
        ) : (
          <div className="flex items-center justify-center bg-gradient-to-br from-npb-gold/30 via-npb-gold/15 to-transparent py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-npb-gold/25">
              <Megaphone className="h-8 w-8 text-npb-gold" />
            </div>
          </div>
        )}

        <div className="space-y-4 p-6 sm:p-8">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-npb-gold">
              <Megaphone className="h-3 w-3" />
              Anúncio
            </p>
            <h2 className="text-xl font-extrabold text-npb-text md:text-2xl">
              {popup.title}
            </h2>
            {popup.body && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-npb-text-muted">
                {popup.body}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            {popup.link ? (
              <button
                type="button"
                onClick={handleCta}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-npb-gold px-5 py-2.5 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {popup.linkLabel?.trim() || "Saiba mais"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="rounded-md border border-npb-border bg-npb-bg3 px-4 py-2.5 text-sm font-semibold text-npb-text hover:border-npb-gold disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Fechar"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Server component "wrapper" — busca o próximo popup pendente do user e
 * renderiza o modal client. Plugado no student layout.
 *
 * NOTA: precisa ser importado como dynamic ou ser server-side. A versão
 * server live em components/student/broadcast-popup-gate.tsx (separado
 * pra manter o "use client" deste arquivo).
 */
