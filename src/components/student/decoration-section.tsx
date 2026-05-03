"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DecoratedAvatar } from "@/components/decorated-avatar";
import { equipDecorationAction } from "@/app/(student)/decorations/actions";

export interface DecorationOption {
  id: string;
  name: string;
  imageUrl: string | null;
  unlocked: boolean;
}

interface Props {
  avatarUrl: string | null;
  userName: string | null;
  equippedDecorationId: string | null;
  options: DecorationOption[];
}

export function DecorationSection({
  avatarUrl,
  userName,
  equippedDecorationId,
  options,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const equipped = options.find((o) => o.id === equippedDecorationId) ?? null;

  function handleEquip(decorationId: string | null) {
    startTransition(async () => {
      const res = await equipDecorationAction(decorationId);
      if (res.ok) {
        toast.success(decorationId ? "Decoração equipada." : "Decoração removida.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  // Esconde a section inteira se NENHUMA decoração está disponível e nenhuma
  // está equipada (ex: admin ainda não subiu nenhuma imagem).
  const anyVisible = options.length > 0;
  if (!anyVisible) return null;

  return (
    <section id="decorations" className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-npb-gold" />
        <h2 className="text-lg font-bold text-npb-text">Decoração de avatar</h2>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-npb-border bg-npb-bg2 p-5">
        <DecoratedAvatar
          src={avatarUrl}
          decorationUrl={equipped?.imageUrl ?? null}
          name={userName}
          size={72}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-npb-text">
            {equipped ? equipped.name : "Sem decoração"}
          </p>
          <p className="mt-0.5 text-xs text-npb-text-muted">
            Desbloqueia decorações novas conforme suas vendas como afiliado
            crescem. Quando você bate um marco, equipamos automaticamente —
            mas você pode trocar ou remover quando quiser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-shrink-0 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-npb-gold-light"
        >
          Mudar
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !pending && setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
            <header className="flex items-center justify-between border-b border-npb-border px-5 py-3">
              <h3 className="text-base font-bold text-npb-text">
                Mudar decoração
              </h3>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                aria-label="Fechar"
                className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5 npb-scrollbar">
              {/* Opção "Nenhuma" */}
              <button
                type="button"
                disabled={pending}
                onClick={() => handleEquip(null)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  !equipped
                    ? "border-npb-gold bg-npb-gold/5"
                    : "border-npb-border bg-npb-bg3 hover:border-npb-gold-dim"
                } disabled:opacity-50`}
              >
                <DecoratedAvatar
                  src={avatarUrl}
                  name={userName}
                  size={48}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-npb-text">Nenhuma</p>
                  <p className="text-xs text-npb-text-muted">
                    Avatar sem decoração
                  </p>
                </div>
                {!equipped && (
                  <CheckCircle2 className="h-5 w-5 text-npb-gold" />
                )}
              </button>

              {/* Opções desbloqueadas + bloqueadas */}
              {options.map((opt) => {
                const isCurrent = opt.id === equippedDecorationId;
                const canEquip = opt.unlocked && opt.imageUrl;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={pending || !canEquip}
                    onClick={() => canEquip && handleEquip(opt.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isCurrent
                        ? "border-npb-gold bg-npb-gold/5"
                        : canEquip
                          ? "border-npb-border bg-npb-bg3 hover:border-npb-gold-dim"
                          : "border-npb-border bg-npb-bg3 opacity-50"
                    } disabled:cursor-not-allowed`}
                  >
                    <DecoratedAvatar
                      src={avatarUrl}
                      decorationUrl={canEquip ? opt.imageUrl : null}
                      name={userName}
                      size={48}
                      className={canEquip ? "" : "grayscale"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-npb-text">
                        {opt.unlocked ? opt.name : "Bloqueada"}
                      </p>
                      <p className="text-xs text-npb-text-muted">
                        {opt.unlocked
                          ? opt.imageUrl
                            ? "Disponível pra equipar"
                            : "Imagem ainda não publicada"
                          : "Continue vendendo pra desbloquear"}
                      </p>
                    </div>
                    {isCurrent ? (
                      <CheckCircle2 className="h-5 w-5 text-npb-gold" />
                    ) : !opt.unlocked ? (
                      <Lock className="h-4 w-4 text-npb-text-muted" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
