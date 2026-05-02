import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { inviteEmailHtml, sendEmail } from "@/lib/email/resend";
import { expiresAtFromDuration } from "@/lib/enrollment";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StudentPayload {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface EnrollmentPayload {
  event?: string;
  student?: StudentPayload;
  cohort_id?: string;
  expires_at?: string | null;
}

interface SuccessBody {
  success: true;
  user_id: string;
  enrollment_id: string;
  invite_email_sent?: boolean;
}

interface ErrorBody {
  success: false;
  error: string;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let payload: EnrollmentPayload | null = null;

  try {
    if (!process.env.WEBHOOK_SECRET) {
      return errorResponse(500, "WEBHOOK_SECRET não configurado.", null);
    }

    const auth = headers().get("authorization") ?? "";
    const expected = `Bearer ${process.env.WEBHOOK_SECRET}`;
    if (!constantTimeEqual(auth, expected)) {
      return errorResponse(401, "Token inválido.", null);
    }

    try {
      payload = (await request.json()) as EnrollmentPayload;
    } catch {
      return errorResponse(400, "JSON inválido.", null);
    }

    const event = (payload?.event ?? "enrollment.created").toLowerCase();
    const email = (payload?.student?.email ?? "").trim().toLowerCase();
    const cohortId = (payload?.cohort_id ?? "").trim();

    if (!email || !email.includes("@")) {
      return errorResponse(400, "student.email é obrigatório.", payload);
    }
    if (!cohortId) {
      return errorResponse(400, "cohort_id é obrigatório.", payload);
    }

    const supabase = createAdminClient();

    const { data: cohort } = await supabase
      .schema("membros")
      .from("cohorts")
      .select("id, default_duration_days")
      .eq("id", cohortId)
      .maybeSingle();

    if (!cohort) {
      return errorResponse(404, `Turma ${cohortId} não encontrada.`, payload);
    }

    const userId = await resolveUserId(supabase, email);
    if (!userId.ok) {
      return errorResponse(500, userId.error, payload);
    }

    const fullName = payload?.student?.name?.trim() || "";
    const phone = payload?.student?.phone?.trim() || null;

    const { error: profileErr } = await supabase
      .schema("membros")
      .from("users")
      .upsert(
        {
          id: userId.id,
          email,
          full_name: fullName || null,
          phone,
          role: "student",
          is_active: true,
        },
        { onConflict: "id" },
      );
    if (profileErr) {
      return errorResponse(
        500,
        `Falha ao salvar profile: ${profileErr.message}`,
        payload,
      );
    }

    if (event === "enrollment.cancelled" || event === "enrollment.refunded") {
      const { data: existing } = await supabase
        .schema("membros")
        .from("enrollments")
        .select("id")
        .eq("user_id", userId.id)
        .eq("cohort_id", cohortId)
        .maybeSingle();

      if (!existing) {
        return errorResponse(
          404,
          "Matrícula a cancelar não foi encontrada.",
          payload,
        );
      }

      await supabase
        .schema("membros")
        .from("enrollments")
        .update({ is_active: false })
        .eq("id", existing.id);

      await logSuccess(supabase, payload, userId.id, startedAt);

      return NextResponse.json<SuccessBody>(
        {
          success: true,
          user_id: userId.id,
          enrollment_id: existing.id,
        },
        { status: 200 },
      );
    }

    const expiresAt = pickExpiresAt(payload?.expires_at, cohort.default_duration_days);

    const { data: existingEnroll } = await supabase
      .schema("membros")
      .from("enrollments")
      .select("id")
      .eq("user_id", userId.id)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    let enrollmentId: string;

    if (existingEnroll) {
      const { error: updErr } = await supabase
        .schema("membros")
        .from("enrollments")
        .update({
          is_active: true,
          expires_at: expiresAt,
          enrolled_at: new Date().toISOString(),
          source: "webhook",
          webhook_payload: payload,
        })
        .eq("id", existingEnroll.id);
      if (updErr) {
        return errorResponse(
          500,
          `Falha ao reativar matrícula: ${updErr.message}`,
          payload,
        );
      }
      enrollmentId = existingEnroll.id;
    } else {
      const { data: created, error: insErr } = await supabase
        .schema("membros")
        .from("enrollments")
        .insert({
          user_id: userId.id,
          cohort_id: cohortId,
          expires_at: expiresAt,
          source: "webhook",
          webhook_payload: payload,
        })
        .select("id")
        .single();
      if (insErr || !created) {
        return errorResponse(
          500,
          `Falha ao criar matrícula: ${insErr?.message ?? "desconhecido"}`,
          payload,
        );
      }
      enrollmentId = created.id;
    }

    let inviteEmailSent = false;
    if (userId.created) {
      inviteEmailSent = await sendInvite(supabase, email, fullName);
    }

    await logSuccess(supabase, payload, userId.id, startedAt);

    return NextResponse.json<SuccessBody>(
      {
        success: true,
        user_id: userId.id,
        enrollment_id: enrollmentId,
        invite_email_sent: inviteEmailSent,
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return errorResponse(500, msg, payload);
  }
}

type ResolveResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<ResolveResult> {
  const {
    data: { users },
    error: listErr,
  } = await supabase.auth.admin.listUsers();
  if (listErr) {
    return { ok: false, error: `Falha ao listar usuários: ${listErr.message}` };
  }

  const existing = users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    return { ok: true, id: existing.id, created: false };
  }

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
  if (createErr || !created.user) {
    return {
      ok: false,
      error: `Falha ao criar usuário: ${createErr?.message ?? "desconhecido"}`,
    };
  }
  return { ok: true, id: created.user.id, created: true };
}

function pickExpiresAt(
  payloadExpires: string | null | undefined,
  cohortDuration: number | null | undefined,
): string | null {
  if (payloadExpires) {
    const d = new Date(payloadExpires);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return expiresAtFromDuration(cohortDuration);
}

async function sendInvite(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  fullName: string,
): Promise<boolean> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
    });

    const inviteUrl = linkData?.properties?.action_link;
    const loginUrl = `${origin}/login?email=${encodeURIComponent(email)}`;

    const settings = await getPlatformSettings(supabase);
    const result = await sendEmail({
      to: email,
      subject: `Bem-vindo à ${settings.platformName}`,
      html: inviteEmailHtml({
        fullName: fullName || "novo aluno",
        email,
        // Webhook não define senha — usuário usa o link de recovery
        // (ou clica em "esqueci senha" depois). Se quiser senha padrão
        // aqui também, daria pra adicionar como TODO.
        password: null,
        loginUrl,
        inviteUrl,
        platformName: settings.platformName,
        platformLogoUrl: settings.platformLogoUrl,
      }),
    });
    return result.ok;
  } catch {
    return false;
  }
}

async function logSuccess(
  supabase: ReturnType<typeof createAdminClient>,
  payload: EnrollmentPayload | null,
  userId: string,
  startedAt: number,
) {
  try {
    await supabase
      .schema("membros")
      .from("webhook_logs")
      .insert({
        payload: { ...payload, _processing_ms: Date.now() - startedAt },
        status: "success",
        user_id: userId,
      });
  } catch {
    // log de log: não interrompe a resposta
  }
}

function errorResponse(
  status: number,
  message: string,
  payload: EnrollmentPayload | null,
) {
  void logError(message, payload);
  return NextResponse.json<ErrorBody>(
    { success: false, error: message },
    { status },
  );
}

async function logError(message: string, payload: EnrollmentPayload | null) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const supabase = createAdminClient();
    await supabase
      .schema("membros")
      .from("webhook_logs")
      .insert({
        payload: payload ?? {},
        status: "error",
        error_message: message,
      });
  } catch {
    // best-effort
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
