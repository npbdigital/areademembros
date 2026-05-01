"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toggleCommunityAccessAction } from "@/app/(admin)/admin/cohorts/actions";
import { cn } from "@/lib/utils";

interface CommunityToggleProps {
  cohortCourseId: string;
  cohortId: string;
  enabled: boolean;
}

export function CommunityToggle({
  cohortCourseId,
  cohortId,
  enabled,
}: CommunityToggleProps) {
  const [pending, startTransition] = useTransition();

  function handle() {
    if (pending) return;
    startTransition(async () => {
      await toggleCommunityAccessAction(cohortCourseId, cohortId, !enabled);
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      title={
        enabled
          ? "Comunidade liberada — clique pra desativar"
          : "Sem comunidade — clique pra liberar"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        enabled
          ? "bg-npb-gold/15 text-npb-gold hover:bg-npb-gold/25"
          : "bg-npb-bg3 text-npb-text-muted hover:bg-npb-bg4 hover:text-npb-text",
      )}
    >
      <MessageCircle className="h-3 w-3" />
      {enabled ? "Comunidade ON" : "Comunidade OFF"}
    </button>
  );
}
