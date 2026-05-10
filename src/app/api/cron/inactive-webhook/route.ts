import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron de webhook de inatividade — roda 1×/dia.
 *
 * Detecta alunos que CRUZARAM o threshold de inatividade nas últimas 24h
 * (ou seja, ontem ainda eram ativos, hoje viraram inativos) e dispara
 * POST pra `inactive_user_webhook_url` configurado em platform_settings.
 *
 * Critério de "cruzou hoje":
 *   - last_sign_in_at >= now() - (threshold + 1) dias
 *   - last_sign_in_at <  now() - threshold dias
 * (i.e., dentro da janela de 1 dia centrada no threshold)
 *
 * Idempotência: tabela `inactive_webhook_log` com PK (user_id, fired_on)
 * — tentativa de inserir 2x no mesmo dia falha sem efeito colateral.
 *
 * Aluno que NUNCA logou NÃO dispara (não é "transição" — é estado inicial).
 *
 * Status: noop quando webhook URL vazia (Felipe configura quando o fluxo
 * Unnichat estiver pronto).
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron adiciona
 * automaticamente quando configurado em vercel.json.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();
  const settings = await getPlatformSettings(sb);
  const thresholdDays = settings.inactivityThresholdDays;
  const webhookUrl = settings.inactiveUserWebhookUrl;

  // Janela de transição: quem cruzou o threshold nas últimas 24h
  const cutoffNow = new Date(
    Date.now() - thresholdDays * 86400000,
  ).toISOString();
  const cutoffYesterday = new Date(
    Date.now() - (thresholdDays + 1) * 86400000,
  ).toISOString();

  // Pega candidatos (só roles de aluno, com email confirmado)
  const { data: candidatesRaw } = await sb
    .schema("membros")
    .from("students_admin")
    .select("id, email, full_name, last_sign_in_at")
    .in("role", ["student", "ficticio"])
    .gte("last_sign_in_at", cutoffYesterday)
    .lt("last_sign_in_at", cutoffNow);

  const candidates = (candidatesRaw ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    last_sign_in_at: string;
  }>;

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      detected: 0,
      fired: 0,
      threshold_days: thresholdDays,
      webhook_configured: Boolean(webhookUrl),
      message: "Ninguém cruzou o threshold nas últimas 24h.",
    });
  }

  let fired = 0;
  let skipped = 0;
  let webhookFailed = 0;

  for (const c of candidates) {
    // Lock idempotente: insere log primeiro. Se conflict (já fired hoje), pula.
    const { error: insertErr } = await sb
      .schema("membros")
      .from("inactive_webhook_log")
      .insert({
        user_id: c.id,
        fired_at: new Date().toISOString(),
        // fired_on usa default (now() AT TIME ZONE 'America/Sao_Paulo')::date
      });

    if (insertErr) {
      // 23505 = unique violation = já disparado hoje
      if (insertErr.code === "23505") {
        skipped++;
        continue;
      }
      // Outro erro DB — loga e continua
      console.error("[inactive-webhook] insert log failed", c.id, insertErr);
      continue;
    }

    // Sem URL configurada: registra a transição mas não dispara HTTP
    if (!webhookUrl) {
      fired++; // conta a transição detectada
      continue;
    }

    // Dispara o POST
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMsg: string | null = null;

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "user.became_inactive",
          user: {
            id: c.id,
            email: c.email,
            full_name: c.full_name,
            last_sign_in_at: c.last_sign_in_at,
          },
          threshold_days: thresholdDays,
        }),
        // Timeout 10s — não trava o cron se webhook for lento
        signal: AbortSignal.timeout(10_000),
      });
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 500); // trunca
      if (!res.ok) webhookFailed++;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "unknown";
      webhookFailed++;
    }

    // Atualiza o log com resultado do POST
    await sb
      .schema("membros")
      .from("inactive_webhook_log")
      .update({
        response_status: responseStatus,
        response_body: responseBody,
        error: errorMsg,
      })
      .eq("user_id", c.id)
      .eq("fired_on", new Date().toISOString().slice(0, 10));

    fired++;
  }

  return NextResponse.json({
    ok: true,
    detected: candidates.length,
    fired,
    skipped,
    webhook_failed: webhookFailed,
    threshold_days: thresholdDays,
    webhook_configured: Boolean(webhookUrl),
  });
}
