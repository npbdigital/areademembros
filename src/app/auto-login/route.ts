import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Auto-login simplificado com email + senha embutidos na URL.
 *
 * Pensado pra automações de WhatsApp (Unnichat/Sendflow): a ferramenta só
 * precisa popular o template `/auto-login?e={{email}}&p={{senha}}` — sem
 * chamada extra à API. Mais simples de configurar do que o esquema de
 * one-click token.
 *
 * Trade-off conhecido: senha aparece na URL (histórico do navegador, logs).
 * Decisão do produto: aceitável porque (a) já enviamos email+senha em
 * texto pelo WhatsApp hoje, (b) aluno pode trocar a senha depois e o link
 * para de funcionar (segurança eventual).
 *
 * Fluxo:
 *   1. GET /auto-login?e=aluno@email.com&p=123456
 *   2. signInWithPassword via Supabase, cookies setados
 *   3. Redireciona pra /dashboard (ou /onboarding se needs_onboarding=true)
 *   4. Se falhar, redireciona pra /login?email=...&error=...
 *
 * Aceita os parametros nas formas curta (e/p) e longa (email/password)
 * por flexibilidade.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const email = (
    searchParams.get("e") ??
    searchParams.get("email") ??
    ""
  )
    .trim()
    .toLowerCase();
  const password =
    searchParams.get("p") ?? searchParams.get("password") ?? "";
  const next = searchParams.get("next") ?? "/dashboard";

  if (!email || !email.includes("@") || !password) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "Link de acesso inválido.");
    return NextResponse.redirect(url);
  }

  // Cookie store via response — precisamos retornar o response com os
  // cookies de sessao setados pelo Supabase.
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  let response = NextResponse.redirect(new URL(safeNext, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("email", email);
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      url.searchParams.set(
        "error",
        "Senha não confere. Use 'Esqueci minha senha' pra recuperar.",
      );
    } else {
      url.searchParams.set("error", "Não consegui logar. Tente outra vez.");
    }
    response = NextResponse.redirect(url);
    return response;
  }

  return response;
}
