"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug } from "lucide-react";

export function DisconnectButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    if (pending) return;
    if (
      !window.confirm(
        "Desconectar o canal do YouTube? Você precisará autorizar de novo pra buscar vídeos.",
      )
    )
      return;

    startTransition(async () => {
      const res = await fetch("/api/youtube/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Erro ao desconectar: ${data.error ?? res.statusText}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm text-npb-text transition-colors hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plug className="h-3.5 w-3.5" />
      )}
      {pending ? "Desconectando..." : "Desconectar"}
    </button>
  );
}
