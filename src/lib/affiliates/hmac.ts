import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida a assinatura HMAC-SHA1 da Kiwify.
 *
 * A Kiwify envia ?signature=<hex> na query string. O valor é HMAC-SHA1 do
 * body cru (texto JSON exato) usando o token cadastrado como secret.
 *
 * Retorna true se assinatura bate. Em ambientes onde o token ou signature
 * não estão presentes, retorna `null` (chamador decide se aceita ou rejeita).
 */
export function verifyKiwifySignature(params: {
  rawBody: string;
  signature: string | null;
  secret: string;
}): boolean | null {
  if (!params.signature || !params.secret) return null;

  const expected = createHmac("sha1", params.secret)
    .update(params.rawBody, "utf8")
    .digest("hex");

  // Comparação constant-time
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(params.signature, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
