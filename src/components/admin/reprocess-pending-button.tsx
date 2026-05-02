"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { reprocessAllPendingAction } from "@/app/(admin)/admin/affiliates/actions";

interface Props {
  pendingCount: number;
}

export function ReprocessPendingButton({ pendingCount }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    if (pending || pendingCount === 0) return;
    startTransition(async () => {
      const res = await reprocessAllPendingAction();
      if (res.ok && res.data) {
        toast.success(`${res.data.count} raws reprocessados.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (pendingCount === 0) return null;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      Reprocessar {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
    </button>
  );
}
