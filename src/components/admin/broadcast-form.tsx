"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendBroadcastAction } from "@/app/(admin)/admin/notifications/actions";

interface Cohort {
  id: string;
  name: string;
}

interface Props {
  cohorts: Cohort[];
}

type CohortPick = "neutral" | "include" | "exclude";

export function BroadcastForm({ cohorts }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [picks, setPicks] = useState<Map<string, CohortPick>>(new Map());
  const [roles, setRoles] = useState<Set<string>>(
    new Set(["student", "ficticio"]),
  );
  const [deliverPush, setDeliverPush] = useState(true);
  const [deliverInapp, setDeliverInapp] = useState(true);
  const [deliverBanner, setDeliverBanner] = useState(false);
  const [bannerExpiresAt, setBannerExpiresAt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function cycleCohort(id: string) {
    setPicks((prev) => {
      const copy = new Map(prev);
      const cur = copy.get(id) ?? "neutral";
      const next: CohortPick =
        cur === "neutral"
          ? "include"
          : cur === "include"
            ? "exclude"
            : "neutral";
      if (next === "neutral") copy.delete(id);
      else copy.set(id, next);
      return copy;
    });
  }

  function toggleRole(role: string) {
    setRoles((prev) => {
      const copy = new Set(prev);
      if (copy.has(role)) copy.delete(role);
      else copy.add(role);
      return copy;
    });
  }

  const includes = Array.from(picks.entries())
    .filter(([, v]) => v === "include")
    .map(([id]) => id);
  const excludes = Array.from(picks.entries())
    .filter(([, v]) => v === "exclude")
    .map(([id]) => id);

  function handleOpenConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Título é obrigatório.");
    if (title.length > 80) return toast.error("Título max 80 chars.");
    if (body.length > 200) return toast.error("Mensagem max 200 chars.");
    if (link && !link.startsWith("/") && !link.startsWith("http")) {
      return toast.error("Link inválido.");
    }
    if (roles.size === 0) return toast.error("Selecione ao menos um perfil.");
    if (!deliverPush && !deliverInapp && !deliverBanner) {
      return toast.error("Selecione pelo menos um canal de entrega.");
    }
    setConfirmOpen(true);
  }

  function handleSend() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("body", body.trim());
      fd.set("link", link.trim());
      includes.forEach((cid) => fd.append("include_cohort_ids", cid));
      excludes.forEach((cid) => fd.append("exclude_cohort_ids", cid));
      roles.forEach((r) => fd.append("roles", r));
      if (deliverPush) fd.set("deliver_push", "on");
      if (deliverInapp) fd.set("deliver_inapp", "on");
      if (deliverBanner) {
        fd.set("deliver_banner", "on");
        if (bannerExpiresAt) fd.set("banner_expires_at", bannerExpiresAt);
      }

      const res = await sendBroadcastAction(null, fd);
      if (res.ok) {
        toast.success(
          `Anúncio enviado pra ${res.data?.recipientsCount ?? 0} alunos · ${res.data?.delivered ?? 0} push entregues.`,
        );
        setTitle("");
        setBody("");
        setLink("");
        setPicks(new Map());
        setBannerExpiresAt("");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <>
      <form
        onSubmit={handleOpenConfirm}
        className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6"
      >
        {/* Título */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
            Título <span className="text-npb-gold">*</span>{" "}
            <span className="text-[10px]">({title.length}/80)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Ex: Live agora! Webinar de Black Friday"
            required
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        {/* Body */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
            Mensagem (opcional) <span className="text-[10px]">({body.length}/200)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 200))}
            placeholder="Detalhes que aparecem abaixo do título"
            rows={3}
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        {/* Link */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
            Link ao clicar (opcional)
          </label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/lessons/abc-123 ou https://exemplo.com"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        {/* Roles */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-npb-text-muted">
            Quais perfis recebem?
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "student", label: "Alunos" },
              { key: "ficticio", label: "Fictícios (teste)" },
              { key: "moderator", label: "Moderadores" },
              { key: "admin", label: "Admin" },
            ].map((r) => {
              const active = roles.has(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggleRole(r.key)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
                      : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:text-npb-text"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cohorts (3 estados: neutral / include / exclude) */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-npb-text-muted">
            Filtro por turma (clica pra alternar: neutro → incluir → excluir)
          </label>
          {cohorts.length === 0 ? (
            <p className="rounded-md border border-dashed border-npb-border bg-npb-bg3 p-3 text-xs italic text-npb-text-muted">
              Nenhuma turma cadastrada.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {cohorts.map((c) => {
                  const pick = picks.get(c.id) ?? "neutral";
                  const cls =
                    pick === "include"
                      ? "border-green-500/50 bg-green-500/10 text-green-300"
                      : pick === "exclude"
                        ? "border-red-500/50 bg-red-500/10 text-red-300"
                        : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:text-npb-text";
                  const icon =
                    pick === "include" ? "✓" : pick === "exclude" ? "✕" : "○";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => cycleCohort(c.id)}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${cls}`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-base font-bold">{icon}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-npb-text-muted">
                Sem filtros = todos os perfis selecionados. Incluir = aluno
                precisa estar em TODAS as turmas marcadas. Excluir = aluno
                não pode estar em NENHUMA turma marcada.
              </p>
            </>
          )}
        </div>

        {/* Canais de entrega */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-npb-text-muted">
            Enviar via (pelo menos 1)
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ChannelToggle
              label="Push notification"
              hint="Notificação no celular/desktop (precisa ter aceitado push)"
              checked={deliverPush}
              onChange={setDeliverPush}
            />
            <ChannelToggle
              label="In-app (sino)"
              hint="Aparece no sino do topbar"
              checked={deliverInapp}
              onChange={setDeliverInapp}
            />
            <ChannelToggle
              label="Barra fixa nas telas"
              hint="Banner dourado no topo até o aluno dispensar"
              checked={deliverBanner}
              onChange={setDeliverBanner}
            />
          </div>
          {deliverBanner && (
            <div className="mt-3 rounded-md border border-npb-gold/30 bg-npb-gold/5 p-3">
              <label className="mb-1 block text-[11px] font-semibold text-npb-text-muted">
                Barra expira em (BRT) — opcional, vazio = só some quando
                aluno dispensar
              </label>
              <input
                type="datetime-local"
                value={bannerExpiresAt}
                onChange={(e) => setBannerExpiresAt(e.target.value)}
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-npb-gold-light"
          >
            <Send className="h-4 w-4" />
            Revisar e enviar
          </button>
        </div>
      </form>

      {/* Modal de confirmação */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setConfirmOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
            <div className="border-b border-npb-border px-5 py-3">
              <h2 className="text-base font-bold text-npb-text">
                Confirmar envio
              </h2>
            </div>
            <div className="space-y-3 p-5">
              <div className="rounded-md border border-npb-border bg-npb-bg3 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
                  Preview da notificação
                </p>
                <div className="mt-2">
                  <p className="text-sm font-bold text-npb-text">{title}</p>
                  {body && (
                    <p className="mt-0.5 text-xs text-npb-text-muted">{body}</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-npb-text-muted">
                <p>
                  <strong className="text-npb-text">Perfis</strong>:{" "}
                  {Array.from(roles).join(", ") || "—"}
                </p>
                {includes.length > 0 && (
                  <p>
                    <strong className="text-green-400">Incluir</strong>:{" "}
                    {includes.length} turma{includes.length > 1 ? "s" : ""}
                  </p>
                )}
                {excludes.length > 0 && (
                  <p>
                    <strong className="text-red-400">Excluir</strong>:{" "}
                    {excludes.length} turma{excludes.length > 1 ? "s" : ""}
                  </p>
                )}
                {link && (
                  <p>
                    <strong className="text-npb-text">Link</strong>: {link}
                  </p>
                )}
              </div>

              <p className="text-xs text-yellow-300">
                ⚠️ Vai enviar push pra todos os dispositivos ativos. Confira
                antes — não dá pra desfazer.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-npb-border bg-npb-bg3 px-5 py-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm text-npb-text-muted hover:text-npb-text"
              >
                Voltar e ajustar
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar agora"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChannelToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition ${
        checked
          ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
          : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:text-npb-text"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border ${
            checked
              ? "border-npb-gold bg-npb-gold text-black"
              : "border-npb-border"
          }`}
        >
          {checked && "✓"}
        </span>
        {label}
      </div>
      <span className="text-[10px] leading-snug text-npb-text-muted">
        {hint}
      </span>
    </button>
  );
}
