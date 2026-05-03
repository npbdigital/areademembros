"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import {
  rateLessonAction,
  saveNoteAction,
} from "@/app/(student)/lessons/actions";

type Tab = "description" | "attachments" | "notes" | "rating";

export interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number | null;
}

interface Props {
  lessonId: string;
  descriptionHtml: string | null;
  attachments: AttachmentItem[];
  initialNote: string;
  initialRating: number | null;
  initialComment: string | null;
}

export function LessonTabs({
  lessonId,
  descriptionHtml,
  attachments,
  initialNote,
  initialRating,
  initialComment,
}: Props) {
  const [tab, setTab] = useState<Tab>("description");
  const hasAttachments = attachments.length > 0;

  return (
    <div className="min-w-0">
      {/* Tabs scrolláveis horizontal no mobile pra não quebrar layout. */}
      <div className="-mx-2 flex gap-1 overflow-x-auto border-b border-npb-border px-2 npb-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabButton active={tab === "description"} onClick={() => setTab("description")}>
          Descrição
        </TabButton>
        {hasAttachments && (
          <TabButton
            active={tab === "attachments"}
            onClick={() => setTab("attachments")}
          >
            Anexos
            <span className="ml-1.5 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold text-npb-text-muted">
              {attachments.length}
            </span>
          </TabButton>
        )}
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
          Anotações
        </TabButton>
        <TabButton active={tab === "rating"} onClick={() => setTab("rating")}>
          Avaliação
        </TabButton>
      </div>

      <div className="pt-6">
        {tab === "description" && (
          <DescriptionTab descriptionHtml={descriptionHtml} />
        )}
        {tab === "attachments" && (
          <AttachmentsTab attachments={attachments} />
        )}
        {tab === "notes" && (
          <NotesTab lessonId={lessonId} initialNote={initialNote} />
        )}
        {tab === "rating" && (
          <RatingTab
            lessonId={lessonId}
            initialRating={initialRating}
            initialComment={initialComment}
          />
        )}
      </div>
    </div>
  );
}

function AttachmentsTab({ attachments }: { attachments: AttachmentItem[] }) {
  if (attachments.length === 0) {
    return (
      <p className="text-sm text-npb-text-muted">
        Esta aula não tem anexos.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map((a) => {
        const sizeLabel = a.fileSizeBytes
          ? a.fileSizeBytes < 1024 * 1024
            ? `${Math.max(1, Math.round(a.fileSizeBytes / 1024))} KB`
            : `${(a.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : null;

        return (
          <li key={a.id}>
            <a
              href={a.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={a.fileName}
              className="group flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg3 p-3 transition hover:border-npb-gold-dim hover:bg-npb-bg4"
            >
              <FileText className="h-5 w-5 flex-shrink-0 text-npb-gold" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-npb-text group-hover:text-npb-gold">
                  {a.fileName}
                </p>
                {sizeLabel && (
                  <p className="text-[10px] uppercase tracking-wide text-npb-text-muted">
                    {sizeLabel}
                  </p>
                )}
              </div>
              <Download className="h-4 w-4 flex-shrink-0 text-npb-text-muted transition group-hover:text-npb-gold" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-b-2 border-npb-gold text-npb-text"
          : "border-b-2 border-transparent text-npb-text-muted hover:text-npb-text"
      }`}
    >
      {children}
    </button>
  );
}

function DescriptionTab({ descriptionHtml }: { descriptionHtml: string | null }) {
  if (!descriptionHtml || descriptionHtml.trim().length === 0) {
    return (
      <p className="text-sm text-npb-text-muted">
        Sem descrição para essa aula.
      </p>
    );
  }
  return (
    <div
      className="prose prose-invert max-w-none text-sm text-npb-text [overflow-wrap:anywhere] [&_a]:break-all [&_pre]:overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
    />
  );
}

function NotesTab({
  lessonId,
  initialNote,
}: {
  lessonId: string;
  initialNote: string;
}) {
  const [content, setContent] = useState(initialNote);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await saveNoteAction(lessonId, content);
      if (res.ok) toast.success("Anotação salva.");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        placeholder="Escreva suas anotações sobre essa aula..."
        className="w-full rounded-lg border border-npb-border bg-npb-bg2 px-4 py-3 text-sm text-npb-text placeholder:text-npb-text-muted focus:border-npb-gold focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar anotação"}
        </button>
      </div>
    </div>
  );
}

function RatingTab({
  lessonId,
  initialRating,
  initialComment,
}: {
  lessonId: string;
  initialRating: number | null;
  initialComment: string | null;
}) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (rating < 1 || rating > 5) {
      toast.error("Selecione de 1 a 5 estrelas.");
      return;
    }
    startTransition(async () => {
      const res = await rateLessonAction(lessonId, rating, comment);
      if (res.ok) toast.success("Avaliação enviada!");
      else toast.error(res.error ?? "Erro ao enviar.");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-npb-text">Sua nota:</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="rounded p-1 transition hover:scale-110"
                aria-label={`${n} estrelas`}
              >
                <Star
                  className={`h-7 w-7 ${
                    filled
                      ? "fill-npb-gold text-npb-gold"
                      : "text-npb-text-muted"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-npb-text">
          Comentário (opcional):
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="O que achou dessa aula?"
          className="w-full rounded-lg border border-npb-border bg-npb-bg2 px-4 py-3 text-sm text-npb-text placeholder:text-npb-text-muted focus:border-npb-gold focus:outline-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || rating === 0}
          className="rounded-lg bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? "Enviando..." : initialRating ? "Atualizar avaliação" : "Enviar avaliação"}
        </button>
      </div>
    </div>
  );
}
