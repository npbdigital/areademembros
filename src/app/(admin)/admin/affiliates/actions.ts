"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  backfillOrphanSales,
  evaluateKiwifyAchievements,
  processSalesRaw,
} from "@/lib/affiliates/process";
import { normalizeEmail } from "@/lib/affiliates/normalize";
import { awardXp, bumpMinLevel } from "@/lib/gamification";
import { evaluateAvatarDecorations } from "@/lib/decorations";

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

/**
 * Reprocessa um sales_raw pendente (debug: rodar processSalesRaw de novo).
 * Útil pra raws que ficaram processed=false por bug ou deploy fora de hora.
 */
export async function reprocessSalesRawAction(
  rawId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await processSalesRaw(rawId);
    revalidatePath("/admin/affiliates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Reprocessa TODOS os sales_raw com processed=false. */
export async function reprocessAllPendingAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    const { data: pending } = await supabase
      .schema("afiliados")
      .from("sales_raw")
      .select("id")
      .eq("processed", false)
      .limit(100);

    let count = 0;
    for (const row of (pending ?? []) as Array<{ id: string }>) {
      try {
        await processSalesRaw(row.id);
        count++;
      } catch (e) {
        console.error("[reprocess] erro em raw", row.id, e);
      }
    }

    revalidatePath("/admin/affiliates");
    return { ok: true, data: { count } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Busca alunos por nome OU e-mail (substring case-insensitive). Usado pra
 * o autocomplete do "Atribuir venda órfã". Retorna até 12 resultados.
 *
 * Filtros: só users ativos com role student/ficticio.
 */
export async function searchStudentsAction(
  query: string,
  options?: { onlyFicticio?: boolean },
): Promise<
  ActionResult<
    Array<{
      id: string;
      fullName: string | null;
      email: string;
      avatarUrl: string | null;
      role: string;
      hasKiwifyLink: boolean;
    }>
  >
> {
  try {
    await assertAdmin();
    const q = query.trim();
    if (q.length < 2) {
      return { ok: true, data: [] };
    }

    const supabase = createAdminClient();
    const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const roles = options?.onlyFicticio
      ? ["ficticio"]
      : ["student", "ficticio"];
    const { data, error } = await supabase
      .schema("membros")
      .from("users")
      .select("id, full_name, email, avatar_url, role")
      .in("role", roles)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .order("full_name", { ascending: true })
      .limit(12);
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
      avatar_url: string | null;
      role: string;
    }>;

    // Marca quais já têm vinculação Kiwify (pra mostrar check na UI)
    const linkedSet = new Set<string>();
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: links } = await supabase
        .schema("afiliados")
        .from("affiliate_links")
        .select("member_user_id")
        .eq("source", "kiwify")
        .in("member_user_id", ids);
      for (const l of (links ?? []) as Array<{ member_user_id: string }>) {
        linkedSet.add(l.member_user_id);
      }
    }

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        avatarUrl: r.avatar_url,
        role: r.role,
        hasKiwifyLink: linkedSet.has(r.id),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Atribui manualmente uma venda órfã a um aluno (busca por e-mail do aluno
 * em membros.users). Se o aluno ainda não tiver vinculação Kiwify pra esse
 * email, cria uma já verificada (admin assume risco) e roda o backfill —
 * isso pega TODAS as outras vendas órfãs com o mesmo email automaticamente.
 *
 * O nome do Kiwify usado na vinculação vem da venda em si, então o backfill
 * encontra todas as órfãs com mesmo email + nome.
 */
export async function attachOrphanByStudentEmailAction(
  saleId: string,
  studentEmail: string,
): Promise<ActionResult<{ attached: number; userId: string }>> {
  try {
    const adminId = await assertAdmin();
    const sb = createAdminClient();

    const emailLookup = studentEmail.trim().toLowerCase();
    if (!emailLookup || !emailLookup.includes("@")) {
      return { ok: false, error: "E-mail inválido." };
    }

    const { data: user } = await sb
      .schema("membros")
      .from("users")
      .select("id, email")
      .ilike("email", emailLookup)
      .maybeSingle();
    const u = user as { id: string; email: string } | null;
    if (!u) {
      return { ok: false, error: `Nenhum aluno com e-mail ${emailLookup}.` };
    }

    const { data: sale } = await sb
      .schema("afiliados")
      .from("sales")
      .select("kiwify_email, kiwify_name")
      .eq("id", saleId)
      .maybeSingle();
    const s = sale as { kiwify_email: string; kiwify_name: string | null } | null;
    if (!s) return { ok: false, error: "Venda não encontrada." };

    const kEmail = normalizeEmail(s.kiwify_email);
    const kName = (s.kiwify_name ?? "").trim();

    // Já existe vinculação pra esse aluno + email Kiwify? Se não, cria
    // verificada (admin manualmente confirmou).
    const { data: existingLink } = await sb
      .schema("afiliados")
      .from("affiliate_links")
      .select("id, verified")
      .eq("source", "kiwify")
      .eq("member_user_id", u.id)
      .ilike("kiwify_email", kEmail)
      .maybeSingle();

    let registeredAt: string;
    if (existingLink) {
      const link = existingLink as { id: string; verified: boolean };
      if (!link.verified) {
        await sb
          .schema("afiliados")
          .from("affiliate_links")
          .update({
            verified: true,
            verified_at: new Date().toISOString(),
            verified_by_admin: adminId,
            kiwify_name: kName,
          })
          .eq("id", link.id);
      } else {
        // Garante que o nome bate com a venda — senão backfill ignora
        await sb
          .schema("afiliados")
          .from("affiliate_links")
          .update({ kiwify_name: kName })
          .eq("id", link.id);
      }
      // Backfill desde o épocs (admin disse "essa venda é dele" — pega tudo)
      registeredAt = "1970-01-01T00:00:00.000Z";
    } else {
      const { error: insErr } = await sb
        .schema("afiliados")
        .from("affiliate_links")
        .insert({
          source: "kiwify",
          member_user_id: u.id,
          kiwify_email: kEmail,
          kiwify_name: kName,
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by_admin: adminId,
          notes: "Vinculação criada manualmente pelo admin a partir de venda órfã.",
        });
      if (insErr) return { ok: false, error: insErr.message };
      registeredAt = "1970-01-01T00:00:00.000Z";
    }

    const attached = await backfillOrphanSales(
      kEmail,
      kName,
      u.id,
      registeredAt,
    );

    revalidatePath("/admin/affiliates");
    return { ok: true, data: { attached, userId: u.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Cria uma "venda fictícia" pra um aluno fictício, com o único objetivo de
 * popular o perfil dele com XP, conquistas, decorações e nível — pra ele
 * aparecer como um vendedor estabelecido pros alunos reais e moderadores.
 *
 * Importante: NÃO é uma venda real. Persiste em `afiliados.sales` com
 * `source='manual'` (todas as views de receita filtram por
 * `source='kiwify'`, então esses registros não entram em dashboard,
 * exportação CSV, leaderboards de comissão, etc). Único uso do registro é
 * servir de referenceId pro awardXp e fonte de contagem pra decorações/
 * conquistas de venda.
 *
 * Restrição: aluno destino precisa ter role='ficticio'. Bloqueia uso em
 * conta real pra evitar vazamento de dados falsos em métricas de produção.
 */
export async function addManualSaleAction(
  studentUserId: string,
  productName: string,
  commissionReais: number,
  quantity: number = 1,
): Promise<
  ActionResult<{ created: number; totalXpAwarded: number }>
> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    if (!studentUserId) {
      return { ok: false, error: "Selecione o aluno fictício." };
    }
    if (!productName.trim()) {
      return { ok: false, error: "Informe o nome do produto." };
    }
    if (!Number.isFinite(commissionReais) || commissionReais <= 0) {
      return { ok: false, error: "Valor de comissão inválido." };
    }
    const qty = Math.floor(quantity);
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
      return { ok: false, error: "Quantidade entre 1 e 100." };
    }

    const { data: user } = await sb
      .schema("membros")
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", studentUserId)
      .maybeSingle();
    const u = user as
      | { id: string; email: string; full_name: string | null; role: string }
      | null;
    if (!u) return { ok: false, error: "Aluno não encontrado." };
    if (u.role !== "ficticio") {
      return {
        ok: false,
        error: "Venda manual só pode ser atribuída a alunos fictícios.",
      };
    }

    const commissionCents = Math.round(commissionReais * 100);
    const xpPerSale = Math.floor(commissionCents / 100) + 10;

    // Insere as vendas em lote — uma linha por unidade pra contagem de
    // conquista (sales_kiwify_5 quer ver 5 linhas, não 1 com qty=5).
    const nowIso = new Date().toISOString();
    const rows = Array.from({ length: qty }, () => ({
      source: "manual",
      external_order_id: `manual-${crypto.randomUUID()}`,
      kiwify_email: u.email,
      kiwify_name: u.full_name ?? "",
      member_user_id: u.id,
      product_name: productName.trim(),
      status: "paid",
      commission_value_cents: commissionCents,
      gross_value_cents: commissionCents,
      currency: "BRL",
      approved_at: nowIso,
      status_updated_at: nowIso,
      xp_awarded: 0,
    }));

    const { data: insertedRows, error: saleErr } = await sb
      .schema("afiliados")
      .from("sales")
      .insert(rows)
      .select("id");

    if (saleErr || !insertedRows) {
      return {
        ok: false,
        error: `Falha ao inserir vendas: ${saleErr?.message ?? "erro"}`,
      };
    }
    const created = (insertedRows as Array<{ id: string }>).length;
    let totalXp = 0;

    for (const row of insertedRows as Array<{ id: string }>) {
      try {
        await awardXp(sb, {
          userId: u.id,
          amount: xpPerSale,
          reason: "kiwify_sale",
          referenceId: row.id,
        });
        await sb
          .schema("afiliados")
          .from("sales")
          .update({ xp_awarded: xpPerSale })
          .eq("id", row.id);
        totalXp += xpPerSale;
      } catch (e) {
        console.error("[addManualSale] erro awardXp em linha:", row.id, e);
      }
    }

    // Bump nível + avalia decoração + avalia conquistas de venda só uma
    // vez no fim — todas operações são idempotentes/cumulativas.
    try {
      await bumpMinLevel(sb, u.id, 2);
      await evaluateAvatarDecorations(sb, u.id);
      await evaluateKiwifyAchievements(sb, u.id);
    } catch (e) {
      console.error("[addManualSale] erro pós-insert:", e);
    }

    revalidatePath("/admin/affiliates");
    return {
      ok: true,
      data: { created, totalXpAwarded: totalXp },
    };
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
