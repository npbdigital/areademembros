"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import {
  canPromptPushPermission,
  requestPushPermissionAndSubscribe,
} from "@/lib/push-client";

const FIVE_MIN_MS = 5 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_FIRST = "npb-first-seen-at";
const KEY_LAST = "npb-last-active-at";
const KEY_SESSIONS = "npb-session-count";
const KEY_DISMISSED = "npb-push-prompt-dismissed-at";

interface Props {
  /** VAPID public key. Quando vazia, prompt nunca aparece. */
  vapidPublicKey: string;
  /** Setting global do admin (kill switch). Quando false, prompt nunca aparece. */
  enabled: boolean;
}

/**
 * Modal discreto no canto inferior direito que pede permissão de push
 * notifications. Critérios pra aparecer:
 *   - browser suporta + permission ainda é "default"
 *   - VAPID configurado + setting global ligada
 *   - Última rejeição > 7 dias atrás (ou nunca rejeitou)
 *   - É a 2ª+ sessão OU passaram > 5min na 1ª sessão
 *
 * Sessão = visita após >30min de inatividade.
 */
export function PushPermissionPrompt({ vapidPublicKey, enabled }: Props) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !vapidPublicKey) return;
    if (typeof window === "undefined") return;
    if (!canPromptPushPermission()) return;

    // Atualiza tracking de sessão
    const now = Date.now();
    const firstRaw = localStorage.getItem(KEY_FIRST);
    const lastRaw = localStorage.getItem(KEY_LAST);
    const sessionsRaw = localStorage.getItem(KEY_SESSIONS);

    if (!firstRaw) {
      localStorage.setItem(KEY_FIRST, now.toString());
    }
    let sessionCount = parseInt(sessionsRaw ?? "0", 10) || 0;
    const last = parseInt(lastRaw ?? "0", 10) || 0;
    if (!last || now - last > THIRTY_MIN_MS) {
      sessionCount += 1;
      localStorage.setItem(KEY_SESSIONS, sessionCount.toString());
    }
    localStorage.setItem(KEY_LAST, now.toString());

    // Já rejeitou recentemente?
    const dismissedRaw = localStorage.getItem(KEY_DISMISSED);
    const dismissedAt = parseInt(dismissedRaw ?? "0", 10) || 0;
    if (dismissedAt && now - dismissedAt < SEVEN_DAYS_MS) {
      return;
    }

    if (sessionCount >= 2) {
      // Mostra imediatamente
      setShow(true);
    } else {
      // 1ª sessão — espera 5min de uso ativo
      const t = window.setTimeout(() => {
        if (canPromptPushPermission()) setShow(true);
      }, FIVE_MIN_MS);
      return () => window.clearTimeout(t);
    }
  }, [enabled, vapidPublicKey]);

  function handleDismiss() {
    try {
      localStorage.setItem(KEY_DISMISSED, Date.now().toString());
    } catch {
      // ignore
    }
    setShow(false);
  }

  async function handleEnable() {
    setBusy(true);
    const res = await requestPushPermissionAndSubscribe(vapidPublicKey);
    setBusy(false);
    if (res.ok) {
      toast.success("Notificações ativadas!");
      setShow(false);
    } else {
      // Se rejeitou pelo prompt nativo, não mostramos de novo (browser bloqueia)
      if (res.error === "Permissão negada.") {
        handleDismiss();
      }
      toast.error(res.error ?? "Falha ao ativar.");
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-npb-gold/40 bg-npb-bg2 p-4 shadow-2xl animate-in slide-in-from-right">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/15 text-npb-gold">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-npb-text">
            Receba notificações no celular
          </p>
          <p className="mt-1 text-xs text-npb-text-muted">
            Avisos de novas aulas, comentários no seu post e anúncios da
            plataforma — direto no seu dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
        >
          Mais tarde
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
      </div>
    </div>
  );
}
