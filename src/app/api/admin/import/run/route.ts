import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { parseImportCsv, type ParsedRow } from "@/lib/import-csv";
import { expiresAtFromDuration } from "@/lib/enrollment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_PASSWORD = "mudar123";
const CHUNK_SIZE = 50;

/**
 * Processa um CHUNK de linhas do CSV. Cliente envia { cohortId, csv,
 * offset } e backend processa as proximas CHUNK_SIZE linhas a partir do
 * offset, retornando contadores e o proximo offset.
 *
 * Por que chunks: importar 10k alunos em 1 request estoura maxDuration
 * de 60s (cada createUser leva ~500ms, 10k = 1h). Cliente fica num loop
 * ate offset == total.
 *
 * Idempotencia:
 *   - Aluno por email (membros.users.email + auth.users.email)
 *   - Enrollment por (user_id, cohort_id) — UPSERT com onConflict
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

  const body = (await req.json().catch(() => null)) as {
    cohortId?: string;
    csv?: string;
    offset?: number;
  } | null;
  if (!body?.cohortId || !body.csv) {
    return NextResponse.json(
      { ok: false, error: "cohortId e csv são obrigatórios." },
      { status: 400 },
    );
  }
  const offset = Math.max(0, body.offset ?? 0);

  const sb = createAdminClient();

  // Valida turma + pega duracao
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

  const parsed = parseImportCsv(body.csv);
  if (parsed.fatalErrors.length > 0) {
    return NextResponse.json(
      { ok: false, fatalErrors: parsed.fatalErrors },
      { status: 400 },
    );
  }

  const total = parsed.rows.length;
  const chunk = parsed.rows.slice(offset, offset + CHUNK_SIZE);

  let userCreated = 0;
  let userExisting = 0;
  let enrollmentCreated = 0;
  let enrollmentUpdated = 0;
  let enrollmentSkipped = 0;
  let failed = 0;
  const failures: Array<{ rowNum: number; email: string; reason: string }> = [];

  for (const row of chunk) {
    if (row.errors.length > 0) {
      failed++;
      failures.push({
        rowNum: row.rowNum,
        email: row.email,
        reason: row.errors.join("; "),
      });
      continue;
    }

    try {
      const result = await processRow(sb, c, row);
      if (result.userCreated) userCreated++;
      else userExisting++;

      if (result.enrollmentAction === "created") enrollmentCreated++;
      else if (result.enrollmentAction === "updated") enrollmentUpdated++;
      else enrollmentSkipped++;
    } catch (e) {
      failed++;
      failures.push({
        rowNum: row.rowNum,
        email: row.email,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const nextOffset = offset + chunk.length;
  const done = nextOffset >= total;

  return NextResponse.json({
    ok: true,
    total,
    processed: nextOffset,
    chunkSize: chunk.length,
    nextOffset: done ? null : nextOffset,
    done,
    counters: {
      userCreated,
      userExisting,
      enrollmentCreated,
      enrollmentUpdated,
      enrollmentSkipped,
      failed,
    },
    failures,
  });
}

interface RowResult {
  userId: string;
  userCreated: boolean;
  enrollmentAction: "created" | "updated" | "skipped";
}

async function processRow(
  sb: ReturnType<typeof createAdminClient>,
  cohort: { id: string; default_duration_days: number | null },
  row: ParsedRow,
): Promise<RowResult> {
  // 1. Resolve user (cria se nao existir, com senha mudar123)
  const userResult = await resolveOrCreateUser(sb, row);

  // 2. Cria/atualiza enrollment respeitando a regra:
  //    - Nao existe -> CREATE
  //    - Existe e CSV mais recente -> UPDATE (renova vencimento)
  //    - Existe e CSV mais antigo (ou igual) -> SKIP
  const enrolledAt = row.enrolledAtIso!; // garantido pelo parser
  const expiresAt = expiresAtFromDuration(
    cohort.default_duration_days,
    new Date(enrolledAt),
  );

  const { data: existing } = await sb
    .schema("membros")
    .from("enrollments")
    .select("id, enrolled_at")
    .eq("user_id", userResult.userId)
    .eq("cohort_id", cohort.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await sb
      .schema("membros")
      .from("enrollments")
      .insert({
        user_id: userResult.userId,
        cohort_id: cohort.id,
        enrolled_at: enrolledAt,
        expires_at: expiresAt,
        source: "manual",
        is_active: true,
      });
    if (error) throw new Error(`Falha enrollment: ${error.message}`);
    return { ...userResult, enrollmentAction: "created" };
  }

  const ex = existing as { id: string; enrolled_at: string };
  const csvDate = new Date(enrolledAt);
  const dbDate = new Date(ex.enrolled_at);

  if (csvDate > dbDate) {
    // CSV é mais recente — renova
    const { error } = await sb
      .schema("membros")
      .from("enrollments")
      .update({
        enrolled_at: enrolledAt,
        expires_at: expiresAt,
        is_active: true,
      })
      .eq("id", ex.id);
    if (error) throw new Error(`Falha update enrollment: ${error.message}`);
    return { ...userResult, enrollmentAction: "updated" };
  }

  // CSV mais antigo ou igual — preserva o existente
  return { ...userResult, enrollmentAction: "skipped" };
}

async function resolveOrCreateUser(
  sb: ReturnType<typeof createAdminClient>,
  row: ParsedRow,
): Promise<{ userId: string; userCreated: boolean }> {
  const email = row.email;

  // Tenta achar profile
  const { data: profile } = await sb
    .schema("membros")
    .from("users")
    .select("id, full_name, phone, cpf")
    .eq("email", email)
    .maybeSingle();
  const p = profile as
    | { id: string; full_name: string | null; phone: string | null; cpf: string | null }
    | null;

  if (p) {
    // Update soft: so preenche o que ainda esta vazio (preserva edicoes do admin)
    const updates: Record<string, unknown> = { is_active: true };
    if (!p.full_name && row.fullName) updates.full_name = row.fullName;
    if (!p.phone && row.phone) updates.phone = row.phone;
    if (!p.cpf && row.cpf) updates.cpf = row.cpf;
    await sb
      .schema("membros")
      .from("users")
      .update(updates)
      .eq("id", p.id);
    return { userId: p.id, userCreated: false };
  }

  // Nao existe profile — tenta criar via auth.admin.createUser
  const { data: created, error: createErr } =
    await sb.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: row.fullName,
        phone: row.phone,
        cpf: row.cpf,
      },
    });

  // Se erro "already registered", busca via listUsers
  if (createErr) {
    if (
      createErr.message.toLowerCase().includes("already") ||
      createErr.message.toLowerCase().includes("registered")
    ) {
      const { data: listResult } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const found = listResult.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (!found) {
        throw new Error(
          `User existe em auth mas listUsers nao retornou (paginado >1000?): ${email}`,
        );
      }
      // Sincroniza profile
      await sb
        .schema("membros")
        .from("users")
        .upsert(
          {
            id: found.id,
            email,
            full_name: row.fullName,
            phone: row.phone,
            cpf: row.cpf,
            role: "student",
            is_active: true,
          },
          { onConflict: "id" },
        );
      return { userId: found.id, userCreated: false };
    }
    throw new Error(`auth.createUser: ${createErr.message}`);
  }

  if (!created?.user) {
    throw new Error("auth.createUser sem user na resposta");
  }
  const userId = created.user.id;

  // Cria profile em membros.users
  const { error: profileErr } = await sb
    .schema("membros")
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        full_name: row.fullName,
        phone: row.phone,
        cpf: row.cpf,
        role: "student",
        is_active: true,
      },
      { onConflict: "id" },
    );
  if (profileErr) throw new Error(`profile: ${profileErr.message}`);

  return { userId, userCreated: true };
}
