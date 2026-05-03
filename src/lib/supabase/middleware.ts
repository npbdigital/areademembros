import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Helper usado pelo middleware do Next.js para renovar a sessão do Supabase
 * a cada request e proteger rotas autenticadas.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // IMPORTANTE: getUser() revalida o JWT no servidor Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas em que NÃO redirecionamos um usuário logado pra fora.
  // /reset-password fica fora do "redireciona se logado" — após o callback,
  // a sessão já está válida e o user precisa ficar lá pra definir senha.
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth/callback");

  // Rotas que sempre permitem acesso, com ou sem sessão.
  const isPublicAuthRoute =
    isAuthRoute || pathname.startsWith("/reset-password");

  const isPublicApi =
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/auth/one-click");
  const isPwaAsset =
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/pwa-icon.svg";
  const isStaticOrNext =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/";

  // Sem sessão → manda pra /login (exceto em rotas públicas)
  if (
    !user &&
    !isPublicAuthRoute &&
    !isPublicApi &&
    !isStaticOrNext &&
    !isPwaAsset
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Com sessão tentando acessar /login → manda pra /dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Rotas /admin exigem role = 'admin'
  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .schema("membros")
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
