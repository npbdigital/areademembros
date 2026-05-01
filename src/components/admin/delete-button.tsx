"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

interface DeleteButtonProps {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
  variant?: "icon" | "full";
  className?: string;
}

export function DeleteButton({
  action,
  confirmMessage,
  label = "Excluir",
  variant = "full",
  className,
}: DeleteButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      await action();
    });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title={label}
        aria-label={label}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50",
          className,
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50",
        className,
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Excluindo..." : label}
    </button>
  );
}
