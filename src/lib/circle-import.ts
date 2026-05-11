/**
 * Types + parsers pros 3 CSVs do export do Circle:
 *   - mentoria_20k_posts.csv
 *   - mentoria_20k_comments.csv
 *   - mentoria_20k_members.csv (opcional — usado pra puxar email + avatar do autor)
 *
 * Diferente do `lib/import-csv.ts` (importacao de alunos da plataforma antiga),
 * aqui o fluxo é em 2 etapas:
 *   1. ANALYZE: parse + cross-reference + retorna estrutura pra admin revisar
 *   2. RUN: recebe as decisoes do admin e executa o import seletivamente.
 */

export interface CircleSpace {
  id: string;
  name: string;
  slug: string;
}

export interface CircleMember {
  /** "User ID" do members.csv — diferente do "Member ID" em posts/comments */
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  headline: string;
  bio: string;
  joinDate: string;
}

export interface CirclePost {
  id: string;
  spaceId: string;
  createdAtIso: string;
  title: string;
  slug: string;
  body: string;
  htmlBody: string;
  authorMemberId: string;
  authorName: string;
  likesCount: number;
  commentsCount: number;
}

export interface CircleComment {
  id: string;
  postId: string;
  createdAtIso: string;
  spaceId: string;
  parentId: string | null;
  body: string;
  authorMemberId: string;
  authorName: string;
}

// ============================================================
// Parsers
// ============================================================

export function parseSpacesCsv(text: string): CircleSpace[] {
  const rows = parseCsv(text);
  return rows
    .map((r) => ({
      id: r["ID"] ?? "",
      name: r["Name"] ?? "",
      slug: r["Slug"] ?? "",
    }))
    .filter((s) => s.id && s.slug);
}

export function parseMembersCsv(text: string): CircleMember[] {
  const rows = parseCsv(text);
  return rows
    .map((r) => {
      const firstName = (r["First Name"] ?? "").trim();
      const lastName = (r["Last Name"] ?? "").trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return {
        userId: (r["User ID"] ?? "").trim(),
        firstName,
        lastName,
        fullName,
        email: (r["Email"] ?? "").trim().toLowerCase(),
        avatarUrl: (r["Avatar URL"] ?? "").trim(),
        headline: (r["Headline"] ?? "").trim(),
        bio: (r["Bio"] ?? "").trim(),
        joinDate: (r["Join Date"] ?? "").trim(),
      };
    })
    .filter((m) => m.userId && m.fullName);
}

export function parsePostsCsv(text: string): CirclePost[] {
  const rows = parseCsv(text);
  return rows
    .map((r) => ({
      id: (r["ID"] ?? "").trim(),
      spaceId: (r["Space ID"] ?? "").trim(),
      createdAtIso: parseCircleDate(r["Created at"] ?? "") ?? "",
      title: (r["Name"] ?? "").trim(),
      slug: (r["Slug"] ?? "").trim(),
      body: r["Body"] ?? "",
      htmlBody: r["HTML Body"] ?? "",
      authorMemberId: (r["Member ID"] ?? "").trim(),
      authorName: (r["Member Name"] ?? "").trim(),
      likesCount: parseInt(r["Numbers of likes"] ?? "0", 10) || 0,
      commentsCount: parseInt(r["Number of comments"] ?? "0", 10) || 0,
    }))
    .filter((p) => p.id && p.title);
}

export function parseCommentsCsv(text: string): CircleComment[] {
  const rows = parseCsv(text);
  return rows
    .map((r) => ({
      id: (r["ID"] ?? "").trim(),
      postId: (r["Post ID"] ?? "").trim(),
      createdAtIso: parseCircleDate(r["Created at"] ?? "") ?? "",
      spaceId: (r["Space ID"] ?? "").trim(),
      parentId: (r["Parent Comment"] ?? "").trim() || null,
      body: r["Body"] ?? "",
      authorMemberId: (r["Member ID"] ?? "").trim(),
      authorName: (r["Member Name"] ?? "").trim(),
    }))
    .filter((c) => c.id && c.postId);
}

// ============================================================
// Helpers
// ============================================================

/**
 * Parse de CSV tolerante (aspas, vírgula como separador, header na linha 0).
 * Retorna array de { coluna: valor }.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const cleaned = text.replace(/^﻿/, "").trim();
  if (!cleaned) return [];

  const lines = splitCsvLines(cleaned);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const out: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j] ?? "";
    }
    out.push(row);
  }
  return out;
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse de datas do Circle no formato "March 18, 2026 01:24 PM".
 * Retorna ISO UTC ou null se nao parseou.
 */
function parseCircleDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Acha o email de um autor cruzando o nome com o members.csv.
 * Match case-insensitive, normaliza espaços. Retorna null se nao achou.
 */
export function findAuthorEmail(
  authorName: string,
  members: CircleMember[],
): string | null {
  const normalized = normalizeName(authorName);
  for (const m of members) {
    if (normalizeName(m.fullName) === normalized) {
      return m.email || null;
    }
  }
  return null;
}

/**
 * Acha o member do Circle pelo nome (pra pegar avatar/headline/bio).
 */
export function findCircleMember(
  authorName: string,
  members: CircleMember[],
): CircleMember | null {
  const normalized = normalizeName(authorName);
  for (const m of members) {
    if (normalizeName(m.fullName) === normalized) {
      return m;
    }
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai URLs de imagens hospedadas no Circle (app.circle.so) do HTML.
 * Usado pra migrar pro nosso Storage antes da Circle desligar.
 */
export function extractCircleImageUrls(html: string): string[] {
  if (!html) return [];
  const urls = new Set<string>();
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (src.includes("circle.so") || src.includes("circle.com")) {
      urls.add(src);
    }
  }
  return Array.from(urls);
}
