"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Share2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  markAchievementCelebratedAction,
  shareAchievementAction,
} from "@/app/(student)/achievements/actions";

export interface CelebratableAchievement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  shareable: boolean;
  /** URL da imagem custom (substitui o badge emoji quando setada). */
  imageUrl?: string | null;
  /** Nome da decoração linkada (quando achievement desbloqueia frame). */
  decorationName?: string | null;
  /** URL PNG do frame (renderizado por cima do avatar). */
  decorationImageUrl?: string | null;
}

interface ListenerProps {
  userId: string;
}

/**
 * Listener que dispara o popup celebrativo. Combina dois fluxos:
 *
 * 1. **Replay no mount** — query em `user_achievements` por linhas com
 *    `celebrated_at IS NULL` e `celebrate=true`. Cobre o caso "admin
 *    gerou venda fictícia / aluno desbloqueou enquanto offline → Realtime
 *    perdeu o evento". No próximo acesso o popup dispara.
 * 2. **Realtime INSERT** — escuta novas linhas em tempo real pra disparar
 *    popup imediato quando aluno está logado e algo acontece.
 *
 * Quando o aluno fecha o modal, `celebrated_at` é setado pra evitar que o
 * popup re-apareça na próxima nav.
 */
export function AchievementCelebrationListener({ userId }: ListenerProps) {
  const [queue, setQueue] = useState<
    Array<CelebratableAchievement & { avatarUrl: string | null }>
  >([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;

    async function fetchAchievement(achievementId: string) {
      const { data } = await supabase
        .schema("membros")
        .from("achievements")
        .select(
          "id, code, name, description, icon, shareable, celebrate, celebration_image_url, unlocks_decoration_id, avatar_decorations(name, image_url)",
        )
        .eq("id", achievementId)
        .maybeSingle();
      return data as
        | {
            id: string;
            code: string;
            name: string;
            description: string | null;
            icon: string;
            shareable: boolean;
            celebrate: boolean;
            celebration_image_url: string | null;
            unlocks_decoration_id: string | null;
            avatar_decorations:
              | { name: string; image_url: string | null }
              | { name: string; image_url: string | null }[]
              | null;
          }
        | null;
    }

    async function fetchAvatar(): Promise<string | null> {
      const { data: userRow } = await supabase
        .schema("membros")
        .from("users")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return (
        (userRow as { avatar_url: string | null } | null)?.avatar_url ?? null
      );
    }

    function pushToQueue(
      a: NonNullable<Awaited<ReturnType<typeof fetchAchievement>>>,
      avatarUrl: string | null,
    ) {
      if (cancelled) return;
      if (seenRef.current.has(a.id)) return;
      seenRef.current.add(a.id);
      const deco = Array.isArray(a.avatar_decorations)
        ? a.avatar_decorations[0]
        : a.avatar_decorations;
      setQueue((q) => [
        ...q,
        {
          id: a.id,
          code: a.code,
          name: a.name,
          description: a.description,
          icon: a.icon,
          shareable: a.shareable,
          imageUrl: a.celebration_image_url ?? null,
          decorationName: deco?.name ?? null,
          decorationImageUrl: deco?.image_url ?? null,
          avatarUrl,
        },
      ]);
    }

    // 1. Replay: pega celebrações pendentes (celebrated_at IS NULL)
    (async () => {
      const { data: pendingRows } = await supabase
        .schema("membros")
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", userId)
        .is("celebrated_at", null)
        .order("unlocked_at", { ascending: true })
        .limit(5);

      if (cancelled) return;
      const ids = (
        (pendingRows ?? []) as Array<{ achievement_id: string }>
      ).map((r) => r.achievement_id);
      if (ids.length === 0) return;

      const avatarUrl = await fetchAvatar();
      for (const id of ids) {
        const a = await fetchAchievement(id);
        if (!a || !a.celebrate) {
          // Conquista sem celebração marca como vista pra não ficar consultando
          await markAchievementCelebratedAction(id);
          continue;
        }
        pushToQueue(a, avatarUrl);
      }
    })();

    // 2. Realtime: novos INSERTs disparam popup ao vivo
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
          const a = await fetchAchievement(achievementId);
          if (!a || !a.celebrate) return;
          const avatarUrl = await fetchAvatar();
          pushToQueue(a, avatarUrl);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (queue.length === 0) return null;

  const current = queue[0];

  function handleClose() {
    // Marca como celebrado no DB pra não disparar de novo no próximo acesso
    markAchievementCelebratedAction(current.id).catch(() => {
      // best-effort — se falhar, popup pode aparecer de novo, mas não é crítico
    });
    setQueue((q) => q.slice(1));
  }

  return (
    <AchievementCelebrationModal
      key={current.id}
      achievement={current}
      onClose={handleClose}
      previewAvatarUrl={current.avatarUrl}
    />
  );
}

interface ModalProps {
  achievement: CelebratableAchievement;
  onClose: () => void;
  /**
   * Modo preview (admin): não permite compartilhar e mostra label
   * "Pré-visualização" no topo.
   */
  previewMode?: boolean;
  /** Avatar do aluno pra renderizar dentro do frame quando há decoração linkada. */
  previewAvatarUrl?: string | null;
}

/**
 * Modal de celebração. Pode ser usado pelo listener (aluno desbloqueando)
 * OU pelo admin em modo preview pra ver como vai ficar.
 *
 * Quando `imageUrl` está setado, substitui o badge emoji por uma imagem
 * grande (ratio 1:1, max 320px). Senão renderiza o badge gradient gold.
 */
export function AchievementCelebrationModal({
  achievement,
  onClose,
  previewMode = false,
  previewAvatarUrl = null,
}: ModalProps) {
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

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors,
    });
  }, [mounted]);

  function handleShare() {
    if (!achievement.shareable || previewMode) return;
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

  const hasFrame = Boolean(achievement.decorationImageUrl);

  // Prioridade: decoração (avatar+frame) → imagem custom → emoji gradient
  const badge = hasFrame ? (
    <FrameBadge
      avatarUrl={previewAvatarUrl}
      frameUrl={achievement.decorationImageUrl!}
      size="lg"
    />
  ) : achievement.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={achievement.imageUrl}
      alt={achievement.name}
      className="h-48 w-48 rounded-2xl object-cover shadow-2xl shadow-npb-gold/40 animate-in zoom-in duration-500 sm:h-56 sm:w-56"
    />
  ) : (
    <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-npb-gold to-npb-gold-dim text-7xl shadow-2xl shadow-npb-gold/40 animate-in zoom-in duration-500">
      {achievement.icon}
    </div>
  );

  const previewBadge = hasFrame ? (
    <FrameBadge
      avatarUrl={previewAvatarUrl}
      frameUrl={achievement.decorationImageUrl!}
      size="sm"
    />
  ) : achievement.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={achievement.imageUrl}
      alt={achievement.name}
      className="mx-auto h-32 w-32 rounded-xl object-cover"
    />
  ) : (
    <div className="text-5xl leading-none">{achievement.icon}</div>
  );

  // Header diferente quando é frame vs conquista comum.
  const headerLabel = hasFrame
    ? "Você conquistou um marco importante!"
    : "Conquista desbloqueada";

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

        {previewMode && (
          <div className="border-b border-npb-border bg-npb-bg3 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-npb-text-muted">
            Pré-visualização (admin)
          </div>
        )}

        {!shareMode ? (
          <div className="space-y-4 p-8 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-npb-gold">
              <Sparkles className="h-3.5 w-3.5" />
              {headerLabel}
            </div>

            <div className="flex justify-center">{badge}</div>

            <div className="pt-3">
              <h2 className="text-2xl font-extrabold text-npb-text md:text-3xl">
                {achievement.name}
              </h2>
              {achievement.description && (
                <p className="mt-2 text-sm text-npb-text-muted">
                  {achievement.description}
                </p>
              )}
            </div>

            <p className="text-sm font-semibold text-npb-gold">Parabéns! 🎉</p>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              {!previewMode && achievement.shareable && (
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
              {previewBadge}
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-npb-gold">
                {headerLabel}
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

/**
 * Avatar do aluno renderizado COM o frame por cima — visual final da
 * decoração equipada. Usado no modal de celebração quando a conquista
 * desbloqueia uma decoração.
 *
 * Estrutura: container quadrado, avatar circular dentro, frame em PNG
 * por cima (object-contain pra preservar a transparência).
 *
 * Sem avatar do user, mostra um placeholder cinza com user icon.
 */
function FrameBadge({
  avatarUrl,
  frameUrl,
  size,
}: {
  avatarUrl: string | null;
  frameUrl: string;
  size: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-48 w-48 sm:h-56 sm:w-56" : "h-28 w-28";

  return (
    <div
      className={`relative animate-in zoom-in duration-500 ${dim} mx-auto`}
    >
      {/* Avatar centralizado — ocupa 88% do container, ligeiramente
          maior que a abertura do anel do frame, pra que a borda do
          avatar fique escondida embaixo do anel dourado (encaixe). */}
      <div className="absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-npb-bg3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-npb-text-muted">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-1/2 w-1/2"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
      </div>
      {/* Frame por cima */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameUrl}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
