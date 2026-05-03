import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { OnboardingForm } from "@/components/student/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, email, avatar_url, needs_onboarding")
    .eq("id", user.id)
    .single();

  // Se o flag já não tá ligado, manda pro destino direto (não força onboarding 2x)
  const p = profile as
    | {
        full_name: string | null;
        email: string;
        avatar_url: string | null;
        needs_onboarding: boolean;
      }
    | null;

  if (!p?.needs_onboarding) {
    redirect(searchParams.next ?? "/dashboard");
  }

  const settings = await getPlatformSettings(supabase);

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <header className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-npb-gold">
          Bem-vindo(a)!
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Vamos preparar sua conta
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Defina uma senha pessoal e adicione sua foto pra terminar.
          {settings.platformName ? (
            <>
              {" "}
              Você está acessando <strong>{settings.platformName}</strong>.
            </>
          ) : null}
        </p>
      </header>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <OnboardingForm
          userId={user.id}
          initialFullName={p.full_name ?? ""}
          email={p.email}
          initialAvatarUrl={p.avatar_url}
          nextUrl={searchParams.next ?? "/dashboard"}
        />
      </div>
    </div>
  );
}
