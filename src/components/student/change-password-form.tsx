"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPasswordAction } from "@/app/(student)/profile/actions";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    startTransition(async () => {
      const res = await changeOwnPasswordAction(current, next);
      if (res.ok) {
        toast.success("Senha trocada com sucesso.");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        toast.error(res.error ?? "Erro ao trocar senha.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cur_pwd" className="text-npb-text">
            Senha atual <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="cur_pwd"
            type={show ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new_pwd" className="text-npb-text">
            Nova senha <span className="text-npb-gold">*</span>
          </Label>
          <div className="relative">
            <Input
              id="new_pwd"
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="mínimo 8"
              className="bg-npb-bg3 border-npb-border text-npb-text pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-npb-text-muted hover:text-npb-gold"
              aria-label={show ? "Ocultar" : "Mostrar"}
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf_pwd" className="text-npb-text">
            Confirme
          </Label>
          <Input
            id="conf_pwd"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {pending ? "Salvando..." : "Trocar senha"}
        </button>
      </div>
    </form>
  );
}
