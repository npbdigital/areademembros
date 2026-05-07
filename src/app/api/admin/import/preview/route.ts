import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { parseImportCsv, summarizeImport } from "@/lib/import-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dry-run da importação. Recebe o CSV em texto + cohortId e retorna:
 *   - Análise de cabeçalho/colunas
 *   - Lista de linhas com erros/warnings
 *   - Resumo agregado (X criar, Y já existem, Z falhar)
 *   - Sample dos primeiros 10 alunos pra preview visual
 *
 * Não toca em auth.users nem membros.users — só lê.
 */
export async function POST(req: NextRequest) {
  // Auth admin
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Sem permissão." },
      { status: 403 },
    );
  }

  // Body: { cohortId, csv }
  const body = (await req.json().catch(() => null)) as {
    cohortId?: string;
    csv?: string;
  } | null;
  if (!body?.cohortId || !body.csv) {
    return NextResponse.json(
      { ok: false, error: "cohortId e csv são obrigatórios." },
      { status: 400 },
    );
  }

  const sb = createAdminClient();

  // Valida que a turma existe
  const { data: cohort } = await sb
    .schema("membros")
    .from("cohorts")
    .select("id, name, default_duration_days")
    .eq("id", body.cohortId)
    .maybeSingle();
  if (!cohort) {
    return NextResponse.json(
      { ok: false, error: "Turma não encontrada." },
      { status: 404 },
    );
  }
  const c = cohort as {
    id: string;
    name: string;
    default_duration_days: number | null;
  };

  // Parse CSV
  const parsed = parseImportCsv(body.csv);
  if (parsed.fatalErrors.length > 0) {
    return NextResponse.json({
      ok: false,
      fatalErrors: parsed.fatalErrors,
    });
  }

  const plan = summarizeImport(parsed.rows);

  // Cruza com o banco — quem ja existe?
  const validEmails = parsed.rows
    .filter((r) => r.errors.length === 0)
    .map((r) => r.email);
  const uniqueEmails = Array.from(new Set(validEmails));

  let existingUsers = new Map<string, { id: string }>();
  let existingEnrollments = new Map<string, { enrolled_at: string }>();

  if (uniqueEmails.length > 0) {
    // Membros que ja tem profile
    const { data: usersData } = await sb
      .schema("membros")
      .from("users")
      .select("id, email")
      .in("email", uniqueEmails);
    existingUsers = new Map(
      ((usersData ?? []) as Array<{ id: string; email: string }>).map((u) => [
        u.email.toLowerCase(),
        { id: u.id },
      ]),
    );

    // Enrollments existentes nessa cohort
    const userIds = Array.from(existingUsers.values()).map((u) => u.id);
    if (userIds.length > 0) {
      const { data: enData } = await sb
        .schema("membros")
        .from("enrollments")
        .select("user_id, enrolled_at")
        .eq("cohort_id", c.id)
        .in("user_id", userIds);
      const byUser = new Map(
        ((enData ?? []) as Array<{ user_id: string; enrolled_at: string }>).map(
          (e) => [e.user_id, { enrolled_at: e.enrolled_at }],
        ),
      );
      existingEnrollments = new Map(
        Array.from(existingUsers.entries()).map(([email, u]) => {
          const en = byUser.get(u.id);
          return en ? [email, en] : [email, null as never];
        }).filter(([, v]) => v !== undefined && v !== null) as Array<
          [string, { enrolled_at: string }]
        >,
      );
    }
  }

  // Categoriza cada linha
  let willCreateUser = 0;
  let willUseExistingUser = 0;
  let willCreateEnrollment = 0;
  let willUpdateEnrollment = 0;
  let willSkipEnrollment = 0;

  for (const r of parsed.rows) {
    if (r.errors.length > 0) continue;
    const existing = existingUsers.get(r.email);
    if (existing) {
      willUseExistingUser++;
      const existingEn = existingEnrollments.get(r.email);
      if (existingEn) {
        // Mais recente que a do banco -> atualiza
        if (
          r.enrolledAtIso &&
          new Date(r.enrolledAtIso) > new Date(existingEn.enrolled_at)
        ) {
          willUpdateEnrollment++;
        } else {
          willSkipEnrollment++;
        }
      } else {
        willCreateEnrollment++;
      }
    } else {
      willCreateUser++;
      willCreateEnrollment++;
    }
  }

  // Sample pro preview visual: pega os primeiros 10 (validos OU invalidos)
  const sample = parsed.rows.slice(0, 10).map((r) => ({
    rowNum: r.rowNum,
    email: r.email,
    fullName: r.fullName,
    cpf: r.cpf,
    phone: r.phone,
    enrolledAtIso: r.enrolledAtIso,
    errors: r.errors,
    warnings: r.warnings,
    existing: existingUsers.has(r.email),
  }));

  // Lista os erros bloqueantes pra mostrar no dry-run
  const errorRows = parsed.rows
    .filter((r) => r.errors.length > 0)
    .slice(0, 50)
    .map((r) => ({
      rowNum: r.rowNum,
      email: r.email,
      errors: r.errors,
    }));

  return NextResponse.json({
    ok: true,
    cohort: { id: c.id, name: c.name, durationDays: c.default_duration_days },
    plan: {
      totalRows: plan.totalRows,
      validRows: plan.validRows,
      invalidRows: plan.invalidRows,
      emailsDuplicatedInCsv: plan.emailsDuplicatedInCsv,
      willCreateUser,
      willUseExistingUser,
      willCreateEnrollment,
      willUpdateEnrollment,
      willSkipEnrollment,
    },
    sample,
    errorRows,
  });
}
