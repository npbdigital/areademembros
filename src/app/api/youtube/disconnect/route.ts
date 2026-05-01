import { NextResponse } from "next/server";
import { clearYouTubeConnection } from "@/lib/youtube/storage";
import { getAdminUserId } from "@/lib/admin-guard";

export async function POST() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }
  try {
    await clearYouTubeConnection();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
