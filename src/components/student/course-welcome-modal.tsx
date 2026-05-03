"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptCourseWelcomeAction } from "@/app/(student)/courses/[courseId]/actions";

interface Props {
  courseId: string;
  title: string;
  description: string;
  videoId: string | null;
  terms: string;
  buttonLabel: string;
}

/**
 * Popup de boas-vindas POR CURSO. Aparece na primeira vez que o aluno
 * abre /courses/[id] e o admin habilitou no curso.
 *
 * Diferente do WelcomeModal global (que vive na plataforma toda), esse
 * é por curso — cada curso tem seu próprio título/descrição/vídeo/termos.
 *
 * Aluno só vê uma vez por curso (registro em course_welcome_accepted).
 * Termos não são obrigatórios — quando vazios, esconde o checkbox.
 */
export function CourseWelcomeModal({
  courseId,
  title,
  description,
  videoId,
  terms,
  buttonLabel,
}: Props) {
  const router = useRouter();
  const hasTerms = terms.trim().length > 0;
  const [agreed, setAgreed] = useState(!hasTerms);
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    if (hasTerms && !agreed) {
      toast.error("Marque a caixa de aceite antes de continuar.");
      return;
    }
    startTransition(async () => {
      const res = await acceptCourseWelcomeAction(courseId);
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
            Boas-vindas ao curso
          </div>
          <h1 className="mt-1 text-xl font-bold text-npb-text">{title}</h1>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-npb-text-muted">
              {description}
            </p>
          )}
        </div>

        {videoId && (
          <div className="aspect-video w-full bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full">
            <div className="relative h-full w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        )}

        {hasTerms && (
          <div className="max-h-72 overflow-y-auto npb-scrollbar border-b border-npb-border bg-npb-bg3 px-6 py-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-npb-text-muted">
              {terms}
            </div>
          </div>
        )}

        <div className="space-y-3 px-6 py-4">
          {hasTerms && (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition hover:border-npb-gold-dim">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-npb-gold"
              />
              <span className="text-sm text-npb-text">
                Li e concordo com os termos acima.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={handleAccept}
            disabled={pending || (hasTerms && !agreed)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-2.5 text-sm font-bold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando…
              </>
            ) : (
              buttonLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
