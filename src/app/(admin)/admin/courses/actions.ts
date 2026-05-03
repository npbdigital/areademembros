"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notifyEnrolledInCourse } from "@/lib/notifications";
import { autoShortenHtml } from "@/lib/short-links";

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
  table: "courses" | "modules" | "lessons" | "banners" | "lesson_attachments",
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
      welcome_popup_enabled: bool(formData, "welcome_popup_enabled"),
      welcome_popup_title: nullableStr(formData, "welcome_popup_title"),
      welcome_popup_description: nullableStr(formData, "welcome_popup_description"),
      welcome_popup_video_id: nullableStr(formData, "welcome_popup_video_id"),
      welcome_popup_terms: nullableStr(formData, "welcome_popup_terms"),
      welcome_popup_button_label: nullableStr(formData, "welcome_popup_button_label"),
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

  const newPublished = bool(formData, "is_published");

  // Detecta transição false → true pra disparar notificação de "novo curso"
  const { data: currentRow } = await admin()
    .from("courses")
    .select("is_published")
    .eq("id", id)
    .maybeSingle();
  const wasPublished = (currentRow as { is_published: boolean | null } | null)
    ?.is_published;
  const justPublished = wasPublished === false && newPublished === true;

  const { error } = await admin()
    .from("courses")
    .update({
      title,
      description: nullableStr(formData, "description"),
      cover_url: nullableStr(formData, "cover_url"),
      is_published: newPublished,
      is_for_sale: bool(formData, "is_for_sale"),
      sale_url: nullableStr(formData, "sale_url"),
      welcome_popup_enabled: bool(formData, "welcome_popup_enabled"),
      welcome_popup_title: nullableStr(formData, "welcome_popup_title"),
      welcome_popup_description: nullableStr(formData, "welcome_popup_description"),
      welcome_popup_video_id: nullableStr(formData, "welcome_popup_video_id"),
      welcome_popup_terms: nullableStr(formData, "welcome_popup_terms"),
      welcome_popup_button_label: nullableStr(formData, "welcome_popup_button_label"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  if (justPublished) {
    // Fire-and-forget: notifica + e-mail + push (evento importante)
    void notifyEnrolledInCourse({
      courseId: id,
      title: `Novo curso disponível: ${title}`,
      body: "Acesse agora pra começar a estudar.",
      link: `/courses/${id}`,
      ctaLabel: "Acessar curso",
      withEmail: true,
      pushCategory: "lesson_drip",
    });
  }

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

/**
 * Quick edit — só título e capa, preserva os demais campos
 * (description, drip, etc). Usado no popup de edição rápida.
 */
export async function quickUpdateModuleAction(
  id: string,
  courseId: string,
  payload: { title?: string; cover_url?: string | null },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const update: Record<string, unknown> = {};
    if (typeof payload.title === "string") {
      const t = payload.title.trim();
      if (!t) return { ok: false, error: "Título é obrigatório." };
      update.title = t;
    }
    if (payload.cover_url !== undefined) {
      const c = (payload.cover_url ?? "").trim();
      update.cover_url = c === "" ? null : c;
    }
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await admin().from("modules").update(update).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/courses/${courseId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
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
  const { data: lessonRow, error } = await admin()
    .from("lessons")
    .insert({
      module_id: moduleId,
      title,
      position,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Se o curso já está publicado, notifica matriculados (in-app só, sem
  // e-mail — evento de volume alto)
  const { data: courseRow } = await admin()
    .from("courses")
    .select("is_published, title")
    .eq("id", courseId)
    .maybeSingle();
  const course = courseRow as
    | { is_published: boolean | null; title: string }
    | null;
  if (course?.is_published) {
    const lessonId = (lessonRow as { id: string } | null)?.id;
    void notifyEnrolledInCourse({
      courseId,
      title: `Nova aula em ${course.title}`,
      body: title,
      link: lessonId ? `/lessons/${lessonId}` : `/courses/${courseId}`,
      ctaLabel: "Assistir agora",
      withEmail: false,
      pushCategory: "lesson_drip",
    });
  }

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
  const userId = await assertAdmin();
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

  // Auto-shortener: troca URLs longas no HTML por /l/{slug} antes de salvar.
  // Idempotente (cada URL gera 1 slug pra sempre). Falha não bloqueia o save.
  const rawDescription = nullableStr(formData, "description_html");
  const description_html = await autoShortenHtml(rawDescription, userId).catch(
    () => rawDescription,
  );

  const { error } = await admin()
    .from("lessons")
    .update({
      title,
      description_html,
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
// BANNERS (vinculados a um curso)
// ============================================================

export async function createBannerAction(
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const imageUrl = str(formData, "image_url");
  if (!imageUrl) return { ok: false, error: "URL da imagem é obrigatória." };

  const linkTarget = str(formData, "link_target") || "_blank";
  if (linkTarget !== "_blank" && linkTarget !== "_self") {
    return { ok: false, error: "Alvo do link inválido." };
  }

  const position = await nextPosition("banners", {
    column: "course_id",
    value: courseId,
  });

  const { error } = await admin().from("banners").insert({
    course_id: courseId,
    image_url: imageUrl,
    link_url: nullableStr(formData, "link_url"),
    link_target: linkTarget,
    is_active: bool(formData, "is_active"),
    position,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

export async function updateBannerAction(
  id: string,
  courseId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const imageUrl = str(formData, "image_url");
  if (!imageUrl) return { ok: false, error: "URL da imagem é obrigatória." };

  const linkTarget = str(formData, "link_target") || "_blank";
  if (linkTarget !== "_blank" && linkTarget !== "_self") {
    return { ok: false, error: "Alvo do link inválido." };
  }

  const { error } = await admin()
    .from("banners")
    .update({
      image_url: imageUrl,
      link_url: nullableStr(formData, "link_url"),
      link_target: linkTarget,
      is_active: bool(formData, "is_active"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

export async function deleteBannerAction(id: string, courseId: string) {
  await assertAdmin();
  const { error } = await admin().from("banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
}

export async function moveBannerAction(
  id: string,
  courseId: string,
  direction: "up" | "down",
) {
  await assertAdmin();
  await swapPosition("banners", id, direction, {
    column: "course_id",
    value: courseId,
  });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
}

export async function toggleBannerActiveAction(
  id: string,
  courseId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { error } = await admin()
      .from("banners")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/courses/${courseId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

// ============================================================
// LESSON ATTACHMENTS
// ============================================================

const LESSON_ATTACHMENT_BUCKET = "lesson-attachments";

export async function addLessonAttachmentAction(
  lessonId: string,
  moduleId: string,
  courseId: string,
  payload: {
    fileName: string;
    fileUrl: string;
    fileSizeBytes?: number | null;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const fileName = payload.fileName?.trim();
    const fileUrl = payload.fileUrl?.trim();
    if (!fileName || !fileUrl) {
      return { ok: false, error: "Nome e URL do arquivo são obrigatórios." };
    }

    const position = await nextPosition("lesson_attachments", {
      column: "lesson_id",
      value: lessonId,
    });

    const { error } = await admin().from("lesson_attachments").insert({
      lesson_id: lessonId,
      file_name: fileName,
      file_url: fileUrl,
      file_size_bytes: payload.fileSizeBytes ?? null,
      position,
    });

    if (error) return { ok: false, error: error.message };
    revalidatePath(
      `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
    );
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function deleteLessonAttachmentAction(
  id: string,
  lessonId: string,
  moduleId: string,
  courseId: string,
) {
  await assertAdmin();
  const client = admin();

  const { data: existing } = await client
    .from("lesson_attachments")
    .select("file_url")
    .eq("id", id)
    .single();

  const { error } = await client
    .from("lesson_attachments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (existing?.file_url) {
    const path = extractStoragePath(
      existing.file_url,
      LESSON_ATTACHMENT_BUCKET,
    );
    if (path) {
      await createAdminClient()
        .storage.from(LESSON_ATTACHMENT_BUCKET)
        .remove([path]);
    }
  }

  revalidatePath(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
  );
  revalidatePath(`/lessons/${lessonId}`);
}

export async function moveLessonAttachmentAction(
  id: string,
  lessonId: string,
  moduleId: string,
  courseId: string,
  direction: "up" | "down",
) {
  await assertAdmin();
  await swapPosition("lesson_attachments", id, direction, {
    column: "lesson_id",
    value: lessonId,
  });
  revalidatePath(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
  );
  revalidatePath(`/lessons/${lessonId}`);
}

/**
 * Extrai o path interno do bucket de uma URL pública do Supabase Storage.
 * Ex: https://xxx.supabase.co/storage/v1/object/public/lesson-attachments/abc.pdf
 *  → "abc.pdf"
 */
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// ============================================================
// REORDER em lote — usado pelo drag-and-drop (SortableList)
// ============================================================

type SortableTable =
  | "courses"
  | "modules"
  | "lessons"
  | "banners"
  | "lesson_attachments";

const VALID_SORTABLE_TABLES: SortableTable[] = [
  "courses",
  "modules",
  "lessons",
  "banners",
  "lesson_attachments",
];

/**
 * Recebe a nova ordem completa de uma lista (todos os ids do escopo) e
 * reescreve `position` de cada um. Pra suportar a UNIQUE de (escopo, position)
 * eventual, faz em duas fases: deslocando pra negativo e depois reaplicando.
 *
 * `revalidatePathHints` é uma lista de paths a invalidar após o update.
 */
export async function reorderEntitiesAction(
  table: SortableTable,
  idsInOrder: string[],
  revalidatePathHints: string[] = [],
): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!VALID_SORTABLE_TABLES.includes(table)) {
      return { ok: false, error: "Tabela inválida." };
    }
    if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) {
      return { ok: true };
    }

    const client = admin();

    // Fase 1: garante posições negativas únicas (evita conflito de UNIQUE
    // se algum dia adicionarmos)
    await Promise.all(
      idsInOrder.map((id, i) =>
        client
          .from(table)
          .update({ position: -1 - i })
          .eq("id", id),
      ),
    );

    // Fase 2: aplica posições finais 0..N-1
    await Promise.all(
      idsInOrder.map((id, i) =>
        client
          .from(table)
          .update({ position: i })
          .eq("id", id),
      ),
    );

    for (const path of revalidatePathHints) {
      revalidatePath(path);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

// ============================================================
// Reorder helper — troca position com o vizinho na direção
// (usado pelos botões antigos up/down — ainda válido pra lugares que
//  não migraram pro drag-and-drop)
// ============================================================

async function swapPosition(
  table:
    | "courses"
    | "modules"
    | "lessons"
    | "banners"
    | "lesson_attachments",
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
