"use client";

import { useState, useTransition } from "react";
import {
  Eye,
  ImagePlus,
  Loader2,
  Share2,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  setAchievementDecorationAction,
  setAchievementFlagsAction,
} from "@/app/(admin)/admin/achievements/actions";
import { AchievementImageDialog } from "@/components/admin/achievement-image-dialog";
import { AchievementCelebrationModal } from "@/components/student/achievement-celebration";

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  xpReward: number;
  celebrate: boolean;
  shareable: boolean;
  imageUrl: string | null;
  unlocksDecorationId: string | null;
}

interface DecorationOption {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  required_sales: number;
}

export function AchievementFlagsRow({
  achievement,
  decorationOptions,
}: {
  achievement: Achievement;
  decorationOptions: DecorationOption[];
}) {
  const router = useRouter();
  const [celebrate, setCelebrate] = useState(achievement.celebrate);
  const [shareable, setShareable] = useState(achievement.shareable);
  const [pending, startTransition] = useTransition();
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [decoMenuOpen, setDecoMenuOpen] = useState(false);
  const [pendingDeco, startDeco] = useTransition();
  const linkedDeco = achievement.unlocksDecorationId
    ? decorationOptions.find((d) => d.id === achievement.unlocksDecorationId)
    : null;

  function handleSetDeco(decorationId: string | null) {
    setDecoMenuOpen(false);
    startDeco(async () => {
      const res = await setAchievementDecorationAction({
        achievementId: achievement.id,
        decorationId,
      });
      if (res.ok) {
        router.refresh();
        toast.success(
          decorationId ? "Frame linkado." : "Frame desvinculado.",
        );
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleToggle(field: "celebrate" | "shareable", next: boolean) {
    if (field === "celebrate") setCelebrate(next);
    else setShareable(next);

    startTransition(async () => {
      const res = await setAchievementFlagsAction({
        achievementId: achievement.id,
        [field]: next,
      });
      if (!res.ok) {
        if (field === "celebrate") setCelebrate(!next);
        else setShareable(!next);
        toast.error(res.error ?? "Falha.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <li className="flex items-center gap-3 rounded-md border border-npb-border bg-npb-bg2 p-3">
        {achievement.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={achievement.imageUrl}
            alt=""
            className="h-9 w-9 flex-shrink-0 rounded-md object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-2xl leading-none">
            {achievement.icon}
          </span>
        )}
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

        <ToggleButton
          active={celebrate}
          onChange={(v) => handleToggle("celebrate", v)}
          disabled={pending}
          icon={<Sparkles className="h-3 w-3" />}
          label="Celebra"
          title="Popup celebrativo com fogos"
        />
        <ToggleButton
          active={shareable}
          onChange={(v) => handleToggle("shareable", v)}
          disabled={pending}
          icon={<Share2 className="h-3 w-3" />}
          label="Compartilha"
          title="Permitir compartilhar em /community/resultados"
        />

        {/* Frame — quando linkado, popup mostra avatar+frame em vez de imagem */}
        {decorationOptions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDecoMenuOpen((v) => !v)}
              title={
                linkedDeco
                  ? `Linkado ao frame "${linkedDeco.name}"`
                  : "Linkar a um frame de avatar"
              }
              disabled={pendingDeco}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                linkedDeco
                  ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
                  : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text"
              }`}
            >
              {pendingDeco ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserCircle2 className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">
                {linkedDeco ? "Frame ✓" : "Frame"}
              </span>
            </button>
            {decoMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setDecoMenuOpen(false)}
                  className="fixed inset-0 z-40"
                />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-npb-border bg-npb-bg2 p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => handleSetDeco(null)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-npb-bg3 ${
                      !linkedDeco ? "font-bold text-npb-gold" : "text-npb-text"
                    }`}
                  >
                    Sem frame
                  </button>
                  <div className="my-1 border-t border-npb-border" />
                  {decorationOptions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSetDeco(d.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-npb-bg3 ${
                        linkedDeco?.id === d.id
                          ? "font-bold text-npb-gold"
                          : "text-npb-text"
                      }`}
                    >
                      {d.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.image_url}
                          alt=""
                          className="h-6 w-6 rounded object-contain"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-npb-bg3" />
                      )}
                      <div className="flex-1 text-left">
                        <div>{d.name}</div>
                        <div className="text-[10px] text-npb-text-muted">
                          {d.required_sales} venda
                          {d.required_sales > 1 ? "s" : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Imagem custom — toggle visual: dourado quando tem imagem setada */}
        <button
          type="button"
          onClick={() => setImageDialogOpen(true)}
          title="Imagem custom da conquista"
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
            achievement.imageUrl
              ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
              : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text"
          }`}
        >
          <ImagePlus className="h-3 w-3" />
          <span className="hidden sm:inline">Imagem</span>
        </button>

        {/* Preview — abre o modal igual o aluno vê (sem botão de share) */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          title="Pré-visualizar como aluno vai ver"
          className="flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-[11px] font-semibold text-npb-text-muted transition hover:border-npb-gold-dim hover:text-npb-text"
        >
          <Eye className="h-3 w-3" />
          <span className="hidden sm:inline">Preview</span>
        </button>

        {pending && (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-npb-text-muted" />
        )}
      </li>

      {imageDialogOpen && (
        <AchievementImageDialog
          achievement={{
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            imageUrl: achievement.imageUrl,
          }}
          onClose={() => setImageDialogOpen(false)}
        />
      )}

      {previewOpen && (
        <AchievementCelebrationModal
          achievement={{
            id: achievement.id,
            code: achievement.code,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            shareable: achievement.shareable,
            imageUrl: achievement.imageUrl,
            decorationName: linkedDeco?.name ?? null,
            decorationImageUrl: linkedDeco?.image_url ?? null,
          }}
          onClose={() => setPreviewOpen(false)}
          previewMode
          // No preview, sem avatar real — usa placeholder genérico
          previewAvatarUrl={null}
        />
      )}
    </>
  );
}

function ToggleButton({
  active,
  onChange,
  disabled,
  icon,
  label,
  title,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <label
      title={title}
      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
          : "border-npb-border bg-npb-bg3 text-npb-text-muted"
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="hidden"
      />
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </label>
  );
}
