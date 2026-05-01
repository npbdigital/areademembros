import { Resend } from "resend";

const FROM_DEFAULT = "Academia NPB <onboarding@resend.dev>";

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

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY ausente." };
  }
  try {
    const { error } = await resend.emails.send({
      from: params.from ?? FROM_DEFAULT,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function inviteEmailHtml(params: {
  fullName: string;
  inviteUrl: string;
}): string {
  const safeName = escapeHtml(params.fullName || "novo aluno");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0d0d0d;color:#f0f0f0;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#c9922a,#7a5618);text-align:center;line-height:48px;font-weight:700;color:#fff;">A</div>
      <div style="margin-top:12px;font-size:14px;letter-spacing:2px;color:#c9922a;">ACADEMIA NPB</div>
    </div>

    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:32px 28px;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f0f0f0;">Bem-vindo, ${safeName}!</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#cfcfcf;">
        Seu acesso à Área de Membros da Academia NPB foi liberado.
        Pra começar, defina sua senha clicando no botão abaixo:
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.inviteUrl}"
           style="display:inline-block;background:#c9922a;color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:14px;">
          Definir minha senha
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${params.inviteUrl}" style="color:#c9922a;word-break:break-all;">${params.inviteUrl}</a>
      </p>
    </div>

    <p style="text-align:center;margin-top:24px;font-size:11px;color:#666;">
      Este e-mail foi enviado por Academia NPB. Se você não esperava recebê-lo, ignore.
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
