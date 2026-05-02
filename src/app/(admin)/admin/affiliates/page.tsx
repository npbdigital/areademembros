import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Wallet,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { AffiliateRowActions } from "@/components/admin/affiliate-row-actions";
import { ReprocessPendingButton } from "@/components/admin/reprocess-pending-button";
import { AttachOrphanButton } from "@/components/admin/attach-orphan-button";
import { AddManualSaleButton } from "@/components/admin/add-manual-sale-button";
import { formatDateBrt, formatShortBrt } from "@/lib/format-date";

export const dynamic = "force-dynamic";

interface LinkRow {
  id: string;
  member_user_id: string;
  source: string;
  kiwify_email: string;
  kiwify_name: string;
  cpf_cnpj_last4: string | null;
  cpf_cnpj_encrypted: string | null;
  verified: boolean;
  verified_at: string | null;
  registered_at: string;
  notes: string | null;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface SaleRow {
  id: string;
  external_order_id: string;
  kiwify_email: string;
  kiwify_name: string | null;
  kiwify_affiliate_id: string | null;
  member_user_id: string | null;
  product_name: string | null;
  status: string;
  commission_value_cents: number;
  approved_at: string | null;
  created_at: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  const statusFilter = searchParams?.status; // "paid" | "refunded" | "chargedback" | undefined

  const supabase = createAdminClient();

  let salesQuery = supabase
    .schema("afiliados")
    .from("sales")
    .select(
      "id, external_order_id, kiwify_email, kiwify_name, kiwify_affiliate_id, member_user_id, product_name, status, commission_value_cents, approved_at, created_at",
    )
    .eq("source", "kiwify");

  if (statusFilter && ["paid", "refunded", "chargedback"].includes(statusFilter)) {
    salesQuery = salesQuery.eq("status", statusFilter);
  }
  if (q) {
    // Busca por email ou nome (case-insensitive)
    salesQuery = salesQuery.or(
      `kiwify_email.ilike.%${q}%,kiwify_name.ilike.%${q}%`,
    );
  }
  salesQuery = salesQuery
    .order("approved_at", { ascending: false })
    .limit(200);

  const [
    { data: linksData },
    { data: salesData },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select(
        "id, member_user_id, source, kiwify_email, kiwify_name, cpf_cnpj_last4, cpf_cnpj_encrypted, verified, verified_at, registered_at, notes",
      )
      .eq("source", "kiwify")
      .order("registered_at", { ascending: false }),
    salesQuery,
    supabase
      .schema("afiliados")
      .from("sales_raw")
      .select("id", { count: "exact", head: true })
      .eq("processed", false),
  ]);

  const links = (linksData ?? []) as LinkRow[];
  const sales = (salesData ?? []) as SaleRow[];

