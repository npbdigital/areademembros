"use client";

import { useState } from "react";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CoverUploadProps {
  name: string;
  defaultValue?: string | null;
  bucket?: string;
  recommendedWidth?: number;
  recommendedHeight?: number;
  label?: string;
}

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const ACCEPT_LIST = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload de capa direto pro Supabase Storage (bucket público).
 *
 * Usa o cliente Supabase do browser (anon + sessão do user) — RLS no
 * bucket exige `membros.is_admin()` pra escrita. Não passa por nenhum
 * server action, então não tem limite de bodySizeLimit do Next.js.
 *
 * Sincroniza a URL pública num <input type="hidden" name={name}> pra
 * que o form pai serialize via Server Action normalmente.
 */
export function CoverUpload({
  name,
  defaultValue,
  bucket = "course-covers",
  recommendedWidth = 300,
  recommendedHeight = 420,
  label = "Capa",
}: CoverUploadProps) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setWarning(null);

    if (!ACCEPT_LIST.includes(file.type)) {
      setError(
        `Formato não aceito (${file.type || "desconhecido"}). Use JPG, PNG ou WebP.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Imagem maior que 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB). Otimize antes de subir.`,
      );
      return;
    }

    // Aviso de proporção (não bloqueia)
    try {
      const dims = await getImageDimensions(file);
      const targetRatio = recommendedWidth / recommendedHeight;
      const actualRatio = dims.width / dims.height;
      const tolerance = 0.05;
      if (Math.abs(targetRatio - actualRatio) > tolerance) {
        setWarning(
          `Imagem é ${dims.width}×${dims.height}px (proporção ${actualRatio.toFixed(2)}:1). Recomendado: ${recommendedWidth}×${recommendedHeight}px (proporção ${targetRatio.toFixed(2)}:1) — vai aparecer cortada.`,
        );
      }
    } catch {
      // ignora erro de leitura de dimensões — o upload continua
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(urlData.publicUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao fazer upload.";
      setError(
        msg.includes("policy")
          ? "Sem permissão pra subir (a política exige role admin). Confere se você está logado como admin."
          : msg,
      );
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setUrl("");
    setError(null);
    setWarning(null);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Preview */}
        <div
          className={cn(
            "relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-md border bg-npb-bg3",
            url ? "border-npb-gold-dim" : "border-dashed border-npb-border",
          )}
        >
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={clear}
                title="Remover capa"
                aria-label="Remover capa"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-npb-text-muted">
              <ImageIcon className="h-6 w-6 opacity-50" />
              <span className="text-[10px] uppercase tracking-wider">
                {recommendedWidth}×{recommendedHeight}
              </span>
            </div>
          )}
        </div>

        {/* Botão de upload */}
        <div className="flex flex-1 flex-col">
          <label
            className={cn(
              "inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text transition-colors",
              uploading
                ? "opacity-60"
                : "hover:border-npb-gold-dim hover:text-npb-gold",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                {url ? "Trocar capa" : "Selecionar imagem"}
              </>
            )}
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                // limpa o input pra permitir re-selecionar o mesmo arquivo
                e.target.value = "";
              }}
            />
          </label>

          <p className="mt-1.5 text-xs text-npb-text-muted">
            Recomendado: <strong className="text-npb-text">{recommendedWidth}×{recommendedHeight}px</strong>{" "}
            (proporção 5:7). JPG, PNG ou WebP até 5MB.
          </p>

          {error && (
            <p className="mt-1.5 text-xs text-red-400">{error}</p>
          )}
          {warning && (
            <p className="mt-1.5 text-xs text-yellow-400">{warning}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
