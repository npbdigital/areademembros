"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { backfillOrphanSales } from "@/lib/affiliates/process";

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
 * - external_affiliate_id é obrigatório (slug curto da Kiwify)
 * - cpf_cnpj é opcional, mas se preenchido criptografamos (AES-256-GCM)
 *   e guardamos os 4 últimos dígitos pra exibir na UI
 * - registered_at = agora — vendas anteriores não contam
 * - status verified começa false; vira true quando 1ª venda chegar
 *
 * Após criar, faz backfill: se já há vendas órfãs com esse affiliate_id
 * (por causa de webhook chegado antes do cadastro), atribui agora.
 */
export async function linkKiwifyAffiliateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ attached: number }>> {
  try {
    const userId = await requireUserId();

    const externalAffiliateId = str(formData, "external_affiliate_id");
    if (!externalAffiliateId) {
      return { ok: false, error: "Informe o ID de afiliado da Kiwify." };
    }
    if (externalAffiliateId.length > 64) {
      return { ok: false, error: "ID muito longo." };
    }

    const cpfCnpjRaw = str(formData, "cpf_cnpj");
    const cpfCnpjDigits = sanitizeDigitsOnly(cpfCnpjRaw);
    if (cpfCnpjDigits && cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
      return { ok: false, error: "CPF deve ter 11 dígitos ou CNPJ 14." };
    }

    const supabase = createAdminClient();

    // Checa se esse external_affiliate_id já está vinculado por outra pessoa
    const { data: conflictRow } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select("id, member_user_id")
      .eq("source", "kiwify")
      .eq("external_affiliate_id", externalAffiliateId)
      .maybeSingle();

    if (conflictRow) {
      const c = conflictRow as { id: string; member_user_id: string };
      if (c.member_user_id !== userId) {
        return {
          ok: false,
          error:
            "Esse ID de afiliado já está vinculado a outro aluno. Se for um engano, fala com o suporte.",
        };
      }
      // É o próprio user re-cadastrando — atualiza
      const { error: updErr } = await supabase
        .schema("afiliados")
        .from("affiliate_links")
        .update({
          cpf_cnpj_encrypted: cpfCnpjDigits ? encrypt(cpfCnpjDigits) : null,
          cpf_cnpj_last4: cpfCnpjDigits ? cpfCnpjDigits.slice(-4) : null,
        })
        .eq("id", c.id);
      if (updErr) return { ok: false, error: updErr.message };
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
        external_affiliate_id: externalAffiliateId,
        cpf_cnpj_encrypted: cpfCnpjDigits ? encrypt(cpfCnpjDigits) : null,
        cpf_cnpj_last4: cpfCnpjDigits ? cpfCnpjDigits.slice(-4) : null,
        registered_at: registeredAt,
      });

    if (insErr) return { ok: false, error: insErr.message };

    // Backfill: vendas órfãs com esse affiliate_id que aconteceram após
    // registered_at viram do user (ganha XP retroativo dentro do período)
    const attached = await backfillOrphanSales(
      externalAffiliateId,
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
 * Remove a vinculação. Vendas associadas ficam no banco com member_user_id
 * preservado (histórico). XP já creditado NÃO é revertido (justo — foi feito).
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