  // Hidrata users dos links
  const userIds = Array.from(new Set(links.map((l) => l.member_user_id)));
  const usersMap = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .schema("membros")
      .from("users")
      .select("id, full_name, email, role")
      .in("id", userIds);
    for (const u of (usersData ?? []) as UserRow[]) usersMap.set(u.id, u);
  }

  // Stats agregadas por email Kiwify (chave da vinculação agora)
  const statsByEmail = new Map<
    string,
    { count: number; commission: number; refunded: number }
  >();
  for (const s of sales) {
    const key = s.kiwify_email.toLowerCase();
    const cur = statsByEmail.get(key) ?? {
      count: 0,
      commission: 0,
      refunded: 0,
    };
    if (s.status === "paid") {
      cur.count += 1;
      cur.commission += s.commission_value_cents;
    } else if (s.status === "refunded" || s.status === "chargedback") {
      cur.refunded += 1;
    }
    statsByEmail.set(key, cur);
  }

  // Stats globais
  const totalLinks = links.length;
  const verifiedLinks = links.filter((l) => l.verified).length;
  const totalSales = sales.length;
  const totalCommission = sales
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.commission_value_cents, 0);
  const orphanSales = sales.filter((s) => !s.member_user_id).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
            <Wallet className="h-3.5 w-3.5" />
            Afiliados Kiwify
          </div>
          <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
            Vinculações & vendas
          </h1>
          <p className="mt-1 text-sm text-npb-text-muted">
            Vinculação por <strong>e-mail Kiwify</strong> + dupla verificação
            via <strong>nome</strong>. Webhook em{" "}
            <code>/api/webhooks/kiwify</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddManualSaleButton />
          <Link
            href={
              `/api/admin/affiliates/export.csv` +
              (q ? `?q=${encodeURIComponent(q)}` : "") +
              (statusFilter
                ? `${q ? "&" : "?"}status=${statusFilter}`
                : "")
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg2 px-3 py-1.5 text-xs font-semibold text-npb-text hover:border-npb-gold-dim hover:text-npb-gold"
            title="Baixar CSV das vendas (respeitando filtros atuais)"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Link>
          <ReprocessPendingButton pendingCount={pendingCount ?? 0} />
        </div>
      </header>

      {/* Filtros */}
      <form
        action="/admin/affiliates"
        method="GET"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-npb-border bg-npb-bg2 p-3"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou e-mail Kiwify…"
          className="flex-1 min-w-[200px] rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm text-npb-text placeholder:text-npb-text-muted focus:border-npb-gold-dim focus:outline-none"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm text-npb-text focus:border-npb-gold-dim focus:outline-none"
        >
          <option value="">Todos status</option>
          <option value="paid">Pagas</option>
          <option value="refunded">Reembolsadas</option>
          <option value="chargedback">Chargeback</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-npb-gold-light"
        >
          Filtrar
        </button>
        {(q || statusFilter) && (
          <Link
            href="/admin/affiliates"
            className="text-xs text-npb-text-muted hover:text-npb-text"
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Stats globais */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Vinculações"
          value={totalLinks}
          subtitle={`${verifiedLinks} verificadas`}
          color="text-npb-text"
        />
        <StatCard
          label="Vendas (todas)"
          value={totalSales}
          subtitle={
            orphanSales > 0
              ? `${orphanSales} órfã${orphanSales > 1 ? "s" : ""}`
              : "todas atribuídas"
          }
          color="text-npb-text"
        />
        <StatCard
          label="Comissão acumulada"
          value={`R$ ${formatBRL(totalCommission)}`}
          subtitle="só vendas pagas"
          color="text-npb-gold"
        />
        <StatCard
          label="Vendas órfãs"
          value={orphanSales}
          subtitle="email sem vinculação ou nome diferente"
          color={orphanSales > 0 ? "text-yellow-400" : "text-npb-text"}
        />
      </div>

      {/* Vinculações */}
      <section className="rounded-2xl border border-npb-border bg-npb-bg2">
        <header className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <h2 className="text-base font-bold text-npb-text">
            Vinculações ({links.length})
          </h2>
        </header>

        {links.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-npb-text-muted">
            Nenhum aluno vinculou Kiwify ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-npb-border bg-npb-bg3 text-left text-xs uppercase tracking-wider text-npb-text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Aluno</th>
                  <th className="px-4 py-2 font-semibold">E-mail Kiwify</th>
                  <th className="px-4 py-2 font-semibold">Nome cadastrado</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Vendas</th>
                  <th className="px-4 py-2 font-semibold">Comissão</th>
                  <th className="px-4 py-2 font-semibold">Cadastro</th>
                  <th className="px-4 py-2 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-npb-border">
                {links.map((l) => {
                  const u = usersMap.get(l.member_user_id);
                  const stats =
                    statsByEmail.get(l.kiwify_email.toLowerCase()) ?? {
                      count: 0,
                      commission: 0,
                      refunded: 0,
                    };
                  return (
                    <tr
                      key={l.id}
                      className="transition-colors hover:bg-npb-bg3/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-npb-text">
                          {u?.full_name ?? "—"}
                        </div>
                        <div className="text-xs text-npb-text-muted">
                          {u?.email ?? l.member_user_id}
                          {u?.role && u.role !== "student" && (
                            <span className="ml-1.5 rounded bg-npb-bg3 px-1 py-0.5 text-[9px]">
                              {u.role}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-npb-gold">
                        {l.kiwify_email}
                      </td>
                      <td className="px-4 py-3 text-xs text-npb-text-muted">
                        {l.kiwify_name}
                      </td>
                      <td className="px-4 py-3">
                        {l.verified ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Verificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                            <Clock className="h-2.5 w-2.5" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-npb-text">
                        {stats.count}
                        {stats.refunded > 0 && (
                          <span className="ml-1 text-xs text-red-400">
                            (−{stats.refunded})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-npb-gold">
                        R$ {formatBRL(stats.commission)}
                      </td>
                      <td className="px-4 py-3 text-xs text-npb-text-muted">
                        {formatDateBrt(l.registered_at)}
                      </td>
                      <td className="px-4 py-3">
                        <AffiliateRowActions
                          linkId={l.id}
                          verified={l.verified}
                          hasCpfCnpj={Boolean(l.cpf_cnpj_encrypted)}
                          cpfCnpjLast4={l.cpf_cnpj_last4}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Últimas vendas */}
      <section className="rounded-2xl border border-npb-border bg-npb-bg2">
        <header className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <h2 className="text-base font-bold text-npb-text">
            Últimas vendas ({sales.length})
          </h2>
          <span className="text-[10px] text-npb-text-muted">
            mostrando últimas 100
          </span>
        </header>

        {sales.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-npb-text-muted">
            <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-40" />
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-npb-border bg-npb-bg3 text-left text-xs uppercase tracking-wider text-npb-text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Quando</th>
                  <th className="px-4 py-2 font-semibold">Produto</th>
                  <th className="px-4 py-2 font-semibold">Afiliado (Kiwify)</th>
                  <th className="px-4 py-2 font-semibold">Aluno</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-right">
                    Comissão
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-npb-border">
                {sales.map((s) => {
                  const memberId = s.member_user_id;
                  const u = memberId ? usersMap.get(memberId) : null;
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-npb-bg3/50"
                    >
                      <td className="px-4 py-2 text-xs text-npb-text-muted whitespace-nowrap">
                        {formatShortBrt(s.approved_at)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {s.product_name ?? "(sem nome)"}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <div className="text-npb-gold">{s.kiwify_email}</div>
                        {s.kiwify_name && (
                          <div className="text-[10px] text-npb-text-muted">
                            {s.kiwify_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {u ? (
                          <span className="text-npb-text">
                            {u.full_name ?? u.email}
                          </span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                              órfã
                            </span>
                            <div className="text-[10px] text-npb-text-muted">
                              {s.kiwify_name ?? "(sem nome)"}
                              <br />
                              <span className="text-npb-gold">
                                {s.kiwify_email}
                              </span>
                            </div>
                            <AttachOrphanButton
                              saleId={s.id}
                              suggestedEmail={s.kiwify_email}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <SaleStatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        <span
                          className={
                            s.status === "paid"
                              ? "text-npb-gold"
                              : "text-red-400 line-through"
                          }
                        >
                          R$ {formatBRL(s.commission_value_cents)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-npb-border bg-npb-bg2 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-[10px] text-npb-text-muted">{subtitle}</p>
      )}
    </div>
  );
}

function SaleStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
        paga
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
        reembolsada
      </span>
    );
  }
  if (status === "chargedback") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
        chargeback
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold text-npb-text-muted">
      {status}
    </span>
  );
}
