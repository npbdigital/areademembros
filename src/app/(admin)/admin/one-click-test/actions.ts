"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  buildShortOneClickUrl,
  generateMagicToken,
  markUserNeedsOnboarding,
} from "@/lib/one-click";

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
  if ((profile as { role?: string } | null)?.role !== "admin") {
    throw new Error("Sem permissão.");
  }
}

interface GenerateResult {
  url: string;
  expiresAt: string;
  userId: string;
  email: string;
  fullName: string;
  isNewUser: boolean;
}

/**
 * Gera token one-click pra teste. Aceita email existente OU novo:
 *   - Email existente: pega o user, cria token (não mexe no profile)
 *   - Email novo: cria user via auth.admin.createUser (sem matrícula —
 *     é só pra testar o fluxo de login + onboarding), marca
 *     needs_onboarding=true, cria token
 *
 * Não cria matrícula em cohort. Não envia e-mail. Apenas devolve a URL
 * pra admin copiar e testar manualmente.
 */
export async function generateTestOneClickAction(params: {
  email: string;
  fullName?: string;
  forceOnboarding?: boolean;
}): Promise<ActionResult<GenerateResult>> {
  try {
    await assertAdmin();
    const email = params.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false, error: "E-mail inválido." };
    }
    const fullName = (params.fullName ?? "").trim() || email.split("@")[0];

    const admin = createAdminClient();

    // Procura user existente
    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = listData?.users.find(
      (u) => u.email?.toLowerCase() === email,
    );

    let userId: string;
    let isNewUser = false;

    if (existing) {
      userId = existing.id;
    } else {
      // Cria user de teste
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password: crypto.randomUUID(), // senha temp aleatória; aluno setará no onboarding
          email_confirm: true,
        });
      if (createErr || !created.user) {
        return {
          ok: false,
          error: `Falha ao criar user: ${createErr?.message ?? "desconhecido"}`,
        };
      }
      userId = created.user.id;
      isNewUser = true;

      // Cria profile mínimo
      await admin
        .schema("membros")
        .from("users")
        .upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            role: "ficticio", // teste — não conta nas métricas reais
            is_active: true,
            needs_onboarding: true,
          },
          { onConflict: "id" },
        );
    }

    // Força onboarding se admin pediu (útil pra testar o fluxo em user já existente)
    if (params.forceOnboarding && !isNewUser) {
      await markUserNeedsOnboarding(userId);
    }

    const magic = await generateMagicToken(userId, "admin_test");
    if (!magic) {
      return { ok: false, error: "Falha ao gerar token." };
    }

    return {
      ok: true,
      data: {
        url: await buildShortOneClickUrl(magic.token),
        expiresAt: magic.expiresAt,
        userId,
        email,
        fullName,
        isNewUser,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
