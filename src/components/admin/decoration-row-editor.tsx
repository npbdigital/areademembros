"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  toggleDecorationActiveAction,
  updateDecorationNameAction,
  uploadDecorationImageAction,
} from "@/app/(admin)/admin/decorations/actions";

interface Props {
  decoration: {
    id: string;
    code: string;
    name: string;
    image_url: string | null;
    required_sales: number;
    sort_order: number;
    is_active: boolean;
  };
  equippedCount: number;
}

export function DecorationRowEditor({ decoration, equippedCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(decoration.name);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadDecorationImageAction(decoration.id, fd);
      if (res.ok) {
        toast.success("Imagem atualizada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha no upload.");
      }
    });
  }

  function handleSaveName() {
    startTransition(async () => {
      const res = await updateDecorationNameAction(decoration.id, name);
      if (res.ok) {
        setEditingName(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await toggleDecorationActiveAction(
        decoration.id,
        !decoration.is_active,
      );
      if (res.ok) {
        toast.success(decoration.is_active ? "Ocultada." : "Reativada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border border-npb-border bg-npb-bg2 p-4">
      {/* Preview */}
      <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-npb-bg3">
        {decoration.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={decoration.image_url}
            alt={decoration.name}
            className="h-20 w-20 object-contain"
          />
        ) : (
          <span className="text-[10px] text-npb-text-muted">sem imagem</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {editingName ? (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1 text-sm font-bold text-npb-text outline-none focus:border-npb-gold-dim"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={pending}
                className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setName(decoration.name);
                }}
                className="text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-npb-text">
                {decoration.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingName(true)}
                title="Renomear"
                className="rounded p-0.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-npb-text-muted">
          Code: <code className="text-npb-gold">{decoration.code}</code>
          <span className="px-2">·</span>
          Marco:{" "}
          <strong className="text-npb-text">
            {decoration.required_sales}{" "}
            {decoration.required_sales === 1 ? "venda paga" : "vendas pagas"}
          </strong>
          <span className="px-2">·</span>
          Equipada por <strong className="text-npb-text">{equippedCount}</strong>{" "}
          aluno{equippedCount === 1 ? "" : "s"}
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {decoration.image_url ? "Trocar imagem" : "Subir imagem"}
        </button>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={pending}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            decoration.is_active
              ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
              : "border-red-500/40 bg-red-500/5 text-red-400 hover:bg-red-500/15"
          }`}
        >
          {decoration.is_active ? "Ativa" : "Desativada"}
        </button>
      </div>
    </li>
  );
}
