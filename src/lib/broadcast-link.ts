/**
 * Substituicao de placeholders {{firstName}} {{email}} etc nos links
 * de broadcast antes do redirect.
 *
 * Fluxo:
 *   1. Admin envia broadcast com link tipo
 *      https://event.webinarjam.com/...?email={{email}}&first_name={{firstName}}
 *   2. sendBroadcast detecta placeholders -> grava em push_broadcasts.link_template,
 *      reescreve push_broadcasts.link pra /r/{broadcastId}
 *   3. Quando user clica no link nosso, /r/[id] route handler carrega
 *      o template, chama resolveBroadcastLink com os dados do user, faz
 *      redirect 302 pro link final.
 */

export interface BroadcastUserVars {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
}

const SUPPORTED_VARS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "phoneNumber",
  "cpf",
] as const;

export type SupportedVar = (typeof SUPPORTED_VARS)[number];

/**
 * Detecta se uma URL tem placeholders {{xxx}}.
 */
export function linkHasPlaceholders(link: string | null | undefined): boolean {
  if (!link) return false;
  return /\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/.test(link);
}

/**
 * Lista os placeholders presentes na URL — usada pra avisar admin se
 * ele usou alguma variavel que nao suportamos.
 */
export function extractPlaceholders(link: string): string[] {
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(link)) !== null) {
    seen.add(m[1]);
  }
  return Array.from(seen);
}

/**
 * Verifica se ha placeholders nao suportados na URL.
 * Retorna a lista dos invalidos (vazio = ok).
 */
export function findUnsupportedPlaceholders(link: string): string[] {
  const supported = new Set<string>(SUPPORTED_VARS);
  return extractPlaceholders(link).filter((p) => !supported.has(p as SupportedVar));
}

/**
 * Resolve placeholders na URL com os dados do user. Sempre encodeURIComponent
 * o valor antes de substituir. Variaveis nao preenchidas viram string vazia.
 */
export function resolveBroadcastLink(
  template: string,
  vars: BroadcastUserVars,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => {
      let value: string;
      switch (name) {
        case "firstName":
          value = vars.firstName;
          break;
        case "lastName":
          value = vars.lastName;
          break;
        case "fullName":
          value = vars.fullName;
          break;
        case "email":
          value = vars.email;
          break;
        case "phone":
        case "phoneNumber":
          value = vars.phone;
          break;
        case "cpf":
          value = vars.cpf;
          break;
        default:
          // Placeholder nao reconhecido -> string vazia
          value = "";
      }
      return encodeURIComponent(value);
    },
  );
}

/**
 * Constroi o BroadcastUserVars a partir do row do user (membros.users
 * + auth.users.email). full_name eh splittado por espaco; firstName eh
 * o primeiro pedaco, lastName eh o ultimo (mesmo se for o mesmo pedaco).
 * Telefone vai sem mascara — so digitos.
 */
export function buildUserVars(input: {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  cpf: string | null;
}): BroadcastUserVars {
  const fullName = (input.fullName ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

  // Phone: tira tudo que nao for digito (mascaras como (11) 9...)
  const phoneDigits = (input.phone ?? "").replace(/\D/g, "");

  return {
    firstName,
    lastName,
    fullName,
    email: input.email ?? "",
    phone: phoneDigits,
    cpf: (input.cpf ?? "").replace(/\D/g, ""),
  };
}
