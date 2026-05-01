"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTransition } from "react";

interface ReorderControlsProps {
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  disableUp?: boolean;
  disableDown?: boolean;
}

/**
 * Recebe DUAS server actions já bound (uma por direção). Não aceita
 * função inline porque Next.js 14 não serializa closures pra client comp.
 */
export function ReorderControls({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: ReorderControlsProps) {
  const [pending, startTransition] = useTransition();

  function handle(e: React.MouseEvent, action: () => Promise<void>) {
    // Para impedir que o clique navegue caso o controle esteja dentro de um <Link>.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    startTransition(async () => {
      await action();
    });
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={(e) => handle(e, onMoveUp)}
        disabled={pending || disableUp}
        title="Mover para cima"
        aria-label="Mover para cima"
        className="flex h-5 w-6 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => handle(e, onMoveDown)}
        disabled={pending || disableDown}
        title="Mover para baixo"
        aria-label="Mover para baixo"
        className="flex h-5 w-6 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
