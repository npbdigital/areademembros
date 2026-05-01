"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

// ============================================================
// Helpers
// ============================================================

async function assertAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Sem permissão.");
  return user.id;
}

function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local — preencha antes de criar/editar conteúdo. Pega em https://supabase.com/dashboard/project/hblyregbowxaxzpnerhf/settings/api-keys (chave 'npb-area-de-membros').",
    );
  }
  return createAdminClient().schema("membros");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

function nullableStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

function nullableInt(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function nullableDate(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  if (v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function nextPosition(
  table: "courses" | "modules" | "lessons",
  filter: { column: string; value: string } | null,
): Promise<number> {
  let q = admin().from(table).select("position").order("position", {
    ascending: false,
  }).limit(1);
  if (filter) q = q.eq(filter.column, filter.value);
  const { data } = await q;
  const max = data?.[0]?.position ?? -1;
  return max + 1;
}

// ============================================================
// COURSES
// ============================================================

export async function createCourseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const position = await nextPosition("courses", null);
  const { data, error } = await admin()
    .from("courses")
    .insert({
      title,
      description: nullableStr(formData, "description"),
      cover_url: nullableStr(formData, "cover_url"),
      is_published: bool(formData, "is_published"),
      is_for_sale: bool(formData, "is_for_sale"),
      sale_url: nullableStr(formData, "sale_url"),
      position,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${data.id}`);
}

export async function updateCourseAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const { error } = await admin()
    .from("courses")
    .update({
      title,
      description: nullableStr(formData, "description"),
      cover_url: nullableStr(formData, "cover_url"),
      is_published: bool(formData, "is_published"),
      is_for_sale: bool(formData, "is_for_sale"),
      sale_url: nullableStr(formData, "sale_url"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { ok: true };
}

export async function deleteCourseAction(id: string) {
  await assertAdmin();
  const { error } = await admin().from("courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function moveCourseAction(id: string, direction: "up" | "down") {
  await assertAdmin();
  await swapPosition("courses", id, direction, null);
  revalidatePath("/admin/courses");
}

// ============================================================
// MODULES
// ============================================================

export async function createModuleAction(
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const position = await nextPosition("modules", {
    column: "course_id",
    value: courseId,
  });
  const { error } = await admin().from("modules").insert({
    course_id: courseId,
    title,
    position,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function updateModuleAction(
  id: string,
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const releaseType = str(formData, "release_type") || "immediate";
  const validTypes = [
    "immediate",
    "locked",
    "days_after_enrollment",
    "fixed_date",
  ];
  if (!validTypes.includes(releaseType)) {
    return { ok: false, error: "Tipo de liberação inválido." };
  }

  const { error } = await admin()
    .from("modules")
    .update({
      title,
      description: nullableStr(formData, "description"),
      cover_url: nullableStr(formData, "cover_url"),
      release_type: releaseType,
      release_days:
        releaseType === "days_after_enrollment"
          ? nullableInt(formData, "release_days")
          : null,
      release_date:
        releaseType === "fixed_date"
          ? nullableDate(formData, "release_date")
          : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/modules/${id}`);
  return { ok: true };
}

export async function deleteModuleAction(id: string, courseId: string) {
  await assertAdmin();
  const { error } = await admin().from("modules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}`);
}

export async function moveModuleAction(
  id: string,
  courseId: string,
  direction: "up" | "down",
) {
  await assertAdmin();
  await swapPosition("modules", id, direction, {
    column: "course_id",
    value: courseId,
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

// ============================================================
// LESSONS
// ============================================================

export async function createLessonAction(
  moduleId: string,
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const position = await nextPosition("lessons", {
    column: "module_id",
    value: moduleId,
  });
  const { error } = await admin().from("lessons").insert({
    module_id: moduleId,
    title,
    position,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}/modules/${moduleId}`);
  return { ok: true };
}

export async function updateLessonAction(
  id: string,
  moduleId: string,
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Título é obrigatório." };

  const releaseType = str(formData, "release_type") || "immediate";
  const validTypes = [
    "immediate",
    "locked",
    "days_after_enrollment",
    "fixed_date",
  ];
  if (!validTypes.includes(releaseType)) {
    return { ok: false, error: "Tipo de liberação inválido." };
  }

  const { error } = await admin()
    .from("lessons")
    .update({
      title,
      description_html: nullableStr(formData, "description_html"),
      youtube_video_id: nullableStr(formData, "youtube_video_id"),
      duration_seconds: nullableInt(formData, "duration_seconds"),
      release_type: releaseType,
      release_days:
        releaseType === "days_after_enrollment"
          ? nullableInt(formData, "release_days")
          : null,
      release_date:
        releaseType === "fixed_date"
          ? nullableDate(formData, "release_date")
          : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}/modules/${moduleId}`);
  revalidatePath(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons/${id}`,
  );
  return { ok: true };
}

export async function deleteLessonAction(
  id: string,
  moduleId: string,
  courseId: string,
) {
  await assertAdmin();
  const { error } = await admin().from("lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/modules/${moduleId}`);
  redirect(`/admin/courses/${courseId}/modules/${moduleId}`);
}

export async function moveLessonAction(
  id: string,
  moduleId: string,
  courseId: string,
  direction: "up" | "down",
) {
  await assertAdmin();
  await swapPosition("lessons", id, direction, {
    column: "module_id",
    value: moduleId,
  });
  revalidatePath(`/admin/courses/${courseId}/modules/${moduleId}`);
}

// ============================================================
// Reorder helper — troca position com o vizinho na direção
// ============================================================

async function swapPosition(
  table: "courses" | "modules" | "lessons",
  id: string,
  direction: "up" | "down",
  filter: { column: string; value: string } | null,
) {
  const client = admin();

  const { data: current } = await client
    .from(table)
    .select("id, position")
    .eq("id", id)
    .single();
  if (!current) throw new Error("Item não encontrado.");

  const op = direction === "up" ? "lt" : "gt";
  const order = direction === "up";
  let q = client
    .from(table)
    .select("id, position")
    [op]("position", current.position)
    .order("position", { ascending: order })
    .limit(1);
  if (filter) q = q.eq(filter.column, filter.value);
  const { data: neighbor } = await q;

  const other = neighbor?.[0];
  if (!other) return;

  // troca posições — usa updates separados (Postgres unique futuro?)
  await client.from(table).update({ position: other.position }).eq("id", id);
  await client
    .from(table)
    .update({ position: current.position })
    .eq("id", other.id);
}
