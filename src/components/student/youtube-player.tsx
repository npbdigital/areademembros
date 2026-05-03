"use client";

import { useEffect, useRef, useState } from "react";
import {
  logLessonViewAction,
  pingWatchTimeAction,
  saveLessonPositionAction,
} from "@/app/(student)/lessons/actions";

interface Props {
  lessonId: string;
  videoId: string;
  /** Posição (segundos) salva no banco — usada pra resume cross-device. */
  initialPositionSeconds?: number;
}

const POSITION_STORAGE_PREFIX = "npb-lesson-pos:";
const POSITION_SAVE_INTERVAL_MS = 10_000;
const WATCHTIME_PING_INTERVAL_MS = 30_000;
/** Só pula pra posição salva se > 3s (evita reload bobo no comecinho). */
const RESUME_THRESHOLD_SECONDS = 3;

interface YTPlayer {
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTGlobal {
  Player: new (
    el: HTMLElement,
    config: Record<string, unknown>,
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiPromise?: Promise<void>;
  }
}

function loadYTApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (window.__ytApiPromise) return window.__ytApiPromise;

  window.__ytApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (window.YT?.Player) resolve();
  });
  return window.__ytApiPromise;
}

export function YouTubePlayer({
  lessonId,
  videoId,
  initialPositionSeconds = 0,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loggedViewRef = useRef(false);
  // Controla overlay que esconde título/canal — só fica visível quando o
  // player NÃO está tocando (durante play, o YouTube esconde o título sozinho).
  // States da YT API: 1=playing, 3=buffering. Outros (-1=unstarted, 0=ended,
  // 2=paused, 5=cued) = mostra overlay.
  const [hideTopOverlay, setHideTopOverlay] = useState(false);
  /** Última posição já persistida no servidor — pra evitar payload repetido. */
  const lastSavedToServerRef = useRef<number>(initialPositionSeconds);
  const storageKey = `${POSITION_STORAGE_PREFIX}${lessonId}`;

  // Cria/destrói o player quando lessonId/videoId mudam
  useEffect(() => {
    let cancelled = false;

    if (!loggedViewRef.current) {
      loggedViewRef.current = true;
      logLessonViewAction(lessonId).catch(() => {});
    }

    loadYTApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;

      // Resolve posição inicial: prefere o que vier do servidor (cross-device).
      // Se localStorage tiver algo MAIS NOVO (i.e., sessão local em andamento
      // que ainda não sincronizou), usa o local.
      let resumePos = initialPositionSeconds;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed) && parsed > resumePos) {
            resumePos = Math.floor(parsed);
          }
        }
      } catch {
        // localStorage indisponível — segue só com o do servidor
      }
      const seekTo =
        resumePos > RESUME_THRESHOLD_SECONDS ? Math.floor(resumePos) : 0;

      mountRef.current.innerHTML = "";
      const inner = document.createElement("div");
      mountRef.current.appendChild(inner);

      playerRef.current = new window.YT.Player(inner, {
        // 100% no width/height — o iframe que a API cria respeita esses valores
        // e o container externo (.aspect-video) garante a proporção 16:9.
        // Sem isso a API setava 640×360 fixo, "cortando" o vídeo no mobile.
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          start: seekTo,
        },
        events: {
          onReady: () => {
            // sem auto-play — autoplay policy do navegador decide
          },
          onStateChange: (e: { data: number }) => {
            // 1=playing, 3=buffering → esconde overlay (deixa ver o vídeo)
            // outros estados → mostra overlay (cobre título/canal)
            setHideTopOverlay(e.data === 1 || e.data === 3);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      // Salva posição final (server + local) antes de destruir
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number" && t > 1) {
          const rounded = Math.floor(t);
          localStorage.setItem(storageKey, rounded.toString());
          if (Math.abs(rounded - lastSavedToServerRef.current) >= 3) {
            saveLessonPositionAction(lessonId, rounded).catch(() => {});
            lastSavedToServerRef.current = rounded;
          }
        }
      } catch {
        // ignore
      }
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [lessonId, videoId, storageKey, initialPositionSeconds]);

  // Salva posição periodicamente (server + localStorage)
  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        const player = playerRef.current;
        if (!player) return;
        const state = player.getPlayerState();
        // 1 = playing, 2 = paused
        if (state !== 1 && state !== 2) return;
        const t = player.getCurrentTime();
        if (typeof t !== "number" || t <= 1) return;

        const rounded = Math.floor(t);
        // local sempre — escrita instantânea, sem custo
        try {
          localStorage.setItem(storageKey, rounded.toString());
        } catch {
          // ignore
        }
        // server só se mudou >= 3s desde último envio (evita ruído)
        if (Math.abs(rounded - lastSavedToServerRef.current) >= 3) {
          saveLessonPositionAction(lessonId, rounded).catch(() => {});
          lastSavedToServerRef.current = rounded;
        }
      } catch {
        // ignore
      }
    }, POSITION_SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [storageKey, lessonId]);

  // Salva posição em visibilitychange e beforeunload
  useEffect(() => {
    const flush = () => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number" && t > 1) {
          const rounded = Math.floor(t);
          try {
            localStorage.setItem(storageKey, rounded.toString());
          } catch {
            // ignore
          }
          if (Math.abs(rounded - lastSavedToServerRef.current) >= 3) {
            saveLessonPositionAction(lessonId, rounded).catch(() => {});
            lastSavedToServerRef.current = rounded;
          }
        }
      } catch {
        // ignore
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [storageKey, lessonId]);

  // Watch-time pings: só conta tempo quando player está realmente tocando
  useEffect(() => {
    let lastPingAt = Date.now();
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) {
        lastPingAt = Date.now();
        return;
      }
      let state: number;
      try {
        state = player.getPlayerState();
      } catch {
        lastPingAt = Date.now();
        return;
      }
      const now = Date.now();
      if (state === 1) {
        const delta = Math.round((now - lastPingAt) / 1000);
        if (delta > 0) {
          pingWatchTimeAction(lessonId, delta).catch(() => {});
        }
      }
      lastPingAt = now;
    }, WATCHTIME_PING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [lessonId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-npb-border bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full">
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />
      {/* Top mask: cobre faixa onde YouTube renderiza título + canal quando
          pausado/loading. pointer-events-none deixa clique passar pro player
          (botão play continua funcionando). */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-black transition-opacity duration-300 ${
          hideTopOverlay ? "opacity-0" : "opacity-100"
        }`}
      />
      {/* Bottom-right mask: cobre o watermark "▶ YouTube" no canto inferior
          direito que o modestbranding=1 não remove. Bem pequeno (~80x28) pra
          não invadir os botões de configuração/fullscreen. */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-10 h-7 w-20 bg-black" />
    </div>
  );
}
