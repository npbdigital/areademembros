import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForTokens,
  getOwnChannel,
} from "@/lib/youtube/client";
import {
  saveYouTubeMeta,
  saveYouTubeTokens,
} from "@/lib/youtube/storage";
import { getAdminUserId } from "@/lib/admin-guard";

const STATE_COOKIE = "yt_oauth_state";

function getRedirectUri(req: NextRequest): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${new URL(req.url).origin}/api/youtube/callback`
  );
}

function backToYoutubePage(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/youtube", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url);
  // Limpa o cookie de state seja como for
  response.cookies.set(STATE_COOKIE, "", {
    maxAge: 0,
    path: "/api/youtube",
  });
  return response;
}

export async function GET(req: NextRequest) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;

  if (errorParam) {
    return backToYoutubePage(req, {
      error: `Google retornou erro: ${errorParam}`,
    });
  }

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return backToYoutubePage(req, {
      error: "Sessão de autorização inválida. Tenta conectar de novo.",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(req));
    await saveYouTubeTokens(tokens);

    // Pega info do canal pra exibir no admin
    const channel = await getOwnChannel();
    if (channel) {
      await saveYouTubeMeta({
        channel_id: channel.id,
        channel_title: channel.title,
        channel_thumbnail: channel.thumbnail,
        connected_at: new Date().toISOString(),
      });
    }

    return backToYoutubePage(req, { connected: "1" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return backToYoutubePage(req, { error: msg });
  }
}
