/**
 * Helpers client-side pra Web Push API.
 * Use no browser apenas (componentes "use client").
 */

import {
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/(student)/push/actions";

/** Converte VAPID public key (base64url) pra Uint8Array que o PushManager aceita. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pode pedir permissão? (browser suporta + ainda não negou pra sempre) */
export function canPromptPushPermission(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  return Notification.permission === "default";
}

export function pushPermissionState():
  | "granted"
  | "denied"
  | "default"
  | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}

/**
 * Pede permissão e registra subscription no servidor.
 * Retorna true se ficou tudo ok (subscription enviada pro server).
 */
export async function requestPushPermissionAndSubscribe(
  vapidPublicKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, error: "Browser sem suporte." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Permissão negada." };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!sub.endpoint || !p256dh || !auth) {
      return { ok: false, error: "Subscription incompleta." };
    }

    const res = await subscribePushAction({
      endpoint: sub.endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent,
    });
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Desfaz subscription do dispositivo atual + remove do server.
 */
export async function unsubscribeCurrentDevice(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    if (!("serviceWorker" in navigator)) return { ok: true };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true };

    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const res = await unsubscribePushAction(endpoint);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Indica se este dispositivo já tem subscription ativa registrada.
 */
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
