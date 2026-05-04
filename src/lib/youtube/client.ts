import {
  loadYouTubeMeta,
  loadYouTubeTokens,
  saveYouTubeTokens,
  type YouTubeTokens,
} from "@/lib/youtube/storage";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const EXPIRY_BUFFER_MS = 60_000; // refresh 1 min antes de expirar

export const YT_SCOPE = SCOPE;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID ausente.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // garante que vem refresh_token mesmo em re-autorização
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<YouTubeTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais Google ausentes.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Troca de code por token falhou: ${err}`);
  }

  const data = (await res.json()) as TokenResponse;
  if (!data.refresh_token) {
    throw new Error(
      "Google não devolveu refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.",
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

async function refreshAccessToken(tokens: YouTubeTokens): Promise<YouTubeTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais Google ausentes.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Refresh do token falhou: ${err}`);
  }

  const data = (await res.json()) as TokenResponse;
  const refreshed: YouTubeTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token, // Google nem sempre devolve refresh novo
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? tokens.scope,
  };
  await saveYouTubeTokens(refreshed);
  return refreshed;
}

/**
 * Retorna o access_token válido (refresh se necessário). Lança se não conectado.
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadYouTubeTokens();
  if (!tokens) throw new Error("YouTube não conectado.");

  if (tokens.expires_at - Date.now() < EXPIRY_BUFFER_MS) {
    const refreshed = await refreshAccessToken(tokens);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

/**
 * Wrapper genérico pra YouTube Data API v3 com retry em 401.
 */
export async function ytFetch<T = unknown>(
  endpoint: string,
  params: Record<string, string>,
): Promise<T> {
  let token = await getValidAccessToken();
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams(params).toString()}`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Token expirado entre o getValidAccessToken e a request — retry
  if (res.status === 401) {
    const tokens = await loadYouTubeTokens();
    if (tokens) {
      const refreshed = await refreshAccessToken(tokens);
      token = refreshed.access_token;
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!res.ok) {
    const err = await res.text();
    // Mensagem amigavel pra quota — caso comum, default da API eh
    // 10k unidades/dia e search.list custa 100 por chamada
    if (res.status === 403 && err.includes("quotaExceeded")) {
      throw new Error(
        "Quota da YouTube API esgotada. Reseta amanhã 04h (BRT) ou peça aumento em console.cloud.google.com/apis/api/youtube.googleapis.com/quotas",
      );
    }
    throw new Error(`YouTube API ${endpoint} ${res.status}: ${err}`);
  }

  return (await res.json()) as T;
}

/**
 * Pega info do canal autenticado (forMine) — usado pra mostrar "Conectado como X".
 */
export async function getOwnChannel(): Promise<{
  id: string;
  title: string;
  thumbnail: string | null;
} | null> {
  const data = await ytFetch<{
    items?: Array<{
      id: string;
      snippet: { title: string; thumbnails: { default?: { url: string } } };
    }>;
  }>("channels", {
    part: "snippet",
    mine: "true",
  });

  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.default?.url ?? null,
  };
}

export interface YTSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

/**
 * Busca vídeos do canal autenticado.
 *
 * Quando `query` está vazio, lista os vídeos via `playlistItems.list` na
 * playlist "uploads" do canal — custo: **1 unidade** por chamada (50 itens
 * por página). É 100x mais barato que `search.list` (100 unidades), o que
 * importa porque o quota default da YouTube Data API é só 10k/dia.
 *
 * Quando há query, faz busca de verdade via `search.list` (100 un.). É
 * inevitável pra busca por texto, mas só acontece quando o admin digita.
 *
 * O ID da playlist "uploads" é determinístico: pega o channelId e troca
 * o prefixo `UC` por `UU` (regra documentada do YouTube). Sem chamada
 * extra pra descobrir.
 */
export async function searchOwnVideos(
  query: string,
  pageToken?: string,
): Promise<{ items: YTSearchResult[]; nextPageToken?: string }> {
  const trimmed = query.trim();

  if (!trimmed) {
    // Modo lista: playlistItems da playlist "uploads" — 1 unidade
    const meta = await loadYouTubeMeta();
    if (!meta?.channel_id) {
      throw new Error(
        "Canal YouTube não identificado. Reconecte em /admin/youtube.",
      );
    }
    const uploadsPlaylistId = meta.channel_id.replace(/^UC/, "UU");

    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "12",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytFetch<{
      items?: Array<{
        snippet: {
          title: string;
          description: string;
          thumbnails: { medium?: { url: string }; default?: { url: string } };
          publishedAt: string;
          resourceId: { videoId: string };
        };
        contentDetails: { videoId: string; videoPublishedAt?: string };
      }>;
      nextPageToken?: string;
    }>("playlistItems", params);

    return {
      items: (data.items ?? []).map((it) => {
        const videoId = it.contentDetails.videoId ?? it.snippet.resourceId.videoId;
        return {
          videoId,
          title: it.snippet.title,
          description: it.snippet.description,
          thumbnail:
            it.snippet.thumbnails.medium?.url ??
            it.snippet.thumbnails.default?.url ??
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          publishedAt:
            it.contentDetails.videoPublishedAt ?? it.snippet.publishedAt,
        };
      }),
      nextPageToken: data.nextPageToken,
    };
  }

  // Modo busca por texto: search.list — 100 unidades. Inevitável.
  const params: Record<string, string> = {
    part: "snippet",
    forMine: "true",
    type: "video",
    maxResults: "12",
    order: "date",
    q: trimmed,
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await ytFetch<{
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
        publishedAt: string;
      };
    }>;
    nextPageToken?: string;
  }>("search", params);

  return {
    items: (data.items ?? []).map((it) => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      description: it.snippet.description,
      thumbnail:
        it.snippet.thumbnails.medium?.url ??
        it.snippet.thumbnails.default?.url ??
        `https://i.ytimg.com/vi/${it.id.videoId}/mqdefault.jpg`,
      publishedAt: it.snippet.publishedAt,
    })),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Detalhes de um vídeo (duração + título canônico).
 */
export interface YTVideoDetails {
  videoId: string;
  title: string;
  durationSeconds: number;
  thumbnail: string;
}

export async function getVideoDetails(
  videoId: string,
): Promise<YTVideoDetails | null> {
  const data = await ytFetch<{
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        thumbnails: {
          medium?: { url: string };
          high?: { url: string };
          default?: { url: string };
        };
      };
      contentDetails: { duration: string }; // ISO 8601 (PT1M30S)
    }>;
  }>("videos", {
    part: "snippet,contentDetails",
    id: videoId,
  });

  const item = data.items?.[0];
  if (!item) return null;
  return {
    videoId: item.id,
    title: item.snippet.title,
    durationSeconds: parseISODuration(item.contentDetails.duration),
    thumbnail:
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.default?.url ??
      `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
  };
}

function parseISODuration(iso: string): number {
  // ex: PT1H2M30S, PT45S, PT5M
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number.parseInt(match[1] ?? "0", 10);
  const m = Number.parseInt(match[2] ?? "0", 10);
  const s = Number.parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}
