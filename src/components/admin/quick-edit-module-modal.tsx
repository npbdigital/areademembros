"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoverUpload } from "@/components/admin/cover-upload";
import { quickUpdateModuleAction } from "@/app/(admin)/admin/courses/actions";

interface Props {
  moduleId: string;
  courseId: string;
  initialTitle: string;
  initialCoverUrl: string | null;
}

export function QuickEditModuleButton({
  moduleId,
  courseId,
  initialTitle,
  initialCoverUrl,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title="Editar rápido"
        aria-label="Editar nome e capa"
        className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-gold/10 hover:text-npb-gold"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar módulo"
        widthClassName="max-w-lg"
      >
        <QuickEditForm
          moduleId={moduleId}
          courseId={courseId}
          initialTitle={initialTitle}
          initialCoverUrl={initialCoverUrl}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function QuickEditForm({
  moduleId,
  courseId,
  initialTitle,
  initialCoverUrl,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [coverUrl, setCoverUrl] = useState<string>(initialCoverUrl ?? "");
  const [pending, startTransition] = useTransition();

  // Reset quando abrir com outro módulo
  useEffect(() => {
    setTitle(initialTitle);
    setCoverUrl(initialCoverUrl ?? "");
  }, [initialTitle, initialCoverUrl, moduleId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    startTransition(async () => {
      const res = await quickUpdateModuleAction(moduleId, courseId, {
        title: title.trim(),
        cover_url: coverUrl.trim() || null,
      });
      if (res.ok) {
        toast.success("Módulo atualizado.");
        // Força a página atual a re-buscar os server components — sem isso
        // a UI fica com o valor antigo até o usuário recarregar.
        router.refresh();
        onDone();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor={`qedit-title-${moduleId}`} className="text-npb-text">
          Título <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id={`qedit-title-${moduleId}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-npb-text">Capa</Label>
        <CoverUpload
          name={`qedit-cover-${moduleId}`}
          defaultValue={coverUrl}
          recommendedWidth={300}
          recommendedHeight={420}
          label="Capa do módulo"
        />
        {/* CoverUpload escreve o valor num input hidden com `name`. Como esse
            form submete via JS, sincronizamos via DOM no submit. */}
        <CoverUrlSync
          name={`qedit-cover-${moduleId}`}
          onChange={(v) => setCoverUrl(v)}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-npb-border pt-4">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-npb-border bg-npb-bg3 px-4 py-2 text-sm font-medium text-npb-text-muted transition-colors hover:bg-npb-bg4 hover:text-npb-text"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  );
}

/**
 * Helper que observa mudanças no input hidden criado pelo CoverUpload
 * (que sincroniza com o estado do upload). Espelha pro state do form pai.
 */
function CoverUrlSync({
  name,
  onChange,
}: {
  name: string;
  onChange: (v: string) => void;
}) {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      `input[type="hidden"][name="${name}"]`,
    );
    if (!input) return;
    const observer = new MutationObserver(() => onChange(input.value));
    observer.observe(input, { attributes: true, attributeFilter: ["value"] });
    // Adicionalmente: poll a cada 250ms (alguns frameworks setam value via JS sem mutation observer)
    const id = setInterval(() => onChange(input.value), 250);
    return () => {
      observer.disconnect();
      clearInterval(id);
    };
  }, [name, onChange]);
  return null;
}
