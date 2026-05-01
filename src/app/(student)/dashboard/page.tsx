import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 inline-block rounded-md bg-npb-gold px-3.5 py-1 text-xs font-bold text-black">
        Início
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-npb-text">
              Bem-vindo{profile?.full_name ? `, ${profile.full_name}` : ""}!
            </h1>
            <p className="mt-1 text-sm text-npb-text-muted">
              Layout do aluno ativo (Etapa 4) — biblioteca real entra na Etapa 8.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-dashed border-npb-border bg-npb-bg3/50 p-6">
          <p className="text-sm text-npb-text-muted">
            <strong className="text-npb-text">Em construção.</strong> A
            biblioteca de cursos, comunidade e perfil entram nas próximas etapas.
          </p>
          {isAdmin && (
            <p className="mt-3 text-sm text-npb-text-muted">
              Acesse o painel admin em{" "}
              <Link
                href="/admin/dashboard"
                className="text-npb-gold hover:text-npb-gold-light"
              >
                /admin/dashboard
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
