"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ClipboardPaste,
  ExternalLink,
  Film,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoPick {
  videoId: string;
  title: string;
  durationSeconds: number;
  thumbnail: string;
}

interface VideoPickerProps {
  currentVideoId?: string | null;
  onPick: (video: VideoPick) => void;
}

interface SearchItem {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

interface SearchResponse {
  ok: boolean;
  items?: SearchItem[];
  nextPageToken?: string;
  error?: string;
}

interface DetailsResponse {
  ok: boolean;
  video?: VideoPick;
  error?: string;
}

export function VideoPicker({ currentVideoId, onPick }: VideoPickerProps) {
  const [open, setOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text transition-colors hover:border-npb-gold-dim hover:text-npb-gold"
        >
          <Search className="h-3.5 w-3.5" />
          {currentVideoId ? "Trocar vídeo do YouTube" : "Buscar vídeo no YouTube"}
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          title="Cola o código (ex: dQw4w9WgXcQ) ou a URL completa de um vídeo do YouTube"
          className="inline-flex items-center gap-1.5 text-xs text-npb-text-muted transition-colors hover:text-npb-gold"
        >
          <ClipboardPaste className="h-3 w-3" />
          Colar código do vídeo
        </button>
      </div>

      {open && (
        <PickerModal
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onPick(v);
            setOpen(false);
          }}
        />
      )}

      {pasteOpen && (
        <PasteCodeModal
          onClose={() => setPasteOpen(false)}
          onPick={(v) => {
            onPick(v);
            setPasteOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Modal alternativo: admin cola só o videoId (ou URL completa) e o sistema
 * busca os detalhes diretamente — pula a busca/listagem (que custa quota).
 * Útil pra cadastrar muitas aulas em sequência quando admin já sabe qual
 * vídeo quer.
 */
function PasteCodeModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (v: VideoPick) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractVideoId(input);
    if (!id) {
      setError("Não consegui identificar o ID do vídeo. Cola o código (11 chars) ou a URL completa.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/video-details?videoId=${encodeURIComponent(id)}`,
      );
      const data = (await res.json()) as DetailsResponse;
      if (!data.ok || !data.video) {
        setError(data.error ?? "Vídeo não encontrado.");
        return;
      }
      onPick(data.video);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar vídeo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-npb-border px-5 py-4">
          <ClipboardPaste className="h-5 w-5 text-npb-gold" />
          <h2 className="flex-1 text-base font-bold text-npb-text">
            Colar código do vídeo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-npb-text-muted">
            Pode ser só o código (ex: <code className="text-npb-text">dQw4w9WgXcQ</code>) ou a URL completa do YouTube. Sem buscar — gasta apenas 1 unidade da quota.
          </p>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="dQw4w9WgXcQ ou https://youtube.com/watch?v=..."
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-npb-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || input.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando…
              </>
            ) : (
              "Adicionar"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Aceita várias formas de input: ID puro (11 chars), URL completa
 * (youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/).
 */
function extractVideoId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ID puro: 11 chars alfanuméricos + _ -
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  // Tenta extrair de URL
  try {
    const url = new URL(s);
    // youtube.com/watch?v=ID
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    // youtu.be/ID, /embed/ID, /shorts/ID, /v/ID
    const m = url.pathname.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    if (
      (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) &&
      /^[a-zA-Z0-9_-]{11}$/.test(url.pathname.slice(1))
    ) {
      return url.pathname.slice(1);
    }
  } catch {
    // não é URL — tenta extrair com regex direto
    const m = s.match(/[a-zA-Z0-9_-]{11}/);
    if (m) return m[0];
  }
  return null;
}

function PickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (v: VideoPick) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Foco no input quando o modal abre
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC fecha o modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Busca com debounce
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/youtube/videos?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as SearchResponse;
        if (!data.ok) {
          if (res.status === 409) {
            setError(
              "Canal do YouTube não conectado. Vai em /admin/youtube e clica em conectar.",
            );
          } else {
            setError(data.error ?? "Erro ao buscar vídeos.");
          }
          setItems([]);
        } else {
          setItems(data.items ?? []);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Erro ao buscar vídeos.");
        }
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function handlePick(item: SearchItem) {
    setPickingId(item.videoId);
    try {
      const res = await fetch(
        `/api/youtube/video-details?videoId=${item.videoId}`,
      );
      const data = (await res.json()) as DetailsResponse;
      if (!data.ok || !data.video) {
        alert(data.error ?? "Erro ao buscar detalhes.");
        return;
      }
      onPick(data.video);
    } finally {
      setPickingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-npb-border px-5 py-4">
          <Film className="h-5 w-5 text-npb-gold" />
          <h2 className="flex-1 text-base font-bold text-npb-text">
            Buscar vídeo no canal conectado
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-npb-border px-5 py-3">
          <div className="flex items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2">
            <Search className="h-4 w-4 text-npb-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar título do vídeo, ou deixa vazio pros mais recentes"
              className="flex-1 bg-transparent text-sm text-npb-text outline-none placeholder:text-npb-text-muted"
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-npb-text-muted" />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto npb-scrollbar p-3">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-npb-text-muted">
              <Film className="mb-2 h-10 w-10 opacity-30" />
              <span>Nenhum vídeo encontrado.</span>
            </div>
          )}

          {!error && items.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.videoId}>
                  <button
                    type="button"
                    onClick={() => handlePick(item)}
                    disabled={pickingId !== null}
                    className={cn(
                      "flex w-full gap-3 rounded-md border border-npb-border bg-npb-bg3 p-2 text-left transition-colors",
                      "hover:border-npb-gold-dim hover:bg-npb-bg4",
                      "disabled:opacity-50",
                    )}
                  >
                    <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {pickingId === item.videoId && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="h-5 w-5 animate-spin text-npb-gold" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="line-clamp-2 text-xs font-medium text-npb-text">
                        {item.title}
                      </span>
                      <span className="mt-1 text-[10px] text-npb-text-muted">
                        {new Date(item.publishedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-npb-border px-5 py-3 text-xs text-npb-text-muted">
          <span>Mostra os 12 vídeos mais recentes do canal conectado.</span>
          <a
            href="/admin/youtube"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-npb-gold hover:text-npb-gold-light"
          >
            Gerenciar conexão <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
