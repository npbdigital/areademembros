"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteShortLinkAction } from "@/app/(admin)/admin/links/actions";

interface Row {
  slug: string;
  target_url: string;
  click_count: number;
  created_at: string;
  created_by: string | null;
}

export function ShortLinksTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState<string>("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Origin do browser pra montar URL completa pra copiar (ex: https://...)
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function handleCopy(slug: string) {
    const url = `${origin || ""}/l/${slug}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Copiado!"),
      () => toast.error("Falhou copiar."),
    );
  }

  function handleDelete(slug: string) {
    if (!confirm(`Apagar /l/${slug}? Quem clicar vai cair no dashboard.`)) {
      return;
    }
    setPendingSlug(slug);
    startTransition(async () => {
      const res = await deleteShortLinkAction(slug);
      setPendingSlug(null);
      if (res.ok) {
        toast.success("Apagado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2 p-8 text-center text-sm text-npb-text-muted">
        Nenhum link encurtado ainda. Use o formulário acima ou edite uma
        descrição de aula com URL longa — o sistema encurta sozinho ao salvar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2">
      <table className="w-full text-sm">
        <thead className="bg-npb-bg3 text-xs uppercase tracking-wider text-npb-text-muted">
          <tr>
            <th className="px-4 py-2 text-left">Slug</th>
            <th className="px-4 py-2 text-left">Destino</th>
            <th className="px-4 py-2 text-right">Cliques</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.slug}
              className="border-t border-npb-border align-middle"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/l/${r.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-npb-gold hover:underline"
                >
                  /l/{r.slug}
                </Link>
              </td>
              <td className="max-w-md px-4 py-3">
                <span
                  className="block truncate text-npb-text-muted"
                  title={r.target_url}
                >
                  {r.target_url}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-npb-text">
                {r.click_count}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(r.slug)}
                    title="Copiar URL"
                    className="rounded p-1.5 text-npb-text-muted transition hover:bg-npb-bg3 hover:text-npb-text"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={r.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir destino"
                    className="rounded p-1.5 text-npb-text-muted transition hover:bg-npb-bg3 hover:text-npb-text"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.slug)}
                    disabled={pendingSlug === r.slug}
                    title="Apagar"
                    className="rounded p-1.5 text-npb-text-muted transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                  >
                    {pendingSlug === r.slug ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
