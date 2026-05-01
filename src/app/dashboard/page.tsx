import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "../(auth)/actions";
import { NpbLogo } from "@/components/npb-logo";
import { Button } from "@/components/ui/button";

/**
 * PLACEHOLDER — substituído na Etapa 4 pela biblioteca real do aluno.
 * Existe apenas para fechar o ciclo de login no Etapa 3.
 */
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-npb-bg p-6 sm:p-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <NpbLogo size="md" showWordmark />
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              className="border-npb-border bg-npb-bg3 text-npb-text-muted hover:bg-npb-bg4 hover:text-npb-gold"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </form>
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
                Login funcionando ✓ — autenticação em produção
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-npb-bg3 px-3 py-1 text-npb-text-muted">
                  {user.email}
                </span>
                <span
                  className={`rounded-md px-3 py-1 ${
                    isAdmin
                      ? "bg-npb-gold/15 text-npb-gold"
                      : "bg-npb-bg3 text-npb-text-muted"
                  }`}
                >
                  {isAdmin ? "Admin" : "Aluno"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-dashed border-npb-border bg-npb-bg3/50 p-6">
            <p className="text-sm text-npb-text-muted">
              <strong className="text-npb-text">Em construção.</strong> Esta
              página é um placeholder da Etapa 3 (autenticação). A biblioteca de
              cursos e o painel admin entram nas Etapas 4–6.
            </p>
            {isAdmin && (
              <p className="mt-3 text-sm text-npb-text-muted">
                Quando o painel admin estiver pronto, você acessa em{" "}
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
    </div>
  );
}
