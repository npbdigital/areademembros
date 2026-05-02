"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  approvePostAction,
  rejectPostAction,
} from "@/app/(admin)/admin/community/actions";

export function ModerationActions({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const res = await approvePostAction(topicId);
      if (res.ok) {
        setDone("approved");
        toast.success("Aprovado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleReject() {
    if (!confirm("Rejeitar esta publicação?")) return;
    startTransition(async () => {
      const res = await rejectPostAction(topicId);
      if (res.ok) {
        setDone("rejected");
        toast.success("Rejeitado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (done === "approved")
    return <span className="text-xs text-green-400">✓ Aprovado</span>;
  if (done === "rejected")
    return <span className="text-xs text-red-400">✕ Rejeitado</span>;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleReject}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        Rejeitar
      </button>
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Aprovar
      </button>
    </div>
  );
}
