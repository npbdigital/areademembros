/**
 * Compressao client-side de imagens via canvas nativo.
 * Sem deps externas — usa Image + Canvas API que existe em todos os
 * browsers modernos.
 *
 * Uso tipico:
 *   const small = await compressImage(file, { maxSize: 400, quality: 0.85 });
 *   await supabase.storage.from(bucket).upload(path, small);
 */

export interface CompressOptions {
  /** Lado maior maximo em pixels. Mantem aspect ratio. */
  maxSize: number;
  /** Qualidade JPEG entre 0 e 1. */
  quality: number;
  /** Default 'image/jpeg'. PNG so se precisar transparencia. */
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
}

export async function compressImage(
  file: File,
  opts: CompressOptions,
): Promise<File> {
  const mimeType = opts.mimeType ?? "image/jpeg";

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > opts.maxSize || height > opts.maxSize) {
    const scale = opts.maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context indisponivel.");

  // JPEG nao tem alpha — pinta fundo branco antes pra evitar artefatos
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, opts.quality),
  );
  if (!blob) throw new Error("Falha ao gerar blob comprimido.");

  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: mimeType });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao decodificar imagem."));
    img.src = src;
  });
}
