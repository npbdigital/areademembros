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

  useEffect(() => {
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

        // Guarda info pro botao "Abrir no app" — mostra ao lado do embed
        // pra aluno que preferir o cliente nativo
        if (sig.meetingNumber) {
          setJoinInfo({
            meetingNumber: sig.meetingNumber,
            password: sig.password ?? "",
          });
        }

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
  }, [sessionId]);

  const joinUrl = joinInfo ? buildZoomJoinUrl(joinInfo) : null;

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
