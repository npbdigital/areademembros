"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Callback client-side que recebe sessão via URL hash (fluxo implícito
 * do Supabase usado por magic links). O `/auth/callback` server-side só
 * sabe ler `?code=` (PKCE), então pra magic link precisamos desse cara.
 *
 * Fluxo:
 *   1. Supabase redireciona pra `/auth/hash-callback?next=/dashboard#access_token=...&refresh_token=...`
 *   2. JS lê o hash, chama `supabase.auth.setSession({access_token, refresh_token})`
 *   3. Quando a sessão é setada (cookies via @supabase/ssr), redireciona pro `next`
 */
export default function HashCallbackPage() {
  return (
    <Suspense fallback={<HashCallbackFallback />}>
      <HashCallbackInner />
    </Suspense>
  );
}

function HashCallbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-npb-bg p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-npb-gold" />
        <p className="text-sm text-npb-text-muted">Entrando…</p>
      </div>
    </div>
  );
}

function HashCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const next = searchParams.get("next") ?? "/dashboard";

    // Hash vem como #access_token=...&refresh_token=...&token_type=bearer&expires_in=...
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorDesc = params.get("error_description") || params.get("error");

    if (errorDesc) {
      setError(errorDesc);
      setTimeout(() => {
        router.replace(`/login?error=${encodeURIComponent(errorDesc)}`);
      }, 1500);
      return;
    }

    if (!accessToken || !refreshToken) {
      setError("Tokens ausentes no link.");
      setTimeout(() => {
        router.replace("/login?error=Link%20inv%C3%A1lido");
      }, 1500);
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error: setErr }) => {
        if (setErr) {
          setError(setErr.message);
          setTimeout(() => {
            router.replace(
              `/login?error=${encodeURIComponent(setErr.message)}`,
            );
          }, 1500);
          return;
        }
        // Limpa o hash da URL antes de redirecionar (estética + evita re-execução)
        const safeNext = next.startsWith("/") ? next : "/dashboard";
        // router.replace pra não deixar a página de hash no histórico
        router.replace(safeNext);
      });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-npb-bg p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-npb-gold" />
        <p className="text-sm text-npb-text-muted">
          {error ? `Erro: ${error}` : "Entrando…"}
        </p>
      </div>
    </div>
  );
}
