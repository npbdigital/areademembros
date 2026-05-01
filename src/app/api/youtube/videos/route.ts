import { NextResponse, type NextRequest } from "next/server";
import { searchOwnVideos } from "@/lib/youtube/client";
import { getAdminUserId } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const pageToken = url.searchParams.get("pageToken") ?? undefined;

  try {
    const result = await searchOwnVideos(q, pageToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    const status =
      msg.includes("YouTube não conectado") ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
