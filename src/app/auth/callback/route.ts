import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * OAuth/recovery callback do Supabase.
 *
 * Constrói a NextResponse PRIMEIRO e amarra os cookies da sessão a ela —
 * isso garante que o Set-Cookie do exchange vá junto com o redirect 307.
 *
 * Fluxos suportados:
 * - Recuperação de senha → ?code=xxx&next=/reset-password
 * - Magic link de boas-vindas → ?code=xxx&next=/dashboard
 * - Erros do Supabase → ?error=...&error_description=...
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set(
      "error",
      errorDescription ?? "Erro ao processar autenticação.",
    );
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

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

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set(
      "error",
      "Link de recuperação inválido ou expirado. Solicite outro.",
    );
    response = NextResponse.redirect(url);
  }

  return response;
}
