"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { dismissBroadcastBannerAction } from "@/app/(student)/broadcasts/actions";

export function DismissBannerButton({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function handleDismiss() {
    // Optimistic: esconde imediato. Se falhar no server, fica escondido
    // mesmo (próximo refresh re-aparece). UX > consistência aqui.
    setHidden(true);
    startTransition(async () => {
      await dismissBroadcastBannerAction(broadcastId);
      router.refresh();
    });
  }

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={handleDismiss}
      disabled={pending}
      aria-label="Dispensar aviso"
      title="Dispensar"
      className="flex-shrink-0 rounded-md p-1 text-npb-text-muted transition hover:bg-npb-gold/15 hover:text-npb-text disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
