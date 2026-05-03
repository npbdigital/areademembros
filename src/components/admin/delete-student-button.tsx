"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteStudentAction } from "@/app/(admin)/admin/students/actions";

interface Props {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

/**
 * Botão de exclusão definitiva de aluno. Confirmação dupla:
 *   1. Modal mostra o que vai ser apagado
 *   2. Aluno precisa digitar o e-mail pra confirmar
 */
export function DeleteStudentButton({
  studentId,
  studentName,
  studentEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (confirmText.trim().toLowerCase() !== studentEmail.toLowerCase()) {
      toast.error("Digite o e-mail exato pra confirmar.");
      return;
    }
    startTransition(async () => {
      const res = await deleteStudentAction(studentId);
      if (res.ok) {
        toast.success(`${studentName || studentEmail} foi excluído.`);
        router.push("/admin/students");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/15"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir aluno
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => !pending && setOpen(false)}
              className="absolute inset-0 bg-black/80"
            />
            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-red-500/40 bg-npb-bg2 shadow-2xl">
              <div className="flex items-start gap-3 border-b border-npb-border px-5 py-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-npb-text">
                    Excluir aluno permanentemente?
                  </h2>
                  <p className="mt-0.5 text-xs text-npb-text-muted">
                    Esta ação <strong className="text-red-400">não tem volta</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  disabled={pending}
                  aria-label="Fechar"
                  className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 p-5">
                <div className="rounded-md border border-npb-border bg-npb-bg3 p-3 text-sm">
                  <p className="font-semibold text-npb-text">{studentName}</p>
                  <p className="text-xs text-npb-text-muted">{studentEmail}</p>
                </div>

                <div className="text-xs text-npb-text-muted">
                  <p className="mb-1 font-semibold text-npb-text">
                    Vai apagar:
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc">
                    <li>Conta de login (não consegue mais entrar)</li>
                    <li>Perfil + foto + dados pessoais</li>
                    <li>Todas as matrículas em turmas</li>
                    <li>Progresso de aulas, anotações, favoritos</li>
                    <li>Conquistas, XP, streak</li>
                    <li>Posts e comentários na comunidade</li>
                    <li>Vinculação Kiwify (vendas ficam órfãs)</li>
                  </ul>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
                    Pra confirmar, digite o e-mail{" "}
                    <code className="text-red-400">{studentEmail}</code>:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={studentEmail}
                    autoComplete="off"
                    className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-npb-border bg-npb-bg3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-md px-3 py-2 text-sm text-npb-text-muted hover:text-npb-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    pending ||
                    confirmText.trim().toLowerCase() !==
                      studentEmail.toLowerCase()
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir definitivamente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
