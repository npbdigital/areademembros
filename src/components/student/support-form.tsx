"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendSupportRequestAction } from "@/app/(student)/support/actions";

export interface SupportEnrollmentOption {
  id: string;
  label: string;
}

interface Props {
  enrollments: SupportEnrollmentOption[];
}

export function SupportForm({ enrollments }: Props) {
  const [enrollmentId, setEnrollmentId] = useState<string>(
    enrollments[0]?.id ?? "",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error("Preencha o assunto.");
      return;
    }
    if (!message.trim()) {
      toast.error("Escreva uma mensagem.");
      return;
    }
    startTransition(async () => {
      const res = await sendSupportRequestAction({
        enrollmentId: enrollmentId || null,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (res.ok) {
        toast.success("Pedido de suporte enviado. Em breve te respondemos.");
        setSubject("");
        setMessage("");
      } else {
        toast.error(res.error ?? "Falha ao enviar.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {enrollments.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="cohort_select" className="text-npb-text">
            Sobre qual curso?
          </Label>
          <select
            id="cohort_select"
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
          >
            <option value="">— Não relacionado a um curso específico —</option>
            {enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="subject" className="text-npb-text">
          Assunto <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Resumo do que precisa"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message" className="text-npb-text">
          Mensagem <span className="text-npb-gold">*</span>
        </Label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={5000}
          required
          placeholder="Descreva o que está acontecendo, com o máximo de detalhes possível..."
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
        />
        <p className="text-[10px] text-npb-text-muted">
          {message.length}/5000
        </p>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar pedido de suporte
            </>
          )}
        </button>
      </div>
    </form>
  );
}
