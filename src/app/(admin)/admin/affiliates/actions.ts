"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<string> {
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
  return user.id;
}

/** Força status verified=true mesmo sem 1ª venda. Admin assume risco. */
export async function forceVerifyAffiliateAction(
  linkId: string,
): Promise<ActionResult> {
  try {
    const adminId = await assertAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by_admin: adminId,
      })
      .eq("id", linkId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/affiliates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Volta verified pra false (debug ou erro do admin). */
export async function unverifyAffiliateAction(
  linkId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .update({
        verified: false,
        verified_at: null,
        verified_by_admin: null,
      })
      .eq("id", linkId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/affiliates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Remove vinculação. Vendas mantêm member_user_id (histórico). */
export async function adminUnlinkAffiliateAction(
  linkId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .delete()
      .eq("id", linkId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/affiliates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Decifra CPF/CNPJ pra exibir no admin (só sob demanda). */
export async function revealCpfCnpjAction(
  linkId: string,
): Promise<ActionResult<{ cpfCnpj: string | null }>> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select("cpf_cnpj_encrypted")
      .eq("id", linkId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    const enc = (data as { cpf_cnpj_encrypted: string | null } | null)
      ?.cpf_cnpj_encrypted;
    if (!enc) return { ok: true, data: { cpfCnpj: null } };

    try {
      const plain = decrypt(enc);
      return { ok: true, data: { cpfCnpj: plain } };
    } catch {
      return { ok: false, error: "Falha ao decifrar." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Salva notas internas do admin sobre essa vinculação. */
export async function saveAffiliateNotesAction(
  linkId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const notes = String(formData.get("notes") ?? "").trim();
    const supabase = createAdminClient();

    const { error } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .update({ notes: notes || null })
      .eq("id", linkId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/affiliates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
