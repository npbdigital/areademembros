import Link from "next/link";
import { CheckCircle2, Plus, UserPlus, Users, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Aluno + fictício são listados juntos. Fictício é só uma flag visual
// (mesma permissão de aluno), mas admin precisa diferenciar pra triagem.
const STUDENT_LIKE_ROLES = ["student", "ficticio"] as const;

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: { showFicticio?: string };
}) {
  const supabase = createClient();
  const showFicticio = searchParams?.showFicticio !== "0";

  const rolesFilter = showFicticio
    ? (STUDENT_LIKE_ROLES as readonly string[])
    : ["student"];

  const { data: students } = await supabase
    .schema("membros")
    .from("users")
    .select("id, full_name, email, phone, avatar_url, is_active, created_at, role")
    .in("role", rolesFilter as string[])
    .order("created_at", { ascending: false });

  const list = students ?? [];

  // Conta matrículas ativas por aluno
  const ids = list.map((s) => s.id);
  const enrollmentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: en } = await supabase
      .schema("membros")
      .from("enrollments")
      .select("user_id")
      .in("user_id", ids)
      .eq("is_active", true);
    for (const row of en ?? []) {
      enrollmentCounts[row.user_id] = (enrollmentCounts[row.user_id] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-npb-text">Alunos</h1>
          <p className="text-sm text-npb-text-muted">
            {list.length === 0
              ? "Nenhum aluno cadastrado."
              : `${list.length} aluno${list.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={
              showFicticio
                ? "/admin/students?showFicticio=0"
                : "/admin/students"
            }
            className="text-xs text-npb-text-muted hover:text-npb-gold"
          >
            {showFicticio ? "Esconder fictícios" : "Mostrar fictícios"}
          </Link>
          <Link
            href="/admin/students/new"
            className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
          >
            <UserPlus className="h-4 w-4" />
            Novo aluno
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-npb-border bg-npb-bg2 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-npb-text">
            Nenhum aluno por aqui ainda
          </h2>
          <p className="mt-1 max-w-md text-sm text-npb-text-muted">
            Crie alunos manualmente aqui. Quando o webhook de
            <code> transactions_data</code> entrar (Etapa 13), eles serão
            criados automaticamente nas vendas aprovadas.
          </p>
          <Link
            href="/admin/students/new"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro aluno
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-npb-border bg-npb-bg2 npb-scrollbar">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-npb-border bg-npb-bg3 text-left text-xs uppercase tracking-wider text-npb-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Aluno</th>
                <th className="px-4 py-2.5 font-semibold">Telefone</th>
                <th className="px-4 py-2.5 font-semibold">Matrículas</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-npb-border text-sm">
              {list.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-npb-bg3/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-npb-bg3">
                        {s.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-bold text-npb-gold">
                            {(s.full_name || s.email)[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-medium text-npb-text">
                          {s.full_name || "(sem nome)"}
                          {s.role === "ficticio" && (
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-300">
                              Fictício
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-npb-text-muted">
                          {s.email}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-npb-text-muted">
                    {s.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-npb-text-muted">
                    {enrollmentCounts[s.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold text-npb-text-muted">
                        <XCircle className="h-2.5 w-2.5" /> Bloqueado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-npb-text-muted">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
