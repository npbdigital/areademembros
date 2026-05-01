"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { addLessonAttachmentAction } from "@/app/(admin)/admin/courses/actions";

interface Props {
  lessonId: string;
  moduleId: string;
  courseId: string;
}

const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = "lesson-attachments";

export function AttachmentUpload({ lessonId, moduleId, courseId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(
        `Arquivo maior que 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      );
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${lessonId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        const msg = uploadError.message.includes("policy")
          ? "Sem permissão pra subir (admin only)."
          : uploadError.message;
        toast.error(msg);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      startTransition(async () => {
        const res = await addLessonAttachmentAction(
          lessonId,
          moduleId,
          courseId,
          {
            fileName: file.name,
            fileUrl,
            fileSizeBytes: file.size,
          },
        );
        if (res.ok) {
          toast.success("Anexo adicionado.");
          if (inputRef.current) inputRef.current.value = "";
        } else {
          toast.error(res.error ?? "Erro ao salvar anexo.");
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao fazer upload.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 px-4 py-3 text-sm font-medium text-npb-text transition hover:border-npb-gold-dim ${
        busy ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando...
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" />
          Adicionar anexo (até 50MB)
        </>
      )}
    </label>
  );
}
