import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  buildUserVars,
  resolveBroadcastLink,
} from "@/lib/broadcast-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resolver de link de broadcast com placeholders.
 *
 * URL: /r/{broadcastId}
 *
 * Fluxo:
 *   1. User precisa estar logado (sem sessao -> manda pro /login com next)
 *   2. Carrega push_broadcasts.link_template
 *   3. Carrega dados do user (full_name, email, phone, cpf)
 *   4. Substitui placeholders {{firstName}}, {{email}}, etc no template
 *   5. Redireciona com 302 pro link final
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const broadcastId = params.id;
  const url = new URL(req.url);
  const origin = url.origin;

  // Auth: precisa estar logado pra resolver as variaveis
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", `/r/${broadcastId}`);
    return NextResponse.redirect(loginUrl);
  }

  // Carrega broadcast (admin client pra bypassar RLS — push_broadcasts
  // pode nao ser legivel pelo user comum dependendo da policy)
  const admin = createAdminClient();
  const { data: bcRow } = await admin
    .schema("membros")
    .from("push_broadcasts")
    .select("link_template, link")
    .eq("id", broadcastId)
    .maybeSingle();

  const bc = bcRow as
    | { link_template: string | null; link: string | null }
    | null;

  if (!bc) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // Sem template -> usa o link direto (compat com broadcasts antigos)
  const template = bc.link_template ?? bc.link;
  if (!template) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // Carrega dados do user pra resolver placeholders
  const { data: profileRow } = await admin
    .schema("membros")
    .from("users")
    .select("full_name, phone, cpf, email")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRow as
    | { full_name: string | null; phone: string | null; cpf: string | null; email: string | null }
    | null;

  const vars = buildUserVars({
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    cpf: profile?.cpf ?? null,
  });

  const finalUrl = resolveBroadcastLink(template, vars);

  // Se o link final for relativo (/lessons/abc), normaliza pra origin
  const targetUrl = finalUrl.startsWith("/")
    ? new URL(finalUrl, origin).toString()
    : finalUrl;

  return NextResponse.redirect(targetUrl);
}
