/**
 * Service Worker da Área de Membros.
 *
 * Funções:
 * 1. Qualificar a app como PWA (Chrome exige SW pra disparar
 *    `beforeinstallprompt`).
 * 2. Receber e exibir push notifications via Web Push API.
 * 3. Tratar click na notificação abrindo o app no link correto.
 *
 * Não cacheia conteúdo — fetch é passthrough. Pra cache offline real,
 * popular CACHE_ASSETS e implementar stale-while-revalidate.
 */

const VERSION = "v3-favicon";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough — sem cache.
});

// =====================================================================
// PUSH HANDLER — recebe payload do server e mostra notificação nativa
// =====================================================================
self.addEventListener("push", (event) => {
  let payload = {
    title: "Nova notificação",
    body: "",
    link: "/notifications",
    icon: "/icons/pwa-192.png",
    badge: "/icons/pwa-192.png",
    tag: undefined,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch {
      // payload pode vir como texto puro
      payload.body = event.data.text();
    }
  }

  const title = payload.title;
  const options = {
    body: payload.body,
    icon: payload.icon || "/icons/pwa-192.png",
    badge: payload.badge || "/icons/pwa-192.png",
    // Tag: notificações com mesma tag se substituem (evita spam)
    tag: payload.tag,
    // Renotify true faz vibrar mesmo se substituiu uma anterior
    renotify: Boolean(payload.tag),
    data: {
      link: payload.link || "/notifications",
      ts: Date.now(),
    },
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// =====================================================================
// NOTIFICATION CLICK — abre o app no link, ou foca aba existente
// =====================================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetLink = event.notification.data?.link || "/notifications";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Se já tem uma aba do app aberta, foca + navega
      const appOrigin = self.registration.scope;
      for (const client of allClients) {
        if (client.url.startsWith(appOrigin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetLink);
            } catch {
              // navigate falha em alguns browsers; foca mesmo assim
            }
          }
          return;
        }
      }

      // Se não tem aba aberta, abre nova
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetLink);
      }
    })(),
  );
});

// =====================================================================
// PUSH SUBSCRIPTION CHANGE — quando o browser renova a sub
// (mais comum em iOS / após long-idle). Avisa o cliente pra re-subscrever.
// =====================================================================
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({ type: "push-subscription-change" });
      }
    })(),
  );
});
