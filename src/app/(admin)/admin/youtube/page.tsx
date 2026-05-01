import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Plug,
  PlaySquare,
} from "lucide-react";
import { loadYouTubeMeta } from "@/lib/youtube/storage";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

export default async function AdminYouTubePage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const meta = await loadYouTubeMeta();
  const error = searchParams.error;
  const connected = searchParams.connected === "1";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <PlaySquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-npb-text">YouTube</h1>
          <p className="text-sm text-npb-text-muted">
            Conecte um canal pra buscar e escolher vídeos direto do editor de
            aula.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{decodeURIComponent(error)}</span>
        </div>
      )}
      {connected && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Canal conectado com sucesso.</span>
        </div>
      )}

      {meta ? <ConnectedCard meta={meta} /> : <DisconnectedCard />}

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-5 text-sm text-npb-text-muted">
        <h3 className="mb-2 text-sm font-semibold text-npb-text">
          Como funciona
        </h3>
        <ul className="space-y-1.5 list-inside list-disc">
          <li>
            Conectamos via OAuth 2.0 ao YouTube. Tokens ficam criptografados no
            banco (AES-256-GCM, chave derivada do service role).
          </li>
          <li>Escopo único: <code>youtube.readonly</code> — só leitura.</li>
          <li>
            Quando o token expira (~1h), refresh é feito automaticamente em
            background.
          </li>
          <li>
            No editor de aula, clica em <strong>Selecionar vídeo</strong> pra
            buscar no canal conectado.
          </li>
        </ul>
      </div>
    </div>
  );
}

function DisconnectedCard() {
  return (
    <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
        <Plug className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-npb-text">Nenhum canal conectado</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-npb-text-muted">
        Clica em conectar e autorize o acesso de leitura aos vídeos do seu
        canal. Você pode desconectar a qualquer momento.
      </p>
      <Link
        href="/api/youtube/auth"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
      >
        <PlaySquare className="h-4 w-4" />
        Conectar canal do YouTube
      </Link>
    </div>
  );
}

function ConnectedCard({
  meta,
}: {
  meta: NonNullable<Awaited<ReturnType<typeof loadYouTubeMeta>>>;
}) {
  const connectedDate = new Date(meta.connected_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="rounded-2xl border border-npb-gold-dim/50 bg-npb-bg2 p-6">
      <div className="flex items-center gap-4">
        {meta.channel_thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.channel_thumbnail}
            alt={meta.channel_title}
            className="h-14 w-14 rounded-full border-2 border-npb-gold"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-npb-gold/10 text-npb-gold">
            <PlaySquare className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-npb-gold">
            <CheckCircle2 className="h-3 w-3" /> Conectado
          </div>
          <h3 className="mt-0.5 truncate text-lg font-bold text-npb-text">
            {meta.channel_title}
          </h3>
          <a
            href={`https://www.youtube.com/channel/${meta.channel_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-npb-text-muted hover:text-npb-gold"
          >
            Ver canal no YouTube <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-npb-border pt-4">
        <span className="text-xs text-npb-text-muted">
          Conectado em {connectedDate}
        </span>
        <DisconnectButton />
      </div>
    </div>
  );
}
