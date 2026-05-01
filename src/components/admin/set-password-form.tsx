"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setStudentPasswordAction } from "@/app/(admin)/admin/students/actions";

interface Props {
  userId: string;
}

export function SetPasswordForm({ userId }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    startTransition(async () => {
      const res = await setStudentPasswordAction(userId, password);
      if (res.ok) {
        toast.success("Senha definida com sucesso. Avise o aluno.");
        setPassword("");
        setConfirm("");
      } else {
        toast.error(res.error ?? "Erro ao definir senha.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-npb-text-muted">
        Define uma nova senha imediatamente, sem precisar de e-mail. Use isso
        quando o aluno não conseguir abrir o link de convite — passe a senha
        manualmente por outro canal.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new_password" className="text-npb-text">
            Nova senha <span className="text-npb-gold">*</span>
          </Label>
          <div className="relative">
            <Input
              id="new_password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="mínimo 8 caracteres"
              className="bg-npb-bg3 border-npb-border text-npb-text pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-npb-text-muted hover:text-npb-gold"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {show ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-npb-text">
            Confirme
          </Label>
          <Input
            id="confirm_password"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="repita a senha"
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
          {pending ? "Salvando..." : "Definir senha"}
        </button>
      </div>
    </form>
  );
}
