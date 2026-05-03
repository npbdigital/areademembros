"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Props {
  name: string;
  userId: string;
  defaultValue?: string | null;
  fallbackText: string;
  /** URL do PNG da decoração equipada — desenha em volta do avatar. */
  decorationUrl?: string | null;
}

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const ACCEPT_LIST = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;
const BUCKET = "avatars";

export function AvatarUpload({
  name,
  userId,
  defaultValue,
  fallbackText,
  decorationUrl,
}: Props) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPT_LIST.includes(file.type)) {
      toast.error("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `Arquivo maior que 3MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      );
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });

      if (uploadErr) {
        const msg = uploadErr.message.includes("policy")
          ? "Sem permissão pra subir."
          : uploadErr.message;
        toast.error(msg);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setUrl(urlData.publicUrl);
      toast.success("Avatar atualizado. Não esqueça de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao subir.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 flex-shrink-0">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-npb-bg3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xl font-bold text-npb-gold">
              {fallbackText}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        {decorationUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={decorationUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute z-10 select-none"
            style={{
              width: 112,
              height: 112,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              objectFit: "contain",
            }}
          />
        )}
      </div>

      <input type="hidden" name={name} value={url} />

      <div className="flex flex-col gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text transition hover:border-npb-gold ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <input
            type="file"
            accept={ACCEPT}
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Upload className="h-3.5 w-3.5" />
          {url ? "Trocar foto" : "Enviar foto"}
        </label>
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="inline-flex items-center gap-1 text-xs text-npb-text-muted transition hover:text-red-400"
          >
            <X className="h-3 w-3" />
            Remover
          </button>
        )}
        <p className="text-[10px] text-npb-text-muted">
          JPG, PNG ou WebP até 3MB.
        </p>
      </div>
    </div>
  );
}
