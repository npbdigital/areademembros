import Link from "next/link";
import {
  CheckCircle2,
  Plus,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateBrt, formatDateTimeBrt } from "@/lib/format-date";
import { StudentsFilters } from "@/components/admin/students-filters";

export const dynamic = "force-dynamic";

const STUDENT_LIKE_ROLES = ["student", "ficticio"] as const;

interface SearchParams {
  q?: string;
  cohort?: string;
  from?: string;
  to?: string;
  access?: string;
  showFicticio?: string;
}

interface StudentRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  has_logged_in: boolean;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const q = (searchParams?.q ?? "").trim();
  const cohortId = (searchParams?.cohort ?? "").trim();
  const dateFrom = (searchParams?.from ?? "").trim();
  const dateTo = (searchParams?.to ?? "").trim();
  const lastAccess = (searchParams?.access ?? "").trim();
  const showFicticio = searchParams?.showFicticio !== "0";

  const sb = createAdminClient();

  // Lista de cohorts pro select de filtro
  const { data: cohortsRaw } = await sb
    .schema("membros")
    .from("cohorts")
    .select("id, name")
    .order("name");
  const cohorts = (cohortsRaw ?? []) as Array<{ id: string; name: string }>;

  // Se filtrou por turma, pega user_ids que tem enrollment ativo nela.
  // Resolvido aqui ANTES da query principal pra evitar trazer todo aluno
  // e filtrar em memoria.
  let userIdsByCohort: string[] | null = null;
  if (cohortId) {
    const { data } = await sb
      .schema("membros")
      .from("enrollments")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .eq("is_active", true);
    userIdsByCohort = ((data ?? []) as Array<{ user_id: string }>).map(
      (r) => r.user_id,
    );
    // Truque: forca zero resultados quando a cohort esta vazia, sem if extra.
    if (userIdsByCohort.length === 0) userIdsByCohort = ["00000000-0000-0000-0000-000000000000"];
  }

  // Query principal na view (que ja traz last_sign_in_at + has_logged_in)
  let query = sb
    .schema("membros")
    .from("students_admin")
    .select(
      "id, email, full_name, phone, avatar_url, is_active, role, created_at, last_sign_in_at, has_logged_in",
    )
    .in("role", showFicticio ? (STUDENT_LIKE_ROLES as unknown as string[]) : ["student"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
  }
  if (userIdsByCohort) {
    query = query.in("id", userIdsByCohort);
  }
  if (lastAccess === "never") {
    query = query.is("last_sign_in_at", null);
  } else if (lastAccess === "7d" || lastAccess === "30d" || lastAccess === "90d") {
    const days = parseInt(lastAccess, 10);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    query = query.gte("last_sign_in_at", since);
  }

  const { data: studentsRaw } = await query;
  const list = (studentsRaw ?? []) as StudentRow[];

  // Conta matriculas ativas por aluno (lista visivel apenas)
  const ids = list.map((s) => s.id);
  const enrollmentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: en } = await sb
      .schema("membros")
      .from("enrollments")
      .select("user_id")
      .in("user_id", ids)
      .eq("is_active", true);
    for (const row of (en ?? []) as Array<{ user_id: string }>) {
      enrollmentCounts[row.user_id] = (enrollmentCounts[row.user_id] ?? 0) + 1;
    }
  }

  const hasAnyFilter =
    !!q || !!cohortId || !!dateFrom || !!dateTo || !!lastAccess;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-npb-text">Alunos</h1>
          <p className="text-sm text-npb-text-muted">
            {list.length === 0
              ? hasAnyFilter
                ? "Nenhum aluno encontrado com esses filtros."
                : "Nenhum aluno cadastrado."
              : `${list.length} aluno${list.length > 1 ? "s" : ""}${
                  hasAnyFilter ? " (filtrado)" : ""
                }.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={
              showFicticio
                ? buildHref({ ...searchParams, showFicticio: "0" })
                : buildHref({ ...searchParams, showFicticio: undefined })
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

      {/* Filtros */}
      <StudentsFilters
        defaults={{
          q,
          cohort: cohortId,
          from: dateFrom,
          to: dateTo,
          access: lastAccess,
          showFicticio,
        }}
        cohorts={cohorts}
      />

      {list.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-npb-border bg-npb-bg2 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-npb-text">
            {hasAnyFilter
              ? "Nenhum aluno bate com esses filtros"
              : "Nenhum aluno por aqui ainda"}
          </h2>
          {!hasAnyFilter && (
            <>
              <p className="mt-1 max-w-md text-sm text-npb-text-muted">
                Crie alunos manualmente aqui ou aguarde as vendas serem
                processadas pelo auto-enroll.
              </p>
              <Link
                href="/admin/students/new"
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
              >
                <Plus className="h-4 w-4" />
                Criar primeiro aluno
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-npb-border bg-npb-bg2 npb-scrollbar">
          <table className="w-full min-w-[840px]">
            <thead className="border-b border-npb-border bg-npb-bg3 text-left text-xs uppercase tracking-wider text-npb-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Aluno</th>
                <th className="px-4 py-2.5 font-semibold">Telefone</th>
                <th className="px-4 py-2.5 font-semibold">Matrículas</th>
                <th className="px-4 py-2.5 font-semibold">Confirmou</th>
                <th className="px-4 py-2.5 font-semibold">Último acesso</th>
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
                    {s.has_logged_in ? (
                      <span
                        title="Aluno entrou pelo menos uma vez na plataforma"
                        className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> Sim
                      </span>
                    ) : (
                      <span
                        title="Aluno nunca acessou — provavelmente não viu o e-mail/WhatsApp da Kiwify"
                        className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400"
                      >
                        <XCircle className="h-2.5 w-2.5" /> Não
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-npb-text-muted">
                    {s.last_sign_in_at
                      ? formatDateTimeBrt(s.last_sign_in_at)
                      : "—"}
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
                    {formatDateBrt(s.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 500 && (
            <div className="border-t border-npb-border bg-npb-bg3/50 px-4 py-2 text-center text-[11px] text-npb-text-muted">
              Mostrando primeiros 500 — refine os filtros pra ver mais.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Mantem search params atuais ao alternar showFicticio. */
function buildHref(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.cohort) sp.set("cohort", params.cohort);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.access) sp.set("access", params.access);
  if (params.showFicticio === "0") sp.set("showFicticio", "0");
  const s = sp.toString();
  return s ? `/admin/students?${s}` : "/admin/students";
}
