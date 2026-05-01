"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { inviteEmailHtml, sendEmail } from "@/lib/email/resend";
import { expiresAtFromDuration } from "@/lib/enrollment";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Sem permissão.");
}

function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local — preencha antes de criar/editar conteúdo.",
    );
  }
  return createAdminClient();
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

function getOrigin(): string {
  const h = headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

// ============================================================
// CREATE STUDENT
// ============================================================

export interface CreateStudentResult {
  userId: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
}

export async function createStudentAction(
  _prev: ActionResult<CreateStudentResult> | null,
  formData: FormData,
): Promise<ActionResult<CreateStudentResult>> {
  await assertAdmin();

  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const phone = nullableStr(formData, "phone");
  const cohortId = nullableStr(formData, "cohort_id");
  const role = str(formData, "role") || "student";

  if (!fullName) return { ok: false, error: "Nome é obrigatório." };
  if (!email) return { ok: false, error: "E-mail é obrigatório." };
  if (!email.includes("@")) return { ok: false, error: "E-mail inválido." };
  if (role !== "student" && role !== "moderator") {
    return { ok: false, error: "Função inválida." };
  }

  const supabase = admin();
  const origin = getOrigin();

  // 1. Cria (ou reaproveita) o user no auth
  let userId: string;
  const {
    data: { users: existingUsers },
  } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // marca como confirmado pra ele só precisar setar senha
      });
    if (createErr || !created.user) {
      return {
        ok: false,
        error: `Falha ao criar usuário: ${createErr?.message ?? "desconhecido"}`,
      };
    }
    userId = created.user.id;
  }

  // 2. Upsert em membros.users
  const { error: profileErr } = await supabase
    .schema("membros")
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        phone,
        role,
        is_active: true,
      },
      { onConflict: "id" },
    );
  if (profileErr) {
    return {
      ok: false,
      error: `Falha ao salvar profile: ${profileErr.message}`,
    };
  }

  // 3. Matricula (se cohort selecionada) — expires_at vem da duração da turma
  if (cohortId) {
    const { data: cohort } = await supabase
      .schema("membros")
      .from("cohorts")
      .select("default_duration_days")
      .eq("id", cohortId)
      .single();
    const expiresAt = expiresAtFromDuration(cohort?.default_duration_days);

    const { data: existingEnroll } = await supabase
      .schema("membros")
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    if (existingEnroll) {
      await supabase
        .schema("membros")
        .from("enrollments")
        .update({
          is_active: true,
          expires_at: expiresAt,
          enrolled_at: new Date().toISOString(),
        })
        .eq("id", existingEnroll.id);
    } else {
      await supabase.schema("membros").from("enrollments").insert({
        user_id: userId,
        cohort_id: cohortId,
        expires_at: expiresAt,
        source: "manual",
      });
    }
  }

  // 4. Gera magic link de recovery (define senha)
  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    });

  if (linkErr || !linkData.properties?.action_link) {
    return {
      ok: false,
      error: `Falha ao gerar convite: ${linkErr?.message ?? "desconhecido"}`,
    };
  }

  const inviteUrl = linkData.properties.action_link;

  // 5. Tenta enviar via Resend (best effort — se falhar, admin copia link)
  const emailResult = await sendEmail({
    to: email,
    subject: "Bem-vindo à Academia NPB — Crie sua senha",
    html: inviteEmailHtml({ fullName, inviteUrl }),
  });

  revalidatePath("/admin/students");
  if (cohortId) revalidatePath(`/admin/cohorts/${cohortId}`);

  return {
    ok: true,
    data: {
      userId,
      inviteUrl,
      emailSent: emailResult.ok,
      emailError: emailResult.error,
    },
  };
}

// ============================================================
// UPDATE STUDENT
// ============================================================

export async function updateStudentAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();

  const fullName = str(formData, "full_name");
  const phone = nullableStr(formData, "phone");
  const isActive = formData.get("is_active") === "on";
  const roleRaw = str(formData, "role");
  const role = roleRaw || null;

  if (!fullName) return { ok: false, error: "Nome é obrigatório." };
  if (role && role !== "student" && role !== "moderator") {
    return {
      ok: false,
      error: "Apenas student ou moderator podem ser definidos por aqui.",
    };
  }

  // Não permitir rebaixar admin via UI
  const { data: current } = await admin()
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", id)
    .single();
  if (current?.role === "admin" && role && role !== "admin") {
    return {
      ok: false,
      error: "Use o painel do Supabase para alterar a função de um admin.",
    };
  }

  const update: Record<string, unknown> = {
    full_name: fullName,
    phone,
    is_active: isActive,
  };
  if (role && current?.role !== "admin") {
    update.role = role;
  }

  const { error } = await admin()
    .schema("membros")
    .from("users")
    .update(update)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return { ok: true };
}

export async function setStudentPasswordAction(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return {
        ok: false,
        error: "A senha precisa ter pelo menos 8 caracteres.",
      };
    }

    const supabase = admin();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/students/${userId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function setStudentActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  await assertAdmin();
  const { error } = await admin()
    .schema("membros")
    .from("users")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
}

// ============================================================
// RESEND INVITE
// ============================================================

export async function resendInviteAction(
  userId: string,
): Promise<ActionResult<{ inviteUrl: string; emailSent: boolean; emailError?: string }>> {
  await assertAdmin();

  const supabase = admin();
  const origin = getOrigin();

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!profile) return { ok: false, error: "Aluno não encontrado." };

  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    });

  if (linkErr || !linkData.properties?.action_link) {
    return {
      ok: false,
      error: `Falha ao gerar convite: ${linkErr?.message ?? "desconhecido"}`,
    };
  }

  const inviteUrl = linkData.properties.action_link;

  const emailResult = await sendEmail({
    to: profile.email,
    subject: "Academia NPB — Acesso à sua conta",
    html: inviteEmailHtml({
      fullName: profile.full_name ?? "",
      inviteUrl,
    }),
  });

  return {
    ok: true,
    data: {
      inviteUrl,
      emailSent: emailResult.ok,
      emailError: emailResult.error,
    },
  };
}
