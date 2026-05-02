"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  type ActionResult,
  linkKiwifyAffiliateAction,
  unlinkKiwifyAffiliateAction,
} from "@/app/(student)/profile/affiliate-actions";

export interface AffiliateLinkView {
  externalAffiliateId: string;
  verified: boolean;
  verifiedAt: string | null;
  registeredAt: string;
  cpfCnpjLast4: string | null;
}

export interface AffiliateStats {
  totalSales: number;
  paidSales: number;
  refundedSales: number;
  totalCommissionCents: number;
  recentSales: Array<{
    id: string;
    productName: string | null;
    status: string;
    commissionCents: number;
    approvedAt: string | null;
  }>;
}

interface Props {
  link: AffiliateLinkView | null;
  stats: AffiliateStats;
}

export function AffiliateSection({ link, stats }: Props) {
  return (
    <section id="afiliado" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Wallet className="h-5 w-5 text-npb-gold" />
          Afiliado Kiwify
        </h2>
      </div>

      {!link ? (
        <NotLinked />
      ) : !link.verified ? (
        <Pending link={link} stats={stats} />
      ) : (
        <Verified link={link} stats={stats} />
      )}
    </section>
  );
}

function NotLinked() {
  const [state, formAction] = useFormState<
    ActionResult<{ attached: number }> | null,
    FormData
  >(linkKiwifyAffiliateAction, null);
  const router = useRouter();

  if (state?.ok) {
    if (state.data && state.data.attached > 0) {
      toast.success(
        `Vinculação criada! ${state.data.attached} venda${state.data.attached > 1 ? "s" : ""} já atribuída${state.data.attached > 1 ? "s" : ""} a você.`,
      );
    } else {
      toast.success(
        "Vinculação criada! Você ficará com status pendente até a 1ª venda chegar.",
      );
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-npb-text">
            Conecte sua conta Kiwify
          </h3>
          <p className="mt-1 text-sm text-npb-text-muted">
            Suas vendas como afiliado serão rastreadas, transformadas em XP
            e em conquistas. Só você vê seus números.
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <Label
            htmlFor="external_affiliate_id"
            className="text-sm text-npb-text"
          >
            ID de afiliado Kiwify <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="external_affiliate_id"
            name="external_affiliate_id"
            placeholder="Ex: BrzPdTT"
            required
            maxLength={64}
            className="mt-1 bg-npb-bg3 border-npb-border text-npb-text font-mono"
          />
          <p className="mt-1 text-xs text-npb-text-muted">
            Encontre na sua conta Kiwify em{" "}
            <strong>Configurações → Afiliação</strong>. É um código curto e
            único, tipo <code>BrzPdTT</code>.
          </p>
        </div>

        <div>
          <Label htmlFor="cpf_cnpj" className="text-sm text-npb-text">
            CPF ou CNPJ
            <span className="ml-1 text-xs font-normal text-npb-text-muted">
              (opcional, criptografado)
            </span>
          </Label>
          <Input
            id="cpf_cnpj"
            name="cpf_cnpj"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            maxLength={20}
            className="mt-1 bg-npb-bg3 border-npb-border text-npb-text"
          />
          <p className="mt-1 text-xs text-npb-text-muted">
            Pra o admin conferir caso precise auditar. Só os 4 últimos
            dígitos ficam visíveis na UI; o resto é criptografado no banco.
          </p>
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="rounded-md border border-npb-border bg-npb-bg3 p-3 text-xs text-npb-text-muted">
          <p>
            <strong className="text-npb-text">Como funciona:</strong> seu
            cadastro fica <strong>pendente</strong> até a 1ª venda chegar
            no nosso sistema. A partir daí, vendas viram XP automaticamente
            (1 XP por R$1 de comissão + 10 XP por venda).
          </p>
        </div>

        <SubmitButton>Conectar Kiwify</SubmitButton>
      </form>
    </div>
  );
}

function Pending({ link, stats }: { link: AffiliateLinkView; stats: AffiliateStats }) {
  const router = useRouter();
  const [showUnlink, setShowUnlink] = useState(false);

  async function handleUnlink() {
    const res = await unlinkKiwifyAffiliateAction();
    if (res.ok) {
      toast.success("Vinculação removida.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Falha ao remover.");
    }
  }

  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-400">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-npb-text">
            Aguardando primeira venda
          </h3>
          <p className="mt-1 text-sm text-npb-text-muted">
            Sua vinculação Kiwify está cadastrada como{" "}
            <code className="text-npb-text">{link.externalAffiliateId}</code>.
            Quando a 1ª venda chegar com esse ID, sua conta vira verificada
            automaticamente e o XP começa a contar.
          </p>
          {link.cpfCnpjLast4 && (
            <p className="mt-1.5 text-xs text-npb-text-muted">
              CPF/CNPJ cadastrado: <strong>•••{link.cpfCnpjLast4}</strong>
            </p>
          )}
        </div>
      </div>

      {stats.totalSales > 0 && (
        <p className="mt-4 rounded-md border border-npb-border bg-npb-bg3 p-3 text-xs text-npb-text-muted">
          ⓘ Vimos <strong className="text-npb-text">{stats.totalSales}</strong>{" "}
          venda{stats.totalSales > 1 ? "s" : ""} com esse ID antes do
          cadastro. Como vendas só contam a partir do registro, essas não
          geraram XP. Vendas a partir de agora contam.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-npb-text-muted">
          Cadastrado em{" "}
          {new Date(link.registeredAt).toLocaleDateString("pt-BR")}
        </p>
        {showUnlink ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUnlink(false)}
              className="rounded-md px-2 py-1 text-xs text-npb-text-muted hover:text-npb-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUnlink}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-3 w-3" />
              Confirmar remoção
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowUnlink(true)}
            className="text-xs text-npb-text-muted underline hover:text-red-400"
          >
            Remover vinculação
          </button>
        )}
      </div>
    </div>
  );
}

