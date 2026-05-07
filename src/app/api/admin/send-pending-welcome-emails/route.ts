import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { inviteEmailHtml, sendEmail } from "@/lib/email/resend";
import { getPlatformSettings } from "@/lib/settings";
import { DEFAULT_STUDENT_PASSWORD } from "@/lib/auto-enroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dispara emails de boas-vindas pra todo aluno que tem
 * welcome_email_sent_at = NULL e tem enrollment ativo. Util pra:
 *   - Backfill: alunos cadastrados ANTES do auto-enroll passar a
 *     enviar email automaticamente
 *   - Recovery: se um lote de envios falhou e foi revertido pra NULL
 *
 * Usa o MESMO sendWelcomeEmail-like fluxo (lock atomico via UPDATE
 * WHERE welcome_email_sent_at IS NULL) pra garantir que mesmo se essa
 * rota for chamada multiplas vezes em paralelo, cada aluno recebe so
 * um email.
 *
 * Limita a 50 por chamada pra nao estourar maxDuration. Pra base
 * grande, chamar varias vezes ate retornar sent=0.
 *
 * Auth: requer admin logado. Sem token externo.
 */
export async function POST(req: NextRequest) {
  // Auth via cookie (admin logado)
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
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Sem permissão." },
      { status: 403 },
    );
  }

  const sb = createAdminClient();
  const settings = await getPlatformSettings(sb);

  // Pega 50 alunos sem email enviado que TEM enrollment ativo
  const { data: pendingRaw } = await sb
    .schema("membros")
    .from("users")
    .select("id, email, full_name")
    .is("welcome_email_sent_at", null)
    .eq("is_active", true)
    .in("role", ["student"])
    .limit(50);

  const candidates = (pendingRaw ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
  }>;
  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      message: "Nenhum aluno pendente.",
    });
  }

  // Filtra so quem tem enrollment ativo (evita disparar pra users de teste
  // ou ficticios que ficaram sem enrollment)
  const ids = candidates.map((c) => c.id);
  const { data: enrollsRaw } = await sb
    .schema("membros")
    .from("enrollments")
    .select("user_id")
    .in("user_id", ids)
    .eq("is_active", true);
  const withEnrollment = new Set(
    ((enrollsRaw ?? []) as Array<{ user_id: string }>).map((e) => e.user_id),
  );
  const targets = candidates.filter((c) => withEnrollment.has(c.id));

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const results: Array<{
    email: string;
    ok: boolean;
    error?: string;
    skipped?: boolean;
  }> = [];

  for (const t of targets) {
    // Lock atomico individual: marca timestamp WHERE ainda NULL
    const { data: marked } = await sb
      .schema("membros")
      .from("users")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", t.id)
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!marked) {
      results.push({ email: t.email, ok: true, skipped: true });
      continue;
    }

    const loginUrl = `${origin}/auto-login?e=${encodeURIComponent(t.email)}&p=${encodeURIComponent(DEFAULT_STUDENT_PASSWORD)}`;
    const html = inviteEmailHtml({
      fullName: t.full_name ?? "novo aluno",
      email: t.email,
      password: DEFAULT_STUDENT_PASSWORD,
      loginUrl,
      platformName: settings.platformName,
      platformLogoUrl: settings.platformLogoUrl,
    });

    const r = await sendEmail({
      to: t.email,
      subject: `Seu acesso à ${settings.platformName} está pronto`,
      html,
    });

    if (r.ok) {
      results.push({ email: t.email, ok: true });
    } else {
      // Reverte timestamp pra que outra rodada tente de novo
      await sb
        .schema("membros")
        .from("users")
        .update({ welcome_email_sent_at: null })
        .eq("id", t.id);
      results.push({ email: t.email, ok: false, error: r.error });
    }
  }

  const sent = results.filter((r) => r.ok && !r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;

  return NextResponse.json({
    ok: true,
    candidates_found: candidates.length,
    targets_with_enrollment: targets.length,
    sent,
    failed,
    skipped,
    results,
  });
}
