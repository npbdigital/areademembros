/**
 * Helpers compartilhados entre /api/admin/import/preview e /run.
 *
 * Formato do CSV esperado (export da plataforma antiga):
 *   Id, Nome completo, Email, Contador de logins, Login atual em,
 *   Última vez visto, Criado em, CPF/CNPJ, Telefone
 *
 * Aceita BOM (UTF-8 com prefixo) e tanto vírgula quanto ponto-e-virgula.
 */

export interface ParsedRow {
  /** Numero da linha original (1-indexed, ja descontando o header) */
  rowNum: number;
  email: string;
  fullName: string | null;
  cpf: string | null;
  phone: string | null;
  /** Data ISO em UTC. Convertida do formato "2026-05-07 10:55:06" (BRT). */
  enrolledAtIso: string | null;
  /** Erros bloqueantes — linha nao deve ser processada. */
  errors: string[];
  /** Avisos nao bloqueantes (faltou nome, faltou CPF, etc). */
  warnings: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Erros de cabecalho/estrutura. Se preenchido, nao processa nenhuma linha. */
  fatalErrors: string[];
}

/**
 * Faz o parse do CSV em texto pra linhas tipadas. Tolerante:
 * aceita BOM, separador vírgula ou ponto-e-vírgula, colunas em qualquer
 * ordem desde que os nomes batam.
 */
export function parseImportCsv(csvText: string): ParseResult {
  const fatalErrors: string[] = [];
  const rows: ParsedRow[] = [];

  // Remove BOM (﻿) se presente
  const text = csvText.replace(/^﻿/, "").trim();
  if (!text) {
    return { rows: [], fatalErrors: ["Arquivo vazio."] };
  }

  // Detecta separador (vírgula ou ponto-e-vírgula) pelo header
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.split(";").length > firstLine.split(",").length
    ? ";"
    : ",";

  const lines = splitCsvLines(text);
  if (lines.length < 2) {
    return { rows: [], fatalErrors: ["Arquivo precisa ter cabeçalho + ao menos 1 linha."] };
  }

  const header = parseCsvLine(lines[0], sep).map((h) =>
    normalizeHeader(h),
  );

  // Mapeia indices das colunas que nos interessam (case-insensitive,
  // ignora acentos)
  const idx = {
    email: findCol(header, ["email"]),
    fullName: findCol(header, ["nome completo", "nome", "full name", "fullname"]),
    cpf: findCol(header, ["cpf cnpj", "cpf/cnpj", "cpf", "cnpj"]),
    phone: findCol(header, ["telefone", "phone", "celular"]),
    createdAt: findCol(header, ["criado em", "created at", "data de cadastro"]),
  };

  if (idx.email < 0) {
    fatalErrors.push(`Coluna "Email" não encontrada no cabeçalho. Encontradas: ${header.join(", ")}`);
  }
  if (idx.createdAt < 0) {
    fatalErrors.push(`Coluna "Criado em" não encontrada no cabeçalho. Necessária pra calcular vencimento.`);
  }
  if (fatalErrors.length > 0) {
    return { rows: [], fatalErrors };
  }

  // Processa cada linha
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const cols = parseCsvLine(raw, sep);
    const errors: string[] = [];
    const warnings: string[] = [];

    const email = (cols[idx.email] ?? "").trim().toLowerCase();
    if (!email) {
      errors.push("Email vazio.");
    } else if (!isValidEmail(email)) {
      errors.push(`Email inválido: ${email}`);
    }

    const fullName = idx.fullName >= 0 ? (cols[idx.fullName] ?? "").trim() : "";
    if (!fullName) warnings.push("Sem nome — aluno entra com aviso de completar cadastro.");

    const cpf = idx.cpf >= 0 ? (cols[idx.cpf] ?? "").trim() : "";
    const phone = idx.phone >= 0 ? (cols[idx.phone] ?? "").trim() : "";
    const createdAtRaw = (cols[idx.createdAt] ?? "").trim();

    let enrolledAtIso: string | null = null;
    if (!createdAtRaw) {
      errors.push("'Criado em' vazio — sem data nao da pra calcular vencimento.");
    } else {
      enrolledAtIso = parseBrtDate(createdAtRaw);
      if (!enrolledAtIso) {
        errors.push(`Data inválida em 'Criado em': "${createdAtRaw}". Esperado: 2026-05-07 10:55:06.`);
      }
    }

    rows.push({
      rowNum: i,
      email,
      fullName: fullName || null,
      cpf: cpf || null,
      phone: phone || null,
      enrolledAtIso,
      errors,
      warnings,
    });
  }

  return { rows, fatalErrors };
}

/**
 * Resumo agregado pra mostrar no dry-run. Conta quantos vão criar,
 * atualizar, pular, falhar.
 */
export interface ImportPlan {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  emailsDuplicatedInCsv: number;
}

export function summarizeImport(rows: ParsedRow[]): ImportPlan {
  const seen = new Set<string>();
  let emailsDuplicatedInCsv = 0;
  let invalid = 0;

  for (const r of rows) {
    if (r.errors.length > 0) {
      invalid++;
      continue;
    }
    if (seen.has(r.email)) {
      emailsDuplicatedInCsv++;
    } else {
      seen.add(r.email);
    }
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - invalid,
    invalidRows: invalid,
    emailsDuplicatedInCsv,
  };
}

// ============================================================================
// Helpers internos
// ============================================================================

function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCol(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = header.indexOf(normalizeHeader(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Quebra o CSV em linhas respeitando quebras DENTRO de campos com aspas.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // Lida com aspas escapadas ""
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

/**
 * Parse de uma linha CSV respeitando aspas e separador escolhido.
 */
function parseCsvLine(line: string, sep: string): string[] {
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
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Converte "2026-05-07 10:55:06" (BRT) ou "2026-05-07T10:55:06" pra ISO UTC.
 * Plataforma antiga exporta horários em BRT (UTC-3). Soma 3h pra normalizar.
 */
function parseBrtDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Aceita "YYYY-MM-DD HH:MM:SS" ou "YYYY-MM-DDTHH:MM:SS"
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    // Trata como BRT, soma 3h pra UTC
    const dt = new Date(
      `${y}-${mo}-${d}T${h}:${mi}:${se}.000Z`,
    );
    if (Number.isNaN(dt.getTime())) return null;
    dt.setUTCHours(dt.getUTCHours() + 3);
    return dt.toISOString();
  }

  // Aceita só "YYYY-MM-DD" (assume meia-noite BRT = 03:00 UTC)
  const m2 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2]}-${m2[3]}T03:00:00.000Z`;
  }

  // Fallback: tenta o construtor
  const dt = new Date(trimmed);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString();

  return null;
}
