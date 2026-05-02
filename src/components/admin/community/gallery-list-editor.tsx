"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import {
  type ActionResult,
  createGalleryAction,
  deleteGalleryAction,
  updateGalleryAction,
} from "@/app/(admin)/admin/community/actions";

interface Item {
  id: string;
  title: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
  position: number;
  is_active: boolean;
}

export function GalleryListEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDel, startDel] = useTransition();

  function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir o espaço "${title}"? Posts dele serão deletados.`))
      return;
    startDel(async () => {
      const res = await deleteGalleryAction(id);
      if (res.ok) {
        toast.success("Espaço excluído.");
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
          {creating ? "Cancelar" : "Novo espaço"}
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <CreateGalleryForm onDone={() => setCreating(false)} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
          Nenhum espaço criado ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
            >
              {editingId === g.id ? (
                <EditGalleryForm
                  item={g}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{g.icon ?? "💬"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-npb-text">
                        {g.title}
                      </span>
                      <span className="text-xs text-npb-text-muted">
                        /{g.slug}
                      </span>
                      {!g.is_active && (
                        <span className="rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-npb-text-muted">
                          Oculto
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <p className="mt-0.5 text-xs text-npb-text-muted">
                        {g.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(g.id)}
                    title="Editar"
                    className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(g.id, g.title)}
                    disabled={pendingDel}
                    title="Excluir"
                    className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateGalleryForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createGalleryAction,
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
            defaultValue="💬"
            placeholder="💬"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-center text-base outline-none focus:border-npb-gold-dim"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-npb-text-muted">
            Nome do espaço *
          </label>
          <input
            name="title"
            required
            placeholder="Ex: Geral, Dúvidas, Comece Aqui"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-npb-text-muted">
          Slug (URL) — opcional
        </label>
        <input
          name="slug"
          placeholder="auto-gerado a partir do nome"
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-npb-text-muted">
          Descrição — opcional
        </label>
        <textarea
          name="description"
          rows={2}
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Criando…">Criar espaço</SubmitButton>
      </div>
    </form>
  );
}

function EditGalleryForm({
  item,
  onDone,
}: {
  item: Item;
  onDone: () => void;
}) {
  const router = useRouter();
  const action = updateGalleryAction.bind(null, item.id);
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    action,
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
        <input
          name="icon"
          defaultValue={item.icon ?? "💬"}
          className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-center text-base outline-none focus:border-npb-gold-dim"
        />
        <input
          name="title"
          defaultValue={item.title}
          required
          className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      <input
        name="slug"
        defaultValue={item.slug ?? ""}
        placeholder="slug"
        className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <textarea
        name="description"
        defaultValue={item.description ?? ""}
        rows={2}
        className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <label className="inline-flex items-center gap-2 text-sm text-npb-text">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={item.is_active}
          className="h-4 w-4 accent-npb-gold"
        />
        Ativo (visível na sidebar)
      </label>
      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm text-npb-text-muted hover:text-npb-text"
        >
          Cancelar
        </button>
        <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
      </div>
    </form>
  );
}
