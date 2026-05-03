"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Share2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { shareAchievementAction } from "@/app/(student)/achievements/actions";

interface CelebratableAchievement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  shareable: boolean;
}

interface Props {
  userId: string;
}

/**
 * Listener Realtime que escuta INSERTs em user_achievements pra esse user
 * e dispara um popup celebrativo (com confetti + opção de compartilhar)
 * quando a conquista tem `celebrate=true`.
 *
 * Roda no student layout — sempre disponível enquanto aluno tá no app.
 */
export function AchievementCelebrationListener({ userId }: Props) {
  const [queue, setQueue] = useState<CelebratableAchievement[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`celebrate-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "membros",
          table: "user_achievements",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const achievementId = (
            payload.new as { achievement_id?: string }
          )?.achievement_id;
          if (!achievementId || seenRef.current.has(achievementId)) return;
          seenRef.current.add(achievementId);

          // Busca dados completos da conquista — só celebra se celebrate=true
          const { data } = await supabase
            .schema("membros")
            .from("achievements")
            .select("id, code, name, description, icon, shareable, celebrate")
            .eq("id", achievementId)
            .maybeSingle();
          const a = data as
            | (CelebratableAchievement & { celebrate: boolean })
            | null;
          if (!a || !a.celebrate) return;

          setQueue((q) => [...q, a]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (queue.length === 0) return null;

  const current = queue[0];

  function handleClose() {
    setQueue((q) => q.slice(1));
  }

  return (
    <AchievementCelebrationModal
      key={current.id}
      achievement={current}
      onClose={handleClose}
    />
  );
}

function AchievementCelebrationModal({
  achievement,
  onClose,
}: {
  achievement: CelebratableAchievement;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [shareMode, setShareMode] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const confettiFired = useRef(false);

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

  // Dispara confetti uma vez ao montar
  useEffect(() => {
    if (!mounted || confettiFired.current) return;
    confettiFired.current = true;

    const duration = 3 * 1000;
    const end = Date.now() + duration;
    const colors = ["#c9922a", "#f0c060", "#ffd700", "#ffffff"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();

    // Boom inicial mais forte
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors,
    });
  }, [mounted]);

  function handleShare() {
    if (!achievement.shareable) return;
    startTransition(async () => {
      const res = await shareAchievementAction({
        achievementId: achievement.id,
        message: message.trim(),
      });
      if (res.ok && res.data) {
        toast.success("Compartilhado nos resultados!");
        onClose();
        router.push(`/community/${res.data.pageSlug}/post/${res.data.postId}`);
      } else {
        toast.error(res.error ?? "Falha ao compartilhar.");
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
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-npb-gold/40 bg-npb-bg2 shadow-2xl shadow-npb-gold/20">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
        >
          <X className="h-4 w-4" />
        </button>

        {!shareMode ? (
          <div className="space-y-4 p-8 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-npb-gold">
              <Sparkles className="h-3.5 w-3.5" />
              Conquista desbloqueada
            </div>

            {/* Badge */}
            <div className="flex justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-npb-gold to-npb-gold-dim text-7xl shadow-2xl shadow-npb-gold/40 animate-in zoom-in duration-500">
                {achievement.icon}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-npb-text md:text-3xl">
                {achievement.name}
              </h2>
              {achievement.description && (
                <p className="mt-2 text-sm text-npb-text-muted">
                  {achievement.description}
                </p>
              )}
            </div>

            <p className="text-sm font-semibold text-npb-gold">
              Parabéns! 🎉
            </p>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              {achievement.shareable && (
                <button
                  type="button"
                  onClick={() => setShareMode(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-npb-gold-light"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar nos resultados
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-npb-border bg-npb-bg3 px-4 py-2.5 text-sm font-semibold text-npb-text hover:border-npb-gold"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            <div>
              <h3 className="text-base font-bold text-npb-text">
                Compartilhar na comunidade
              </h3>
              <p className="mt-0.5 text-xs text-npb-text-muted">
                Vai pra página <strong>/community/resultados</strong> como
                post aprovado, com o badge da conquista.
              </p>
            </div>

            {/* Preview do card */}
            <div className="rounded-xl border border-npb-gold/40 bg-gradient-to-br from-npb-gold/10 to-transparent p-5 text-center">
              <div className="text-5xl leading-none">{achievement.icon}</div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-npb-gold">
                Conquista desbloqueada
              </p>
              <p className="mt-1 text-lg font-extrabold text-npb-text">
                {achievement.name}
              </p>
              {achievement.description && (
                <p className="mt-1 text-xs text-npb-text-muted">
                  {achievement.description}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
                Mensagem (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Conta o que essa conquista significa pra você…"
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
              <p className="mt-1 text-[10px] text-npb-text-muted">
                {message.length}/500
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShareMode(false)}
                className="rounded-md px-3 py-2 text-sm text-npb-text-muted hover:text-npb-text"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publicando…
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
