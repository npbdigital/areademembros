/**
 * Helpers pra lidar com URLs do Supabase Storage.
 *
 * Formato das URLs publicas:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */

/**
 * Extrai o path interno do bucket a partir de uma URL publica.
 * Retorna null se a URL nao for do bucket informado (ex: avatar legado
 * hospedado em outro lugar).
 */
export function extractBucketPath(
  url: string | null | undefined,
  bucket: string,
): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
