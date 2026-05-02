/**
 * Service Worker mínimo da Área de Membros.
 *
 * Não cacheia nada — só existe pra qualificar a app como PWA instalável
 * (Chrome/Edge exigem SW registrado pra disparar `beforeinstallprompt`).
 *
 * Quando quiser cache offline real, popular CACHE_ASSETS e implementar
 * estratégia stale-while-revalidate.
 */

const VERSION = "v1";

self.addEventListener("install", (event) => {
  // Ativa imediatamente, sem esperar abas antigas fecharem
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Toma controle das abas abertas
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough — sem cache. Browser segue o request normal.
});
