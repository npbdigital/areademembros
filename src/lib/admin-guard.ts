import { createClient } from "@/lib/supabase/server";

/**
 * Retorna o user.id se for admin; caso contrário null.
 * Usado em route handlers admin-only.
 */
export async function getAdminUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user.id : null;
}
