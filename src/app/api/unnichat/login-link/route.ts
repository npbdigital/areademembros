import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { buildShortOneClickUrl, generateMagicToken } from "@/lib/one-click";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint para o Unnichat (ou qualquer automação externa) puxar o link
 * one-click do aluno SOMENTE pelo e-mail.
 *
 * Uso típico: fluxo do Unnichat em mensagens fora do contexto de compra
 * (lembretes, reativação, suporte). Unnichat já tem o e-mail do lead nos
 * campos dele — chama esse endpoint, recebe o link e cola na próxima
 * mensagem de WhatsApp.
 *
 * Auth: header `Authorization: Bearer ${UNNICHAT_API_TOKEN}` (env var).
 *
 * Request:
 *   POST /api/unnichat/login-link
 *   Headers: Authorization: Bearer <secret>
 *   Body: { "email": "aluno@email.com" }
 *
 * Response (200 ok):
 *   {
 *     "success": true,
 *     "email": "aluno@email.com",
 *     "login_url": "https://membros.felipesempe.com.br/l/aBc123",
 *     "expires_at": "2026-05-12T15:00:00Z"
 *   }
 *
 * Response (404):
 *   { "success": false, "error": "Aluno nao encontrado." }
 *
 * Reaproveita token vigente se existir (validade 7d), evita encher a
 * tabela quando Unnichat re-puxa o link várias vezes pro mesmo lead.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.UNNICHAT_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: "UNNICHAT_API_TOKEN não configurado." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { success: false, error: "Token inválido." },
      { status: 401 },
    );
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, error: "Campo email é obrigatório e deve ser válido." },
      { status: 400 },
    );
  }

  try {
    const sb = createAdminClient();

    // Localiza aluno pelo e-mail (case-insensitive — DB armazena em lowercase
    // mas defensivo). Usa membros.users (perfil) como fonte de verdade —
    // user precisa ter completado pelo menos o webhook de enrollment.
    const { data: userRow } = await sb
      .schema("membros")
      .from("users")
      .select("id, email, full_name, role, is_active")
      .ilike("email", email)
      .maybeSingle();

    const u = userRow as
      | {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }
      | null;

    if (!u) {
      return NextResponse.json(
        {
          success: false,
          error: "Aluno não encontrado nessa plataforma.",
        },
        { status: 404 },
      );
    }

    if (!u.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: "Aluno está com cadastro inativo.",
        },
        { status: 403 },
      );
    }

    // Gera (ou reaproveita) magic token
    const magic = await generateMagicToken(u.id, "unnichat");
    if (!magic) {
      return NextResponse.json(
        { success: false, error: "Falha ao gerar token." },
        { status: 500 },
      );
    }

    const loginUrl = await buildShortOneClickUrl(magic.token);

    return NextResponse.json({
      success: true,
      email: u.email,
      full_name: u.full_name,
      login_url: loginUrl,
      expires_at: magic.expiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}

/** GET pra healthcheck rápido. */
export async function GET(req: NextRequest) {
  const expected = process.env.UNNICHAT_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: "UNNICHAT_API_TOKEN não configurado." },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { success: false, error: "Token inválido." },
      { status: 401 },
    );
  }
  return NextResponse.json({
    success: true,
    message:
      "Endpoint pronto. Use POST com body { email } pra receber login_url.",
  });
}
