"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { toggleBannerActiveAction } from "@/app/(admin)/admin/courses/actions";

interface Props {
  bannerId: string;
  courseId: string;
  initialActive: boolean;
}

export function BannerActiveToggle({
  bannerId,
  courseId,
  initialActive,
}: Props) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const res = await toggleBannerActiveAction(bannerId, courseId, next);
      if (!res.ok) {
        setActive(!next);
        toast.error(res.error ?? "Erro ao atualizar.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        active
          ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
          : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold"
      }`}
      aria-label={active ? "Desativar banner" : "Ativar banner"}
    >
      {active ? (
        <>
          <Eye className="h-3 w-3" />
          Ativo
        </>
      ) : (
        <>
          <EyeOff className="h-3 w-3" />
          Inativo
        </>
      )}
    </button>
  );
}
