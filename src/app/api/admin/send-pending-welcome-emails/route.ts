import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  inviteEmailHtml,
  newAccessEmailHtml,
  sendEmail,
} from "@/lib/email/resend";
import { getPlatformSettings } from "@/lib/settings";
import { DEFAULT_STUDENT_PASSWORD } from "@/lib/auto-enroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Backfill de emails de boas-vindas. Roda em 2 niveis pra cobrir os
 * casos que existem no banco antes desse fix:
 *
 *   1. Alunos com users.welcome_email_sent_at = NULL e enrollment ativo
 *      -> email INICIAL com senha "mudar123"
 *   2. Alunos que JA receberam o email inicial mas tem enrollment com
 *      welcome_email_sent_at = NULL (ex: comprou produto B depois do A)
 *      -> email "novo acesso liberado: <turma>" sem senha
 *
 * Lock atomico via UPDATE WHERE coluna IS NULL — chamadas concorrentes
 * sao seguras, so a primeira efetivamente envia.
 *
 * Limita a 25 alunos + 25 enrollments por chamada pra caber em 60s.
 *
 * Auth: admin logado via cookie.
 */
export async function POST(req: NextRequest) {
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
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  let initialSent = 0;
  let initialFailed = 0;
  let newAccessSent = 0;
  let newAccessFailed = 0;

  // ---------- LEVEL 1: email inicial pros alunos sem flag ----------
  const { data: pendingUsers } = await sb
    .schema("membros")
    .from("users")
    .select("id, email, full_name")
    .is("welcome_email_sent_at", null)
    .eq("is_active", true)
    .in("role", ["student"])
    .limit(25);

  const userCandidates = (pendingUsers ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
  }>;

  // Filtra: so quem tem enrollment ativo (evita disparar pra teste)
  const userIds = userCandidates.map((c) => c.id);
  let usersWithEnrollment: Set<string> = new Set();
  if (userIds.length > 0) {
    const { data: ens } = await sb
      .schema("membros")
      .from("enrollments")
      .select("user_id")
      .in("user_id", userIds)
      .eq("is_active", true);
    usersWithEnrollment = new Set(
      ((ens ?? []) as Array<{ user_id: string }>).map((e) => e.user_id),
    );
  }
  const userTargets = userCandidates.filter((c) =>
    usersWithEnrollment.has(c.id),
  );

  for (const t of userTargets) {
    const { data: marked } = await sb
      .schema("membros")
      .from("users")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", t.id)
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!marked) continue;

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
      initialSent++;
      // Marca tambem o enrollment ativo dele pra evitar email duplicado
      // de "novo acesso" depois (o welcome inicial cobre)
      await sb
        .schema("membros")
        .from("enrollments")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("user_id", t.id)
        .eq("is_active", true)
        .is("welcome_email_sent_at", null);
    } else {
      initialFailed++;
      await sb
        .schema("membros")
        .from("users")
        .update({ welcome_email_sent_at: null })
        .eq("id", t.id);
    }
  }

  // ---------- LEVEL 2: email "novo acesso" pra enrollments pendentes ----------
  // Pega enrollments ativos sem welcome_email_sent_at, cujo user JA TEM
  // o welcome inicial (significa que ele tem login mas ainda nao foi
  // notificado dessa matricula nova).
  const { data: pendingEnrolls } = await sb
    .schema("membros")
    .from("enrollments")
    .select("id, user_id, cohort_id")
    .is("welcome_email_sent_at", null)
    .eq("is_active", true)
    .limit(25);

  const enrollCandidates = (pendingEnrolls ?? []) as Array<{
    id: string;
    user_id: string;
    cohort_id: string;
  }>;

  if (enrollCandidates.length > 0) {
    const enrollUserIds = Array.from(
      new Set(enrollCandidates.map((e) => e.user_id)),
    );
    const cohortIds = Array.from(
      new Set(enrollCandidates.map((e) => e.cohort_id)),
    );

    // So pra users que JA receberam o welcome inicial
    const { data: usersData } = await sb
      .schema("membros")
      .from("users")
      .select("id, email, full_name, welcome_email_sent_at")
      .in("id", enrollUserIds)
      .not("welcome_email_sent_at", "is", null);
    const userMap = new Map(
      ((usersData ?? []) as Array<{
        id: string;
        email: string;
        full_name: string | null;
      }>).map((u) => [u.id, u]),
    );

    const { data: cohortsData } = await sb
      .schema("membros")
      .from("cohorts")
      .select("id, name")
      .in("id", cohortIds);
    const cohortMap = new Map(
      ((cohortsData ?? []) as Array<{ id: string; name: string }>).map((c) => [
        c.id,
        c,
      ]),
    );

    for (const e of enrollCandidates) {
      const u = userMap.get(e.user_id);
      const c = cohortMap.get(e.cohort_id);
      if (!u || !c) continue;

      const { data: marked } = await sb
        .schema("membros")
        .from("enrollments")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", e.id)
        .is("welcome_email_sent_at", null)
        .select("id")
        .maybeSingle();
      if (!marked) continue;

      const loginUrl = `${origin}/auto-login?e=${encodeURIComponent(u.email)}&p=${encodeURIComponent(DEFAULT_STUDENT_PASSWORD)}`;
      const html = newAccessEmailHtml({
        fullName: u.full_name ?? "aluno",
        cohortName: c.name,
        loginUrl,
        platformName: settings.platformName,
        platformLogoUrl: settings.platformLogoUrl,
      });

      const r = await sendEmail({
        to: u.email,
        subject: `Novo acesso liberado: ${c.name}`,
        html,
      });
      if (r.ok) {
        newAccessSent++;
      } else {
        newAccessFailed++;
        await sb
          .schema("membros")
          .from("enrollments")
          .update({ welcome_email_sent_at: null })
          .eq("id", e.id);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    initial_sent: initialSent,
    initial_failed: initialFailed,
    new_access_sent: newAccessSent,
    new_access_failed: newAccessFailed,
    total_sent: initialSent + newAccessSent,
    note:
      initialSent === 0 && newAccessSent === 0
        ? "Nada pendente."
        : "Continue chamando ate retornar total_sent=0.",
  });
}
