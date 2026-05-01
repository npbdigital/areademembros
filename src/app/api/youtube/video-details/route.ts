import { NextResponse, type NextRequest } from "next/server";
import { getVideoDetails } from "@/lib/youtube/client";
import { getAdminUserId } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ ok: false, error: "videoId obrigatório." }, { status: 400 });
  }

  try {
    const details = await getVideoDetails(videoId);
    if (!details) {
      return NextResponse.json({ ok: false, error: "Vídeo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, video: details });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
