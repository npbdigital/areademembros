/**
 * Helpers de acesso à Comunidade.
 *
 * Modelo: comunidade GLOBAL única. Acesso é gateado pelo flag
 * `has_community_access` em cohort_courses — basta UMA matrícula ativa
 * em UMA turma que tenha ao menos UM curso com esse flag pra liberar.
 *
 * Admin e moderator sempre passam.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isElevatedRole } from "@/lib/access";

export interface CommunitySpaceRow {
  id: string;
  title: string;
  position: number;
  is_active: boolean;
}

export interface CommunityPageRow {
  id: string;
  space_id: string | null;
  title: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
  position: number;
  is_active: boolean;
}

export interface CommunitySidebarLinkRow {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  position: number;
  open_in_new_tab: boolean;
  is_active: boolean;
}

export async function userHasCommunityAccess(
  supabase: SupabaseClient,
  userId: string,
  role?: string | null,
): Promise<boolean> {
  if (isElevatedRole(role ?? null)) return true;

  const nowIso = new Date().toISOString();
  // Pega cohorts ativos do user
  const { data: enrollments } = await supabase
    .schema("membros")
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const cohortIds = ((enrollments ?? []) as Array<{ cohort_id: string }>).map(
    (e) => e.cohort_id,
  );
  if (cohortIds.length === 0) return false;

  // Existe ao menos um cohort_courses com has_community_access nessas turmas?
  const { count } = await supabase
    .schema("membros")
    .from("cohort_courses")
    .select("id", { count: "exact", head: true })
    .in("cohort_id", cohortIds)
    .eq("has_community_access", true);

  return (count ?? 0) > 0;
}

/** Slug-safe: remove acentos, lowercase, troca espaços por hífen. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Converte URL de YouTube/Vimeo em embed URL. Retorna null se não casar.
 */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/**
 * Sanitiza HTML do TipTap removendo tags perigosas (XSS guard).
 *
 * Iframes só passam quando o `src` é YouTube embed ou Vimeo player — esses
 * são reescritos com atributos seguros conhecidos. Qualquer outro iframe é
 * removido. Implementação minimal — para casos sensíveis, considerar
 * isomorphic-dompurify.
 */
export function sanitizePostHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[^>]*>(?:[\s\S]*?<\/iframe>)?/gi, (match) => {
      const srcMatch = match.match(/src\s*=\s*"([^"]+)"/i);
      if (!srcMatch) return "";
      const src = srcMatch[1];
      const isYouTube =
        /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//.test(src);
      const isVimeo = /^https:\/\/player\.vimeo\.com\/video\//.test(src);
      if (!isYouTube && !isVimeo) return "";
      return `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="aspect-video w-full rounded-md border border-npb-border my-3"></iframe>`;
    })
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function timeAgoPtBr(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} d atrás`;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
