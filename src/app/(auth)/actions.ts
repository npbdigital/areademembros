"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = {
  ok: boolean;
  error?: string;
};

// =============================================
// LOGIN — email + senha
// =============================================
export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Preencha e-mail e senha." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagens amigáveis em PT-BR para erros conhecidos
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    if (msg.includes("email not confirmed")) {
      return {
        ok: false,
        error: "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// =============================================
// FORGOT PASSWORD — envia e-mail de recuperação
// =============================================
export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { ok: false, error: "Informe seu e-mail." };
  }

  const supabase = createClient();
  const origin =
    headers().get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Sempre devolve ok mesmo se o e-mail não existir (evita enumeração)
  return { ok: true };
}

// =============================================
// RESET PASSWORD — usuário já autenticado via magic link
// =============================================
export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { ok: false, error: "As senhas não conferem." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Sessão expirada. Solicite o link de recuperação novamente.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// =============================================
// SIGN OUT — usado pelo header/menu de qualquer rota
// =============================================
export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
