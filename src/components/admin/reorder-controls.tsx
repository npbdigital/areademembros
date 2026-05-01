"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTransition } from "react";

interface ReorderControlsProps {
  onMove: (direction: "up" | "down") => Promise<void>;
  disableUp?: boolean;
  disableDown?: boolean;
}

export function ReorderControls({
  onMove,
  disableUp,
  disableDown,
}: ReorderControlsProps) {
  const [pending, startTransition] = useTransition();

  function handle(direction: "up" | "down") {
    if (pending) return;
    startTransition(async () => {
      await onMove(direction);
    });
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => handle("up")}
        disabled={pending || disableUp}
        title="Mover para cima"
        aria-label="Mover para cima"
        className="flex h-5 w-6 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handle("down")}
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