function Verified({ link, stats }: { link: AffiliateLinkView; stats: AffiliateStats }) {
  const router = useRouter();
  const [showUnlink, setShowUnlink] = useState(false);
  const totalReais = (stats.totalCommissionCents / 100).toLocaleString(
    "pt-BR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );

  async function handleUnlink() {
    const res = await unlinkKiwifyAffiliateAction();
    if (res.ok) {
      toast.success("Vinculação removida.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Falha ao remover.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-npb-gold-dim/40 bg-npb-bg2 p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-npb-text">
                Conta Kiwify verificada
              </h3>
              <p className="text-xs text-npb-text-muted">
                ID:{" "}
                <code className="text-npb-gold">
                  {link.externalAffiliateId}
                </code>
                {link.cpfCnpjLast4 && (
                  <span> · CPF/CNPJ: •••{link.cpfCnpjLast4}</span>
                )}
              </p>
              <p className="mt-0.5 text-[10px] text-npb-text-muted">
                Verificada em{" "}
                {link.verifiedAt
                  ? new Date(link.verifiedAt).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-npb-border bg-npb-bg3 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Comissão acumulada
            </p>
            <p className="mt-1 inline-flex items-baseline gap-1 text-2xl font-bold text-npb-gold">
              <DollarSign className="h-5 w-5 self-center" />
              {totalReais}
            </p>
            <p className="mt-1 text-[10px] text-npb-text-muted">
              Soma de todas as vendas pagas (em R$)
            </p>
          </div>

          <div className="rounded-xl border border-npb-border bg-npb-bg3 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Vendas
            </p>
            <p className="mt-1 text-2xl font-bold text-npb-text">
              {stats.paidSales}
            </p>
            <p className="mt-1 text-[10px] text-npb-text-muted">
              {stats.refundedSales > 0
                ? `${stats.refundedSales} reembolsada${stats.refundedSales > 1 ? "s" : ""} · `
                : ""}
              {stats.totalSales} no total
            </p>
          </div>
        </div>
      </div>

      {stats.recentSales.length > 0 && (
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-5">
          <h4 className="mb-3 text-sm font-bold text-npb-text">
            Últimas vendas
          </h4>
          <ul className="divide-y divide-npb-border">
            {stats.recentSales.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-npb-text">
                    {s.productName ?? "(sem nome)"}
                  </p>
                  <p className="text-xs text-npb-text-muted">
                    {s.approvedAt
                      ? new Date(s.approvedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}{" "}
                    ·{" "}
                    <StatusBadge status={s.status} />
                  </p>
                </div>
                <p
                  className={`font-mono font-bold ${
                    s.status === "paid" ? "text-npb-gold" : "text-red-400 line-through"
                  }`}
                >
                  R$ {(s.commissionCents / 100).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 px-1">
        {showUnlink ? (
          <>
            <button
              type="button"
              onClick={() => setShowUnlink(false)}
              className="rounded-md px-2 py-1 text-xs text-npb-text-muted hover:text-npb-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUnlink}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-3 w-3" />
              Confirmar remoção
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowUnlink(true)}
            className="inline-flex items-center gap-1.5 text-xs text-npb-text-muted hover:text-red-400"
          >
            <ExternalLink className="h-3 w-3" />
            Remover vinculação
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid")
    return <span className="text-green-400">paga</span>;
  if (status === "refunded")
    return <span className="text-yellow-400">reembolsada</span>;
  if (status === "chargedback")
    return <span className="text-red-400">chargeback</span>;
  return <span>{status}</span>;
}
