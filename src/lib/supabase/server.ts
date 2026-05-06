import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase client para uso em Server Components, Server Actions e Route Handlers.
 * Opera com a sessão do usuário (chave anon + cookies).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // `set` em Server Components gera erro — o middleware cuida da renovação.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem
          }
        },
      },
    },
  );
}

/**
 * Supabase client com service_role — bypass de RLS.
 * USO RESTRITO A SERVIDOR (webhook, admin actions). NUNCA expor em client.
 *
 * IMPORTANTE: usa o client puro do @supabase/supabase-js (não o @supabase/ssr).
 * O createServerClient do ssr passa pelo fetch global do Next.js, que cacheia
 * GETs por padrão no Data Cache — fazia leituras de platform_settings ficarem
 * "presas" no primeiro valor lido (ex: cron lia auto_enrollment_enabled=false
 * mesmo depois do admin ligar o toggle). O client puro usa fetch direto,
 * sem passar pelo Data Cache do Next.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
