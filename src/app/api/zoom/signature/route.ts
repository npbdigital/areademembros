import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Assina JWT pra um participante entrar num Meeting via Zoom Web SDK
 * (Component View). Validações:
 *   1. User autenticado
 *   2. live_session existe + está com status='live' (admin já clicou "Iniciar")
 *   3. User é admin OU tem matrícula ativa na cohort_id da session
 *
 * Aluno entra como `role=0` (attendee). Admin entra como `role=1` (host) —
 * mas pra isso o admin precisa estar logado no Zoom também (o ZAK token vai
 * ser tratado pelo SDK quando ele clicar pra começar).
 *
 * Spec do JWT do Meeting SDK 2.x:
 * https://developers.zoom.us/docs/meeting-sdk/auth/
 */
export async function POST(req: NextRequest) {
  const sdkKey = process.env.NEXT_PUBLIC_ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;
  if (!sdkKey || !sdkSecret) {
    console.error("[zoom signature] SDK key/secret não configurados");
    return NextResponse.json(
      { ok: false, error: "Zoom não configurado." },
      { status: 500 },
    );
  }

  let body: { sessionId?: string };
  try {
    body = (await req.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body inválido." },
      { status: 400 },
    );
  }
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId obrigatório." },
      { status: 400 },
    );
  }

  // 1. User autenticado
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }

  const sb = createAdminClient();

  // 2. Valida session: existe + está live
  const { data: sessionRow } = await sb
    .schema("membros")
    .from("live_sessions")
    .select("id, cohort_id, zoom_meeting_id, zoom_password, status")
    .eq("id", sessionId)
    .maybeSingle();
  const session = sessionRow as
    | {
        id: string;
        cohort_id: string;
        zoom_meeting_id: string;
        zoom_password: string | null;
        status: string;
      }
    | null;
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Monitoria não encontrada." },
      { status: 404 },
    );
  }
  if (session.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Monitoria ainda não começou." },
      { status: 403 },
    );
  }

  // 3. User é admin OU tem matrícula ativa na cohort
  const { data: profile } = await sb
    .schema("membros")
    .from("users")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const userRow = profile as
    | { role: string; full_name: string | null; email: string }
    | null;
  if (!userRow) {
    return NextResponse.json(
      { ok: false, error: "Perfil não encontrado." },
      { status: 403 },
    );
  }

  const isAdminOrMod =
    userRow.role === "admin" || userRow.role === "moderator";

  if (!isAdminOrMod) {
    const { data: enrollment } = await sb
      .schema("membros")
      .from("enrollments")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("cohort_id", session.cohort_id)
      .eq("is_active", true)
      .maybeSingle();
    const enr = enrollment as
      | { id: string; expires_at: string | null }
      | null;
    if (
      !enr ||
      (enr.expires_at !== null && new Date(enr.expires_at) < new Date())
    ) {
      return NextResponse.json(
        { ok: false, error: "Sem acesso a esta monitoria." },
        { status: 403 },
      );
    }
  }

  // Limpa o meeting number (Zoom aceita só dígitos)
  const meetingNumber = session.zoom_meeting_id.replace(/\D/g, "");
  if (!meetingNumber) {
    return NextResponse.json(
      { ok: false, error: "Meeting ID inválido." },
      { status: 500 },
    );
  }

  // role=0 attendee, role=1 host. Admin entra como host (precisa do
  // ZAK token via OAuth pra realmente assumir host, mas o SDK aceita
  // role=1 e cai pro estado de "host com restrição" se sem ZAK).
  // Pra simplificar, admin/mod=1, aluno=0.
  const role = isAdminOrMod ? 1 : 0;

  // JWT spec do Meeting SDK 2.x — válido por 2h, garante que a session
  // do user no meeting expira mesmo se ele esquecer aberto.
  const iat = Math.floor(Date.now() / 1000) - 30; // -30s pra evitar clock skew
  const exp = iat + 60 * 60 * 2;
  const tokenPayload = {
    appKey: sdkKey,
    sdkKey,
    mn: Number(meetingNumber),
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  const signature = jwt.sign(tokenPayload, sdkSecret, { algorithm: "HS256" });

  return NextResponse.json({
    ok: true,
    signature,
    sdkKey,
    meetingNumber,
    password: session.zoom_password ?? "",
    userName: userRow.full_name ?? userRow.email,
    userEmail: userRow.email,
    role,
  });
}
