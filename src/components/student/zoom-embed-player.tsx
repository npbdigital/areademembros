"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";

interface SignatureResponse {
  ok: boolean;
  error?: string;
  signature?: string;
  sdkKey?: string;
  meetingNumber?: string;
  password?: string;
  userName?: string;
  userEmail?: string;
  role?: number;
}

interface JoinInfo {
  meetingNumber: string;
  password: string;
}

/**
 * Constrói a URL universal do Zoom — `zoom.us/j/...` faz o navegador/SO
 * tentar abrir o app desktop ou mobile via custom protocol; cai no
 * webclient como fallback. Mais amigável que `zoommtg://` direto, que
 * só funciona se o app estiver instalado.
 */
function buildZoomJoinUrl(info: JoinInfo): string {
  const base = `https://zoom.us/j/${encodeURIComponent(info.meetingNumber)}`;
  if (!info.password) return base;
  return `${base}?pwd=${encodeURIComponent(info.password)}`;
}

/**
 * Embed do Zoom Meeting via Web SDK Component View.
 *
 * Fluxo:
 *   1. POST /api/zoom/signature → backend valida acesso e devolve JWT + dados
 *   2. Carrega @zoom/meetingsdk dinamicamente (lazy — pesa ~3MB)
 *   3. ZoomMtgEmbedded.createClient + init + join no container
 *   4. Quando user fecha aba ou navega, leave + cleanup
 *
 * Limitações conhecidas:
 *   - iOS Safari < 16: não funciona (Zoom Web SDK não suporta)
 *   - Bloqueador de cookies de terceiros pode quebrar (Brave default,
 *     Safari ITP). UI sugere abrir Zoom desktop como fallback.
 */
