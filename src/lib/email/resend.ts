import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { buildResendFrom, getPlatformSettings } from "@/lib/settings";

let cached: Resend | null = null;

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Resolve o "From" preferindo, nessa ordem:
 *   1. params.from (override explícito do caller)
 *   2. platform_settings.email_from_address/name
 *   3. RESEND_FROM_EMAIL/RESEND_FROM_NAME do .env
 *   4. "Academia NPB <onboarding@resend.dev>" (default)
 *
 * Quando não tem service_role disponível, cai pro env/default.
 */
async function resolveFrom(override?: string): Promise<string> {
  if (override) return override;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return buildResendFrom(null);
  }
  try {
    const supabase = createAdminClient();
    const settings = await getPlatformSettings(supabase);
    return buildResendFrom(settings);
  } catch {
    return buildResendFrom(null);
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY ausente." };
  }
  try {
    const from = await resolveFrom(params.from);
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Template do e-mail de convite enviado quando admin cria um aluno.
 *
 * Mostra credenciais (login + senha padrão) e CTA pra /login.
 * Mantém o link de recovery embaixo como fallback caso o aluno prefira
 * definir uma senha personalizada já no primeiro acesso.
 */
export function inviteEmailHtml(params: {
  fullName: string;
  email: string;
  /** Senha em texto plano. Quando ausente, o template orienta usar a senha atual. */
  password?: string | null;
  loginUrl: string;
  /** Recovery link gerado pelo Supabase (opcional — usado como fallback). */
  inviteUrl?: string;
  platformName?: string;
}): string {
  const platformName = params.platformName ?? "Academia NPB";
  const safeName = escapeHtml(params.fullName || "novo aluno");
  const safePlatform = escapeHtml(platformName);
  const safeEmail = escapeHtml(params.email);

  const credentialsBlock = params.password
    ? `<div style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:6px 0;color:#888;font-size:12px;width:80px;">E-mail</td>
            <td style="padding:6px 0;color:#f0f0f0;font-size:14px;font-weight:600;font-family:monospace;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#888;font-size:12px;">Senha</td>
            <td style="padding:6px 0;color:#c9922a;font-size:16px;font-weight:700;font-family:monospace;letter-spacing:2px;">${escapeHtml(params.password)}</td>
          </tr>
        </table>
      </div>`
    : `<div style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#cfcfcf;line-height:1.6;">
          Faça login com seu e-mail (<span style="color:#f0f0f0;font-family:monospace;font-weight:600;">${safeEmail}</span>) e a senha que você já usa.
          Se esqueceu, use o link de recuperação abaixo.
        </p>
      </div>`;

  const recoveryBlock = params.inviteUrl
    ? `<p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5;text-align:center;">
        ${params.password ? "Prefere definir uma senha personalizada agora?" : "Esqueceu a senha?"}
        <a href="${params.inviteUrl}" style="color:#c9922a;">Clique aqui</a>.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0d0d0d;color:#f0f0f0;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#c9922a,#7a5618);text-align:center;line-height:48px;font-weight:700;color:#fff;">A</div>
      <div style="margin-top:12px;font-size:14px;letter-spacing:2px;color:#c9922a;">${safePlatform.toUpperCase()}</div>
    </div>

    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:32px 28px;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f0f0f0;">Bem-vindo, ${safeName}!</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#cfcfcf;">
        Seu acesso à área de membros foi liberado.
      </p>

      ${credentialsBlock}

      <div style="text-align:center;margin:24px 0;">
        <a href="${params.loginUrl}"
           style="display:inline-block;background:#c9922a;color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:14px;">
          Acessar minha conta
        </a>
      </div>

      <p style="margin:20px 0 0;font-size:12px;color:#888;line-height:1.6;">
        <strong style="color:#cfcfcf;">Recomendado:</strong> ao entrar, vá em <em>Meu perfil → Trocar senha</em> e defina uma senha pessoal.
      </p>

      ${recoveryBlock}
    </div>

    <p style="text-align:center;margin-top:24px;font-size:11px;color:#666;">
      Este e-mail foi enviado por ${safePlatform}. Se você não esperava recebê-lo, ignore.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
