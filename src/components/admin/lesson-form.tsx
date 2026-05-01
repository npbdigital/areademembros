"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Film, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { DripFields, type ReleaseType } from "@/components/admin/drip-fields";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VideoPicker, type VideoPick } from "@/components/admin/video-picker";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

export interface LessonFormValues {
  title?: string | null;
  description_html?: string | null;
  youtube_video_id?: string | null;
  duration_seconds?: number | null;
  release_type?: string | null;
  release_days?: number | null;
  release_date?: string | null;
}

interface LessonFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: LessonFormValues;
  submitLabel: string;
  successMessage?: string;
}

export function LessonForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
}: LessonFormProps) {
  const [state, formAction] = useFormState(action, null);
  const init = initialValues ?? {};
  const [releaseType, setReleaseType] = useState<ReleaseType>(
    (init.release_type as ReleaseType) || "immediate",
  );

  const [video, setVideo] = useState<{
    videoId: string;
    title?: string;
    thumbnail?: string;
  } | null>(
    init.youtube_video_id
      ? {
          videoId: init.youtube_video_id,
          thumbnail: `https://i.ytimg.com/vi/${init.youtube_video_id}/mqdefault.jpg`,
        }
      : null,
  );
  const [duration, setDuration] = useState<number | "">(
    init.duration_seconds ?? "",
  );

  function handlePick(v: VideoPick) {
    setVideo({ videoId: v.videoId, title: v.title, thumbnail: v.thumbnail });
    setDuration(v.durationSeconds);
  }

  function clearVideo() {
    setVideo(null);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-npb-text">
          Título <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          defaultValue={init.title ?? ""}
          required
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      {/* Vídeo do YouTube */}
      <div className="space-y-2">
        <Label className="text-npb-text">Vídeo do YouTube</Label>
        <input
          type="hidden"
          name="youtube_video_id"
          value={video?.videoId ?? ""}
        />

        {video ? (
          <div className="flex gap-3 rounded-md border border-npb-gold-dim/50 bg-npb-bg3 p-3">
            <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded bg-black">
              {video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center min-w-0">
              {video.title && (
                <span className="line-clamp-2 text-sm font-medium text-npb-text">
                  {video.title}
                </span>
              )}
              <span className="font-mono text-xs text-npb-text-muted">
                {video.videoId}
              </span>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-1.5">
              <VideoPicker
                currentVideoId={video.videoId}
                onPick={handlePick}
              />
              <button
                type="button"
                onClick={clearVideo}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <X className="h-3 w-3" /> Remover
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-npb-border bg-npb-bg3 p-3">
            <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center rounded bg-npb-bg4 text-npb-text-muted">
              <Film className="h-5 w-5 opacity-50" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs text-npb-text-muted">
                Nenhum vídeo selecionado.
              </span>
              <VideoPicker onPick={handlePick} />
            </div>
          </div>
        )}

        <details className="text-xs text-npb-text-muted">
          <summary className="cursor-pointer hover:text-npb-text">
            Ou cole o ID manualmente
          </summary>
          <div className="mt-2 space-y-1">
            <Input
              type="text"
              placeholder="Ex: dQw4w9WgXcQ"
              defaultValue={video?.videoId ?? ""}
              onChange={(e) => {
                const id = e.target.value.trim();
                if (!id) {
                  setVideo(null);
                  return;
                }
                setVideo({
                  videoId: id,
                  thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
                });
              }}
              className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
            />
            <p>Apenas o ID (parte depois de <code>v=</code> na URL).</p>
          </div>
        </details>
      </div>

      {/* Duração */}
      <div className="space-y-1.5">
        <Label htmlFor="duration_seconds" className="text-npb-text">
          Duração (segundos)
        </Label>
        <Input
          id="duration_seconds"
          name="duration_seconds"
          type="number"
          min={0}
          value={duration}
          onChange={(e) =>
            setDuration(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="Ex: 754"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
        <p className="text-xs text-npb-text-muted">
          Auto-preenchido quando você seleciona via picker. Pode editar manual
          se quiser.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-npb-text">Descrição da aula</Label>
        <RichTextEditor
          name="description_html"
          defaultValue={init.description_html ?? ""}
        />
      </div>

      <DripFields
        value={releaseType}
        onChange={setReleaseType}
        defaultDays={init.release_days ?? null}
        defaultDate={init.release_date ?? null}
      />

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && successMessage && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
