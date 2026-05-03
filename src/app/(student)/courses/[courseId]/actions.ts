"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Marca que o aluno aceitou o popup de boas-vindas DESSE curso.
 * Idempotente: chamar 2x não dá erro (PK composta + ON CONFLICT).
 */
export async function acceptCourseWelcomeAction(
  courseId: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const { error } = await supabase
      .schema("membros")
      .from("course_welcome_accepted")
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
        },
        { onConflict: "user_id,course_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/courses/${courseId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
