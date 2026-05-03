/**
 * Encurtador de URLs interno. Cria slugs base62 de 6+ chars e mapeia pra
 * URL alvo em `membros.short_links`. Idempotente por target_url — chamar
 * `getOrCreateShortLink` com a mesma URL retorna o mesmo slug.
 *
 * Usado tanto manualmente (admin cria via UI) quanto automaticamente
 * (lesson update detecta URLs longas no description_html e substitui).
 */

import { createAdminClient } from "@/lib/supabase/server";

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Caracteres no slug. Threshold pra auto-shorten. */
export const AUTO_SHORTEN_MIN_LEN = 40;

function genSlug(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function normalize(url: string): string {
  return url.trim();
}

/**
 * Procura shortlink existente com a mesma target_url; se não houver, cria
 * com slug aleatório (retry se colidir, aumentando o tamanho). Retorna o
 * slug pronto pra montar `/l/{slug}`.
 */
export async function getOrCreateShortLink(
  url: string,
  userId: string | null,
): Promise<string> {
  const target = normalize(url);
  const admin = createAdminClient().schema("membros");

  // 1) Já existe?
  const { data: existing } = await admin
    .from("short_links")
    .select("slug")
    .eq("target_url", target)
    .maybeSingle();
  if (existing) return (existing as { slug: string }).slug;

  // 2) Cria novo. Retry com slug maior se colidir.
  for (let attempt = 0; attempt < 6; attempt++) {
    const slugLen = 6 + Math.floor(attempt / 2);
    const slug = genSlug(slugLen);
    const { data, error } = await admin
      .from("short_links")
      .insert({ slug, target_url: target, created_by: userId })
      .select("slug")
      .single();
    if (data) return (data as { slug: string }).slug;
    // Conflito de slug: tenta de novo. Outro erro: relança.
    const isDup =
      typeof error?.code === "string" && error.code === "23505";
    if (!isDup) {
      throw new Error(error?.message ?? "Falha ao criar shortlink.");
    }
  }
  throw new Error("Não conseguiu gerar slug único após 6 tentativas.");
}

/**
 * Varre HTML procurando `<a href="...">texto</a>` com URLs longas e
 * substitui in-place por `/l/{slug}`. Idempotente: shortlinks que já
 * apontam pra `/l/...` não são processados de novo.
 *
 * Quando o texto visível é igual à URL (autolink do Tiptap), também
 * substitui o texto pelo shortlink — caso contrário preserva o texto
 * original que o admin escreveu.
 */
export async function autoShortenHtml(
  html: string | null,
  userId: string | null,
): Promise<string | null> {
  if (!html) return html;
  if (html.length < AUTO_SHORTEN_MIN_LEN) return html;

  // Captura abertura, href e atributos. Não usa lookbehind pra compatibilidade.
  const re = /<a\b([^>]*?)href="([^"]+)"([^>]*?)>([\s\S]*?)<\/a>/gi;
  const matches = Array.from(html.matchAll(re));
  if (matches.length === 0) return html;

  type Replacement = { from: string; to: string };
  const replacements: Replacement[] = [];

  for (const match of matches) {
    const [full, before, href, after, text] = match;
    if (!href || href.length < AUTO_SHORTEN_MIN_LEN) continue;
    // Já é shortlink interno — pula
    if (href.startsWith("/l/") || /\/l\/[a-zA-Z0-9]{6,12}$/.test(href)) continue;
    // URLs relativas internas não precisam encurtar
    if (href.startsWith("/") && !href.startsWith("//")) continue;

    let slug: string;
    try {
      slug = await getOrCreateShortLink(href, userId);
    } catch {
      continue; // se falhar, deixa o link original
    }
    const newHref = `/l/${slug}`;
    const decodedText = text.trim();
    // Se o texto visível for a própria URL (autolink), reescreve também.
    // Senão preserva o texto custom do admin.
    const newText =
      decodedText === href || decodedText === encodeURI(href)
        ? newHref
        : text;
    const replacement = `<a${before}href="${newHref}"${after}>${newText}</a>`;
    replacements.push({ from: full, to: replacement });
  }

  let result = html;
  for (const { from, to } of replacements) {
    // Replace só primeira ocorrência (caso a mesma string apareça 2x)
    result = result.replace(from, to);
  }
  return result;
}
