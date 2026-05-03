"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createShortLinkAction } from "@/app/(admin)/admin/links/actions";

export function ShortLinkCreateForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.set("url", url.trim());
      const res = await createShortLinkAction(null, fd);
      if (res.ok && res.data) {
        toast.success(`Link criado: /l/${res.data.slug}`);
        setUrl("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-npb-border bg-npb-bg2 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
          URL longa
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://wa.me/5527998933223?text=..."
          required
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !url.trim()}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Criar link curto
      </button>
    </form>
  );
}
