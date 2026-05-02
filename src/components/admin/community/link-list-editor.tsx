"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import {
  type ActionResult,
  createSidebarLinkAction,
  deleteSidebarLinkAction,
} from "@/app/(admin)/admin/community/actions";

interface Item {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  position: number;
  open_in_new_tab: boolean;
  is_active: boolean;
}

export function LinkListEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pendingDel, startDel] = useTransition();

  function handleDelete(id: string, label: string) {
    if (!confirm(`Excluir o atalho "${label}"?`)) return;
    startDel(async () => {
      const res = await deleteSidebarLinkAction(id);
      if (res.ok) {
        toast.success("Atalho excluído.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3 py-2 text-sm font-semibold text-black hover:bg-npb-gold-light"
        >
          {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {creating ? "Cancelar" : "Novo atalho"}
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <CreateLinkForm onDone={() => setCreating(false)} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
          Nenhum atalho ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-4"
            >
              <span className="text-2xl leading-none">{l.icon ?? "🔗"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-npb-text">
                    {l.label}
                  </span>
                  {l.open_in_new_tab && (
                    <span className="text-[10px] text-npb-text-muted">
                      abre em nova aba
                    </span>
                  )}
                </div>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-npb-text-muted hover:text-npb-gold"
                >
                  {l.url}
                </a>
              </div>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
                title="Abrir"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(l.id, l.label)}
                disabled={pendingDel}
                className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateLinkForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createSidebarLinkAction,
    null,
  );

  if (state?.ok) {
    setTimeout(() => {
      onDone();
      router.refresh();
    }, 0);
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr]">
        <div>
          <label className="mb-1 block text-xs text-npb-text-muted">
            Ícone
          </label>
          <input
            name="icon"
            defaultValue="🔗"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-center text-base outline-none focus:border-npb-gold-dim"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-npb-text-muted">
            Label *
          </label>
          <input
            name="label"
            required
            placeholder="Ex: Aulas, WhatsApp, Suporte"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-npb-text-muted">URL *</label>
        <input
          name="url"
          type="url"
          required
          placeholder="https://..."
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-npb-text">
        <input
          type="checkbox"
          name="open_in_new_tab"
          defaultChecked
          className="h-4 w-4 accent-npb-gold"
        />
        Abrir em nova aba
      </label>
      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Criando…">Criar atalho</SubmitButton>
      </div>
    </form>
  );
}
