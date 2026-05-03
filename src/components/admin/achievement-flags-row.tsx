"use client";

import { useState, useTransition } from "react";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { setAchievementFlagsAction } from "@/app/(admin)/admin/achievements/actions";

interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  xpReward: number;
  celebrate: boolean;
  shareable: boolean;
}

export function AchievementFlagsRow({
  achievement,
}: {
  achievement: Achievement;
}) {
  const router = useRouter();
  const [celebrate, setCelebrate] = useState(achievement.celebrate);
  const [shareable, setShareable] = useState(achievement.shareable);
  const [pending, startTransition] = useTransition();

  function handleToggle(field: "celebrate" | "shareable", next: boolean) {
    if (field === "celebrate") setCelebrate(next);
    else setShareable(next);

    startTransition(async () => {
      const res = await setAchievementFlagsAction({
        achievementId: achievement.id,
        [field]: next,
      });
      if (!res.ok) {
        // rollback
        if (field === "celebrate") setCelebrate(!next);
        else setShareable(!next);
        toast.error(res.error ?? "Falha.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-npb-border bg-npb-bg2 p-3">
      <span className="text-2xl leading-none">{achievement.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-npb-text">
          {achievement.name}
        </p>
        {achievement.description && (
          <p className="truncate text-xs text-npb-text-muted">
            {achievement.description}
          </p>
        )}
      </div>
      <span className="hidden flex-shrink-0 text-[10px] text-npb-gold sm:inline">
        +{achievement.xpReward} XP
      </span>
      <label
        title="Popup celebrativo com fogos"
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
          celebrate
            ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
            : "border-npb-border bg-npb-bg3 text-npb-text-muted"
        }`}
      >
        <input
          type="checkbox"
          checked={celebrate}
          onChange={(e) => handleToggle("celebrate", e.target.checked)}
          disabled={pending}
          className="hidden"
        />
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">Celebra</span>
      </label>
      <label
        title="Permitir compartilhar em /community/resultados"
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
          shareable
            ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
            : "border-npb-border bg-npb-bg3 text-npb-text-muted"
        }`}
      >
        <input
          type="checkbox"
          checked={shareable}
          onChange={(e) => handleToggle("shareable", e.target.checked)}
          disabled={pending}
          className="hidden"
        />
        <Share2 className="h-3 w-3" />
        <span className="hidden sm:inline">Compartilha</span>
      </label>
      {pending && (
        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-npb-text-muted" />
      )}
    </li>
  );
}
