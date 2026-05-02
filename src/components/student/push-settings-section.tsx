"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  hasActiveSubscription,
  pushPermissionState,
  requestPushPermissionAndSubscribe,
  unsubscribeCurrentDevice,
} from "@/lib/push-client";
import { setNotificationPrefAction } from "@/app/(student)/push/actions";
import type { PushCategory } from "@/lib/push";

interface DeviceRow {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}

interface CategoryPref {
  category: PushCategory;
  pushEnabled: boolean;
}

interface Props {
  vapidPublicKey: string;
  enabledGlobal: boolean;
  devices: DeviceRow[];
  prefs: CategoryPref[];
}

const CATEGORIES: Array<{ key: PushCategory; emoji: string; label: string }> = [
  { key: "community_comment", emoji: "💬", label: "Comentário no meu post" },
  { key: "community_reply", emoji: "💭", label: "Resposta ao meu comentário" },
  { key: "community_post_status", emoji: "✅", label: "Status do meu post (aprovado / recusado)" },
  { key: "achievement_unlocked", emoji: "🏆", label: "Conquista desbloqueada" },
  { key: "lesson_drip", emoji: "📚", label: "Nova aula liberada" },
  { key: "kiwify_sale_attributed", emoji: "💰", label: "Venda Kiwify atribuída" },
];

function prefMap(prefs: CategoryPref[]): Map<PushCategory, boolean> {
  const m = new Map<PushCategory, boolean>();
  for (const p of prefs) m.set(p.category, p.pushEnabled);
  return m;
}

export function PushSettingsSection({
  vapidPublicKey,
  enabledGlobal,
  devices,
  prefs,
}: Props) {
  const router = useRouter();
  const [permission, setPermission] = useState<
    ReturnType<typeof pushPermissionState>
  >("default");
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState(prefMap(prefs));
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPermission(pushPermissionState());
    hasActiveSubscription().then(setHasSub);
  }, []);

  const supported = permission !== "unsupported";

  async function handleEnable() {
    if (!vapidPublicKey) {
      toast.error("Push não configurado nesta instalação.");
      return;
    }
    setBusy(true);
    const res = await requestPushPermissionAndSubscribe(vapidPublicKey);
    setBusy(false);
    if (res.ok) {
      setHasSub(true);
      setPermission("granted");
      toast.success("Notificações ativadas neste dispositivo!");
      router.refresh();
    } else {
      toast.error(res.error ?? "Falha.");
      setPermission(pushPermissionState());
    }
  }

  async function handleDisable() {
    setBusy(true);
    const res = await unsubscribeCurrentDevice();
    setBusy(false);
    if (res.ok) {
      setHasSub(false);
      toast.success("Notificações desativadas neste dispositivo.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Falha.");
    }
  }

  function handleTogglePref(category: PushCategory, next: boolean) {
    setOptimistic((m) => {
      const copy = new Map(m);
      copy.set(category, next);
      return copy;
    });
    startTransition(async () => {
      const res = await setNotificationPrefAction({
        category,
        pushEnabled: next,
      });
      if (!res.ok) {
        // rollback
        setOptimistic((m) => {
          const copy = new Map(m);
          copy.set(category, !next);
          return copy;
        });
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <section id="push" className="space-y-4">
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-npb-text">
        <Bell className="h-5 w-5 text-npb-gold" />
        Notificações push
      </h2>
      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        {!enabledGlobal ? (
          <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Push notifications estão desativadas globalmente pela administração.
          </div>
        ) : !supported ? (
          <div className="rounded-md border border-npb-border bg-npb-bg3 p-4 text-sm text-npb-text-muted">
            Seu navegador não suporta push notifications. Tente Chrome, Edge ou
            Safari atualizados.
          </div>
        ) : permission === "denied" ? (
          <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            <p className="font-semibold">Permissão bloqueada pelo navegador.</p>
            <p className="text-xs">
              Você (ou o navegador) bloqueou notificações pra este site. Pra
              reativar: abra as configurações do site no seu browser
              (cadeado/info da URL), encontre &quot;Notificações&quot; e troque
              pra &quot;Permitir&quot;. Depois recarregue a página.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-npb-text">
                  Este dispositivo
                </p>
                <p className="mt-0.5 text-xs text-npb-text-muted">
                  {hasSub === null
                    ? "Verificando…"
                    : hasSub
                      ? "Notificações ativadas neste navegador."
                      : "Notificações desativadas neste navegador."}
                </p>
              </div>
              {hasSub ? (
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text-muted hover:text-red-400 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <BellOff className="h-3 w-3" />
                  )}
                  Desativar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Bell className="h-3 w-3" />
                  )}
                  Ativar
                </button>
              )}
            </div>

            {devices.length > 0 && (
              <div className="rounded-md border border-npb-border bg-npb-bg3 p-3 text-xs text-npb-text-muted">
                <p className="mb-1 font-semibold text-npb-text">
                  {devices.length} dispositivo{devices.length > 1 ? "s" : ""} cadastrado{devices.length > 1 ? "s" : ""}
                </p>
                <ul className="space-y-0.5">
                  {devices.slice(0, 5).map((d) => (
                    <li key={d.id} className="truncate">
                      {summarizeUserAgent(d.user_agent)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-npb-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
                Receber push de:
              </p>
              <div className="space-y-1.5">
                {CATEGORIES.map((cat) => {
                  const enabled = optimistic.get(cat.key) ?? true;
                  return (
                    <label
                      key={cat.key}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-npb-text transition-colors hover:bg-npb-bg3"
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => handleTogglePref(cat.key, e.target.checked)}
                        className="h-4 w-4 accent-npb-gold"
                      />
                      <span className="text-base leading-none">{cat.emoji}</span>
                      <span className="flex-1">{cat.label}</span>
                      {enabled && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-npb-gold" />
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-npb-text-muted">
                📢 Anúncios da plataforma (broadcasts) sempre são enviados —
                não dá pra desligar.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  if (/Android/i.test(ua)) return "Android — " + (matchBrowser(ua) ?? "navegador");
  if (/iPhone|iPad|iPod/i.test(ua))
    return "iOS — " + (matchBrowser(ua) ?? "navegador");
  if (/Macintosh|Mac OS/i.test(ua))
    return "Mac — " + (matchBrowser(ua) ?? "navegador");
  if (/Windows/i.test(ua)) return "Windows — " + (matchBrowser(ua) ?? "navegador");
  if (/Linux/i.test(ua)) return "Linux — " + (matchBrowser(ua) ?? "navegador");
  return matchBrowser(ua) ?? "Navegador";
}

function matchBrowser(ua: string): string | null {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  return null;
}
