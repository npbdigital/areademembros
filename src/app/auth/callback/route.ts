import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth/recovery callback do Supabase.
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

  const supabase = createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set(
      "error",
      "Link de recuperação inválido ou expirado. Solicite outro.",
    );
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
