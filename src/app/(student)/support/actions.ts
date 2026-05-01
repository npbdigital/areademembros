"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformSettings } from "@/lib/settings";

export type ActionResult = { ok: boolean; error?: string };

const FALLBACK_SUPPORT_EMAIL = "suporte@felipesempe.com.br";

export async function sendSupportRequestAction(
  payload: {
    enrollmentId: string | null;
    subject: string;
    message: string;
  },
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return { ok: false, error: "Sessão inválida." };
    }

    const subject = (payload.subject ?? "").trim();
    const message = (payload.message ?? "").trim();
    if (!subject) return { ok: false, error: "Assunto é obrigatório." };
    if (!message) return { ok: false, error: "Mensagem é obrigatória." };
    if (message.length > 5000) {
      return { ok: false, error: "Mensagem muito longa (máx. 5000 caracteres)." };
    }

    // Pega o profile do aluno (admin client pra bypassar RLS)
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .schema("membros")
      .from("users")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single();

    // Resolve a turma escolhida (se houver) pra pegar o prefix
    let cohortName: string | null = null;
    let supportPrefix: string | null = null;
    if (payload.enrollmentId) {
      const { data: enrollment } = await adminSupabase
        .schema("membros")
        .from("enrollments")
        .select("cohorts(name, support_prefix)")
        .eq("id", payload.enrollmentId)
        .eq("user_id", user.id)
        .maybeSingle();

      const enrRow = enrollment as
        | {
            cohorts:
              | { name: string; support_prefix: string | null }
              | { name: string; support_prefix: string | null }[]
              | null;
          }
        | null;
      const c = enrRow?.cohorts
        ? Array.isArray(enrRow.cohorts)
          ? enrRow.cohorts[0]
          : enrRow.cohorts
        : null;
      cohortName = c?.name ?? null;
      supportPrefix = c?.support_prefix?.trim() || null;
    }

    const settings = await getPlatformSettings(adminSupabase);
    const supportEmail =
      settings.supportEmail?.trim() || FALLBACK_SUPPORT_EMAIL;

    const finalSubject = supportPrefix
      ? `[${supportPrefix}] ${subject}`
      : subject;

    const html = buildSupportEmailHtml({
      subject: finalSubject,
      message,
      studentName: profile?.full_name ?? "(sem nome)",
      studentEmail: profile?.email ?? user.email,
      studentPhone: profile?.phone ?? null,
      cohortName,
      supportPrefix,
    });

    const result = await sendEmail({
      to: supportEmail,
      subject: finalSubject,
      html,
      replyTo: profile?.email ?? user.email,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "Falha ao enviar." };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSupportEmailHtml(p: {
  subject: string;
  message: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  cohortName: string | null;
  supportPrefix: string | null;
}): string {
  const lines = [
    ["Aluno", p.studentName],
    ["E-mail", p.studentEmail],
    p.studentPhone ? ["Telefone", p.studentPhone] : null,
    p.cohortName ? ["Turma", p.cohortName] : null,
    p.supportPrefix ? ["Prefixo", p.supportPrefix] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const meta = lines
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#888;font-size:12px;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#f0f0f0;font-size:13px;font-weight:500;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const safeMessage = escapeHtml(p.message).replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0d0d0d;color:#f0f0f0;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:2px;color:#c9922a;font-weight:700;">SUPORTE — ÁREA DE MEMBROS</div>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#f0f0f0;">${escapeHtml(p.subject)}</h1>
    </div>

    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
      <table cellpadding="0" cellspacing="0" border="0">${meta}</table>
    </div>

    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:24px;">
      <div style="font-size:11px;letter-spacing:2px;color:#888;margin-bottom:12px;">MENSAGEM</div>
      <div style="font-size:14px;line-height:1.6;color:#cfcfcf;white-space:pre-wrap;">${safeMessage}</div>
    </div>

    <p style="margin-top:24px;font-size:11px;color:#666;">
      Responda direto neste e-mail — vai chegar em ${escapeHtml(p.studentEmail)}.
    </p>
  </div>
</body>
</html>`;
}
