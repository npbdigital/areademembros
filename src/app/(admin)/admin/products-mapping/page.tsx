import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  PackageCheck,
  Pencil,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ProductMappingRow } from "@/components/admin/product-mapping-row";
import { AutoEnrollmentToggle } from "@/components/admin/auto-enrollment-toggle";
import { AddManualProductMapping } from "@/components/admin/add-manual-product-mapping";

export const dynamic = "force-dynamic";

interface DiscoveredProduct {
  product_name: string;
  total_sales: number;
  platforms: string[];
  last_sale_date: string | null;
}

interface MappingRow {
  product_name_pattern: string;
  cohort_id: string | null;
  default_expires_days: number | null;
}

export default async function ProductsMappingPage() {
  const sb = createAdminClient();

  const [
    { data: rawTx },
    { data: mappingsRaw },
    { data: cohortsRaw },
    { data: settingsRaw },
    { count: unmappedCount },
    { count: pendingCount },
  ] = await Promise.all([
    // Auto-descoberta: produtos únicos vendidos nos últimos 90d.
    // Direto da tabela public.transactions_data — agregamos no JS pq o
    // distinct + count cross-platform fica feio em supabase-js.
    sb
      .from("transactions_data")
      .select("product_name, platform, date")
      .gte(
        "date",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .eq("event", "Compra Aprovada")
      .not("product_name", "is", null)
      .limit(50000),
    sb
      .schema("membros")
      .from("product_cohort_map")
      .select("product_name_pattern, cohort_id, default_expires_days")
      .eq("is_active", true),
    sb
      .schema("membros")
      .from("cohorts")
      .select("id, name, default_duration_days")
      .order("name"),
    sb
      .schema("membros")
      .from("platform_settings")
      .select("value")
      .eq("key", "auto_enrollment_enabled")
      .maybeSingle(),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "unmapped"),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // Agrega produtos únicos cross-platform
  const map = new Map<string, DiscoveredProduct>();
  for (const r of (rawTx ?? []) as Array<{
    product_name: string;
    platform: string;
    date: string;
  }>) {
    const key = r.product_name.toLowerCase().trim();
    const cur = map.get(key) ?? {
      product_name: key,
      total_sales: 0,
      platforms: [],
      last_sale_date: null,
    };
    cur.total_sales += 1;
    if (!cur.platforms.includes(r.platform)) cur.platforms.push(r.platform);
    if (!cur.last_sale_date || r.date > cur.last_sale_date) {
      cur.last_sale_date = r.date;
    }
    map.set(key, cur);
  }
  const discovered = Array.from(map.values()).sort(
    (a, b) => b.total_sales - a.total_sales,
  );

  const mappings = (mappingsRaw ?? []) as MappingRow[];
  const cohorts = (cohortsRaw ?? []) as Array<{
    id: string;
    name: string;
    default_duration_days: number | null;
  }>;
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const mapByProduct = new Map<string, MappingRow>();
  for (const m of mappings) {
    mapByProduct.set(m.product_name_pattern.toLowerCase(), m);
  }

  const autoEnabled =
    ((settingsRaw as { value: string } | null)?.value ?? "false") === "true";

  const mappedProducts = discovered.filter((p) =>
    mapByProduct.has(p.product_name),
  );
  const unmappedProducts = discovered.filter(
    (p) => !mapByProduct.has(p.product_name),
  );

  // Mappings manuais — produtos no product_cohort_map que NÃO apareceram
  // em transactions_data nos ultimos 90d (ex: M20K, LTA 1.0, ofertas
  // antigas). Mostramos numa secao separada pra ficar claro que sao
  // configurados na mao.
  const discoveredKeys = new Set(discovered.map((d) => d.product_name));
  const manualOnlyMappings = mappings
    .filter((m) => !discoveredKeys.has(m.product_name_pattern.toLowerCase()))
    .map((m) => ({
      product_name: m.product_name_pattern.toLowerCase(),
      total_sales: 0,
      platforms: [] as string[],
      last_sale_date: null,
    }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <PackageCheck className="h-3.5 w-3.5" />
          Produtos → Turmas
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Liberação automática de acesso
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Mapeie cada produto vendido (Kiwify, Hubla, Payt, Youshop) pra a
          turma onde o aluno deve ser matriculado. Quando uma compra for
          aprovada, o sistema cria o cadastro do aluno e libera acesso
          automaticamente em ~5 segundos. Reembolso/cancelamento desativa o
          acesso na hora.
        </p>
      </header>

      {/* Adicionar produto manualmente (pra produtos fora de transactions_data) */}
      <AddManualProductMapping cohorts={cohorts} />

      {/* Toggle global */}
      <AutoEnrollmentToggle
        enabled={autoEnabled}
        unmappedProductsCount={unmappedProducts.length}
        unmappedSalesCount={unmappedCount ?? 0}
        pendingSalesCount={pendingCount ?? 0}
      />

      {/* Vendas pendentes de mapeamento */}
      {(unmappedCount ?? 0) > 0 && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-bold text-yellow-400">
                {unmappedCount} venda{(unmappedCount ?? 0) === 1 ? "" : "s"}{" "}
                aprovada{(unmappedCount ?? 0) === 1 ? "" : "s"} sem cadastro
              </p>
              <p className="mt-1 text-xs text-npb-text-muted">
                Há vendas que chegaram pra produtos ainda não mapeados abaixo.
                Mapeie o produto e elas serão processadas automaticamente. Pra
                ver detalhes ou aprovar manualmente,{" "}
                <Link
                  href="/admin/access-logs?status=unmapped"
                  className="text-npb-gold hover:underline"
                >
                  abra os logs de acesso
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Produtos não mapeados */}
      {unmappedProducts.length > 0 && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-yellow-400">
            <TriangleAlert className="h-4 w-4" />
            Não mapeados ({unmappedProducts.length})
          </h2>
          <ul className="space-y-2">
            {unmappedProducts.map((p) => (
              <ProductMappingRow
                key={p.product_name}
                product={p}
                mapping={null}
                cohorts={cohorts}
                cohortMap={cohortMap}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Produtos mapeados */}
      {mappedProducts.length > 0 && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Mapeados ({mappedProducts.length})
          </h2>
          <ul className="space-y-2">
            {mappedProducts.map((p) => (
              <ProductMappingRow
                key={p.product_name}
                product={p}
                mapping={mapByProduct.get(p.product_name) ?? null}
                cohorts={cohorts}
                cohortMap={cohortMap}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Mappings manuais (produtos sem venda em transactions_data) */}
      {manualOnlyMappings.length > 0 && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-npb-text-muted">
            <Pencil className="h-4 w-4" />
            Manuais — sem vendas em transactions_data ({manualOnlyMappings.length})
          </h2>
          <p className="text-[11px] text-npb-text-muted">
            Mapeados manualmente. Funcionam pra vendas que chegam pelo
            webhook <code>kiwify-direct</code> ou que serão importadas no
            futuro pra <code>transactions_data</code>.
          </p>
          <ul className="space-y-2">
            {manualOnlyMappings.map((p) => (
              <ProductMappingRow
                key={p.product_name}
                product={p}
                mapping={mapByProduct.get(p.product_name) ?? null}
                cohorts={cohorts}
                cohortMap={cohortMap}
              />
            ))}
          </ul>
        </section>
      )}

      {discovered.length === 0 && manualOnlyMappings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/40 p-10 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-npb-text-muted opacity-40" />
          <p className="mt-3 text-sm text-npb-text-muted">
            Nenhuma venda detectada nos últimos 90 dias. Quando suas
            plataformas (Kiwify/Hubla/Payt/Youshop) começarem a registrar
            vendas em <code>public.transactions_data</code>, elas aparecem
            aqui automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
