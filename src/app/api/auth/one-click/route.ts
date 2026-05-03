import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateMagicToken } from "@/lib/one-click";

/**
 * GET /api/auth/one-click?token=UUID&next=/path
 *
 * Valida o magic token, gera magic link nativo do Supabase pra esse user,
 * e redireciona pro action_link (que faz o exchange + seta cookies de
 * sessão). Após login, manda pro /onboarding (se aluno ainda precisa
 * setar senha/foto) ou pro `next` (default /dashboard).
 *
 * O token nosso vale 7d e é reutilizável; o action_link do Supabase é
 * usado uma vez nesse instante (válido por 1h, mas aluno usa
 * imediatamente).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=Link%20inv%C3%A1lido", url.origin),
    );
  }

  const userId = await validateMagicToken(token);
  if (!userId) {
    return NextResponse.redirect(
      new URL(
        "/login?error=Link%20expirado%20ou%20inv%C3%A1lido",
        url.origin,
      ),
    );
  }

  try {
    const admin = createAdminClient();

    // Pega email do user
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user?.email) {
      return NextResponse.redirect(
        new URL(
          "/login?error=Conta%20n%C3%A3o%20encontrada",
          url.origin,
        ),
      );
    }

    const email = userData.user.email;

    // Decide pra onde mandar após login: se o profile precisa de onboarding,
    // primeiro vai pra /onboarding e depois pro next.
    const { data: profile } = await admin
      .schema("membros")
      .from("users")
      .select("needs_onboarding")
      .eq("id", userId)
      .maybeSingle();
    const needsOnboarding =
      (profile as { needs_onboarding?: boolean } | null)?.needs_onboarding ===
      true;

    const finalNext = needsOnboarding
      ? `/onboarding?next=${encodeURIComponent(next)}`
      : next;

    // Gera magic link nativo Supabase
    const callbackBase =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? url.origin;
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${callbackBase}/auth/callback?next=${encodeURIComponent(finalNext)}`,
        },
      });

    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.redirect(
        new URL(
          "/login?error=Falha%20ao%20gerar%20sess%C3%A3o",
          url.origin,
        ),
      );
    }

    return NextResponse.redirect(linkData.properties.action_link);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=Erro%20inesperado", url.origin),
    );
  }
}
