"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { backfillOrphanSales } from "@/lib/affiliates/process";
import { normalizeEmail } from "@/lib/affiliates/normalize";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  return user.id;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function sanitizeDigitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Cria a vinculação Kiwify do user logado.
 *
 * Identificação: email Kiwify (chave única) + nome (segundo fator).
 * O nome cadastrado precisa bater com o "custom_name" que vem nos webhooks
 * de venda — match feito após normalização (lowercase, sem acento, espaços
 * colapsados).
 *
 * - Email obrigatório (case-insensitive UNIQUE — impede 2 alunos pegarem o
 *   mesmo)
 * - Nome obrigatório (segundo fator de verificação)
 * - CPF/CNPJ opcional (criptografado AES-256-GCM, só pra audit do admin)
 * - registered_at = agora (vendas anteriores não contam)
 * - verified começa false; vira true quando 1ª venda chegar com email + nome
 *   batendo
 */
export async function linkKiwifyAffiliateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ attached: number }>> {
  try {
    const userId = await requireUserId();

    const kiwifyEmail = normalizeEmail(str(formData, "kiwify_email"));
    const kiwifyName = str(formData, "kiwify_name");

    if (!kiwifyEmail) {
      return { ok: false, error: "Informe o e-mail cadastrado na Kiwify." };
    }
    if (!kiwifyEmail.includes("@") || kiwifyEmail.length > 254) {
      return { ok: false, error: "E-mail inválido." };
    }
    if (!kiwifyName) {
      return { ok: false, error: "Informe o nome exato cadastrado na Kiwify." };
    }
    if (kiwifyName.length > 200) {
      return { ok: false, error: "Nome muito longo." };
    }

    const cpfCnpjRaw = str(formData, "cpf_cnpj");
    const cpfCnpjDigits = sanitizeDigitsOnly(cpfCnpjRaw);
    if (
      cpfCnpjDigits &&
      cpfCnpjDigits.length !== 11 &&
      cpfCnpjDigits.length !== 14
    ) {
      return { ok: false, error: "CPF deve ter 11 dígitos ou CNPJ 14." };
    }

    const supabase = createAdminClient();

    // Checa se o user atual já tem vinculação (atualiza)
    const { data: ownLink } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select("id")
      .eq("source", "kiwify")
      .eq("member_user_id", userId)
      .maybeSingle();

    // Pré-check: outro aluno já vinculou esse email? (case-insensitive,
    // mesma lógica do índice UNIQUE em (source, lower(kiwify_email)))
    const { data: conflictRow } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select("id, member_user_id")
      .eq("source", "kiwify")
      .ilike("kiwify_email", kiwifyEmail)
      .neq("member_user_id", userId)
      .maybeSingle();

    if (conflictRow) {
      return {
        ok: false,
        error:
          "Esse e-mail Kiwify já está vinculado a outro aluno. Se for um engano, fala com o suporte.",
      };
    }

    if (ownLink) {
      const o = ownLink as { id: string };
      const { error: updErr } = await supabase
        .schema("afiliados")
        .from("affiliate_links")
        .update({
          kiwify_email: kiwifyEmail,
          kiwify_name: kiwifyName,
          cpf_cnpj_encrypted: cpfCnpjDigits ? encrypt(cpfCnpjDigits) : null,
          cpf_cnpj_last4: cpfCnpjDigits ? cpfCnpjDigits.slice(-4) : null,
        })
        .eq("id", o.id);
      if (updErr) {
        if (updErr.message.includes("affiliate_links_unique_email")) {
          return {
            ok: false,
            error:
              "Esse e-mail Kiwify já está vinculado a outro aluno. Se for um engano, fala com o suporte.",
          };
        }
        return { ok: false, error: updErr.message };
      }
      revalidatePath("/profile");
      return { ok: true, data: { attached: 0 } };
    }

    const registeredAt = new Date().toISOString();

    const { error: insErr } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .insert({
        member_user_id: userId,
        source: "kiwify",
        kiwify_email: kiwifyEmail,
        kiwify_name: kiwifyName,
        cpf_cnpj_encrypted: cpfCnpjDigits ? encrypt(cpfCnpjDigits) : null,
        cpf_cnpj_last4: cpfCnpjDigits ? cpfCnpjDigits.slice(-4) : null,
        registered_at: registeredAt,
      });

    if (insErr) {
      if (insErr.message.includes("affiliate_links_unique_email")) {
        return {
          ok: false,
          error: "Esse e-mail Kiwify já está vinculado a outro aluno.",
        };
      }
      return { ok: false, error: insErr.message };
    }

    // Backfill: vendas órfãs com email + nome batendo viram do user
    const attached = await backfillOrphanSales(
      kiwifyEmail,
      kiwifyName,
      userId,
      registeredAt,
    );

    revalidatePath("/profile");
    return { ok: true, data: { attached } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Remove a vinculação. Vendas associadas mantêm member_user_id (histórico).
 * XP creditado NÃO é revertido.
 */
export async function unlinkKiwifyAffiliateAction(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();

    const supabase = createAdminClient();
    const { error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .delete()
      .eq("member_user_id", userId)
      .eq("source", "kiwify");

    if (error) return { ok: false, error: error.message };
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