export function ZoomEmbedPlayer({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "joining" | "joined" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  // Mobile: Zoom Web SDK Component View tem viewSizes fixos (1000x600) que
  // quebram a UI em telas pequenas. Detectamos mobile e pulamos o SDK,
  // mostrando direto o CTA pro app nativo (que e o caminho recomendado
  // mesmo). Inicia null pra evitar flash desktop->mobile no SSR.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // Aluno pode forçar tentar embedar mesmo em mobile (se nao tiver app)
  const [forceEmbed, setForceEmbed] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // Sempre busca a signature pra ter o joinInfo (mesmo em mobile onde o
  // embed nao roda — precisamos do meetingNumber+password pro deeplink)
  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      try {
        const sigRes = await fetch("/api/zoom/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const sig = (await sigRes.json()) as SignatureResponse;
        if (cancelled) return;
        if (sig.ok && sig.meetingNumber) {
          setJoinInfo({
            meetingNumber: sig.meetingNumber,
            password: sig.password ?? "",
          });
        }
      } catch {
        // ignora — embed vai tratar erro tambem
      }
    }
    fetchInfo();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    // Desktop OU mobile com forceEmbed: roda o SDK. Caso contrario nao
    // monta nada (mobile vê só o CTA).
    if (isMobile === null) return;
    if (isMobile && !forceEmbed) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let zoomClient: any = null;

    async function start() {
      try {
        // 1. Pede signature ao backend
        setStatus("loading");
        const sigRes = await fetch("/api/zoom/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const sig = (await sigRes.json()) as SignatureResponse;
        if (!sig.ok || !sig.signature) {
          throw new Error(sig.error ?? "Falha ao autenticar no Zoom.");
        }
        if (cancelled) return;

        // 2. Carrega SDK dinamicamente (não bloqueia render inicial)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (await import("@zoom/meetingsdk/embedded")) as any;
        const ZoomMtgEmbedded = mod.default ?? mod;
        if (cancelled) return;

        // 3. Cria client e injeta no container
        const container = containerRef.current;
        if (!container) throw new Error("Container não montado.");

        zoomClient = ZoomMtgEmbedded.createClient();
        await zoomClient.init({
          zoomAppRoot: container,
          language: "pt-BR",
          patchJsMedia: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: {
                default: { width: 1000, height: 600 },
                ribbon: { width: 300, height: 700 },
              },
            },
            toolbar: {
              buttons: [],
            },
          },
        });

        if (cancelled) return;
        setStatus("joining");

        await zoomClient.join({
          sdkKey: sig.sdkKey,
          signature: sig.signature,
          meetingNumber: sig.meetingNumber,
          password: sig.password ?? "",
          userName: sig.userName ?? "Aluno",
          userEmail: sig.userEmail ?? "",
        });

        if (cancelled) return;
        setStatus("joined");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Erro inesperado.";
        console.error("[zoom embed] erro:", e);
        setError(msg);
        setStatus("error");
      }
    }

    start();

    return () => {
      cancelled = true;
      try {
        if (zoomClient && typeof zoomClient.leaveMeeting === "function") {
          void zoomClient.leaveMeeting();
        }
      } catch {
        // ignore
      }
    };
  }, [sessionId, isMobile, forceEmbed]);

  const joinUrl = joinInfo ? buildZoomJoinUrl(joinInfo) : null;

  // Mobile sem forçar embed: card grande com CTA pro app, sem render do SDK
  if (isMobile === true && !forceEmbed) {
    return (
      <div className="rounded-2xl border border-npb-gold/30 bg-gradient-to-br from-npb-gold/10 to-transparent p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-npb-gold/20">
          <ExternalLink className="h-6 w-6 text-npb-gold" />
        </div>
        <h2 className="text-lg font-bold text-npb-text">
          Entrar pelo app do Zoom
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-xs text-npb-text-muted">
          A monitoria está ao vivo. No celular, a melhor experiência é pelo
          app nativo do Zoom — vídeo, áudio e chat funcionam de boa.
        </p>
        {joinUrl ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-3 text-sm font-bold text-black hover:bg-npb-gold-light"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir no Zoom
          </a>
        ) : (
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-npb-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando link…
          </div>
        )}
        <button
          type="button"
          onClick={() => setForceEmbed(true)}
          className="mt-3 block w-full text-[11px] text-npb-text-muted underline-offset-2 hover:text-npb-text hover:underline"
        >
          Tentar abrir aqui mesmo no navegador
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-npb-border bg-npb-bg2 p-12 text-sm text-npb-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Autenticando no Zoom…
        </div>
      )}
      {status === "joining" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-npb-border bg-npb-bg2 p-12 text-sm text-npb-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Entrando na reunião…
        </div>
      )}
      {status === "error" && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6">
          <div className="flex items-start gap-2 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Não foi possível entrar na monitoria</p>
              <p className="mt-1 text-xs text-npb-text-muted">{error}</p>
              <p className="mt-3 text-xs text-npb-text-muted">
                Possíveis causas: bloqueador de cookies/scripts de terceiros
                (Brave, Safari), navegador desatualizado, ou monitoria já
                encerrou. Tente em outro navegador (Chrome/Edge funcionam
                melhor) ou recarregue a página.
              </p>
              {joinUrl && (
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-xs font-bold text-black hover:bg-npb-gold-light"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no app do Zoom
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        id="zoom-embed-root"
        className="overflow-hidden rounded-2xl border border-npb-border bg-black"
        style={{ minHeight: status === "joined" ? "480px" : 0 }}
      />

      {/* Botão pra abrir no cliente nativo — sempre visível quando temos
          os dados, pro aluno escolher web vs app. URL universal do Zoom
          tenta o app primeiro, cai no webclient se não tiver instalado. */}
      {joinUrl && status !== "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-npb-border bg-npb-bg2/50 px-4 py-2.5 text-xs text-npb-text-muted">
          <span>
            Travou ou não consegue entrar pelo navegador?
          </span>
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-npb-gold/40 bg-npb-gold/10 px-3 py-1.5 font-semibold text-npb-gold hover:bg-npb-gold/20"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir no app do Zoom
          </a>
        </div>
      )}
    </div>
  );
}
