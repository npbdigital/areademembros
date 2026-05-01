"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  pendingLabel?: string;
}

/**
 * Botão de submit que reflete `pending` da Server Action ativa.
 * Deve estar DENTRO de <form action={...}>.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        "h-11 bg-npb-gold text-black font-bold tracking-wide hover:bg-npb-gold-light disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pendingLabel ?? "Aguarde..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
