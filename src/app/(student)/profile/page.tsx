import { Calendar, KeyRound, Layers, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/student/profile-form";
import { ChangePasswordForm } from "@/components/student/change-password-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, email, phone, avatar_url, created_at")
    .eq("id", user.id)
    .single();

  const { data: enrollmentsRaw } = await supabase
    .schema("membros")
    .from("enrollments")
    .select(
      "id, enrolled_at, expires_at, is_active, source, cohorts(name, support_prefix)",
    )
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsRaw ?? []) as unknown as Array<{
    id: string;
    enrolled_at: string;
    expires_at: string | null;
    is_active: boolean;
    source: string;
    cohorts:
      | { name: string; support_prefix: string | null }
      | { name: string; support_prefix: string | null }[]
      | null;
  }>;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <UserIcon className="h-3.5 w-3.5" />
          Meu perfil
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Suas informações
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Atualize seu nome, telefone, foto e troque sua senha.
        </p>
      </header>

      <section>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <ProfileForm
            userId={user.id}
            initialFullName={profile?.full_name ?? ""}
            initialEmail={profile?.email ?? user.email ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <KeyRound className="h-5 w-5 text-npb-gold" />
          Trocar senha
        </h2>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <ChangePasswordForm />
        </div>
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Layers className="h-5 w-5 text-npb-gold" />
          Suas matrículas
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {enrollments.length}
          </span>
        </h2>
        {enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-6 text-center text-sm text-npb-text-muted">
            Você ainda não tem matrículas ativas.
          </div>
        ) : (
          <ul className="space-y-2">
            {enrollments.map((e) => {
              const cohort = Array.isArray(e.cohorts) ? e.cohorts[0] : e.cohorts;
              if (!cohort) return null;
              const enrolled = new Date(e.enrolled_at).toLocaleDateString(
                "pt-BR",
              );
              const expires = e.expires_at
                ? new Date(e.expires_at).toLocaleDateString("pt-BR")
                : null;
              const expired =
                e.expires_at && new Date(e.expires_at) < new Date();

              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <Layers className="h-4 w-4 flex-shrink-0 text-npb-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-npb-text">
                      {cohort.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-npb-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Desde {enrolled}
                      </span>
                      {expires && (
                        <span className={expired ? "text-red-400" : ""}>
                          {expired ? "Expirou" : "Expira"} em {expires}
                        </span>
                      )}
                    </div>
                  </div>
                  {e.is_active && !expired ? (
                    <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                      Ativa
                    </span>
                  ) : (
                    <span className="rounded bg-npb-bg3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-npb-text-muted">
                      Inativa
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
