import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Rota do encurtador interno: `/l/{slug}` faz lookup em
 * membros.short_links e redireciona 302 pra target_url. Incrementa
 * click_count em background (RPC, fire-and-forget — não trava o redirect).
 *
 * Slug inválido → redireciona pra /dashboard (evita 404 confuso).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  const origin = new URL(request.url).origin;

  if (!slug || slug.length < 3 || slug.length > 32) {
    return NextResponse.redirect(`${origin}/dashboard`, 302);
  }

  try {
    const admin = createAdminClient().schema("membros");
    const { data } = await admin
      .from("short_links")
      .select("target_url")
      .eq("slug", slug)
      .maybeSingle();

    const targetUrl = (data as { target_url: string } | null)?.target_url;
    if (!targetUrl) {
      return NextResponse.redirect(`${origin}/dashboard`, 302);
    }

    // Incrementa contador em background — não trava o redirect
    void Promise.resolve(
      admin.rpc("incr_short_link_click", { p_slug: slug }),
    ).catch(() => {});

    return NextResponse.redirect(targetUrl, 302);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard`, 302);
  }
}
