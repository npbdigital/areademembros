import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Export CSV de vendas Kiwify. Respeita os mesmos filtros (?q, ?status) da
 * página /admin/affiliates. Gate: só admin.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return new NextResponse("Sem permissão.", { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "";

  const sb = createAdminClient();
  let query = sb
    .schema("afiliados")
    .from("sales")
    .select(
      "external_order_id, kiwify_email, kiwify_name, member_user_id, product_name, status, commission_value_cents, gross_value_cents, payment_method, approved_at, created_at",
    )
    .eq("source", "kiwify");

  if (status && ["paid", "refunded", "chargedback"].includes(status)) {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.or(`kiwify_email.ilike.%${q}%,kiwify_name.ilike.%${q}%`);
  }
  query = query.order("approved_at", { ascending: false }).limit(5000);

  const { data: salesData } = await query;
  const sales = (salesData ?? []) as Array<{
    external_order_id: string;
    kiwify_email: string;
    kiwify_name: string | null;
    member_user_id: string | null;
    product_name: string | null;
    status: string;
    commission_value_cents: number;
    gross_value_cents: number | null;
    payment_method: string | null;
    approved_at: string | null;
    created_at: string;
  }>;

  // Hidrata aluno por user_id
  const userIds = Array.from(
    new Set(sales.map((s) => s.member_user_id).filter((x): x is string => !!x)),
  );
  const usersMap = new Map<string, { email: string; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: users } = await sb
      .schema("membros")
      .from("users")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const u of (users ?? []) as Array<{
      id: string;
      email: string;
      full_name: string | null;
    }>) {
      usersMap.set(u.id, { email: u.email, full_name: u.full_name });
    }
  }

  const headers = [
    "approved_at_brt",
    "order_id",
    "kiwify_email",
    "kiwify_name",
    "aluno_email",
    "aluno_nome",
    "produto",
    "status",
    "comissao_brl",
    "valor_total_brl",
    "metodo_pagamento",
  ];

  const rows = sales.map((s) => {
    const u = s.member_user_id ? usersMap.get(s.member_user_id) : null;
    const approvedBrt = s.approved_at
      ? new Date(s.approved_at).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    return [
      approvedBrt,
      s.external_order_id,
      s.kiwify_email,
      s.kiwify_name ?? "",
      u?.email ?? "",
      u?.full_name ?? "",
      s.product_name ?? "",
      s.status,
      (s.commission_value_cents / 100).toFixed(2).replace(".", ","),
      ((s.gross_value_cents ?? 0) / 100).toFixed(2).replace(".", ","),
      s.payment_method ?? "",
    ];
  });

  const csv = [headers, ...rows].map(toCsvLine).join("\n");
  // BOM pro Excel reconhecer UTF-8
  const body = "﻿" + csv;

  const fileName = `vendas-afiliados-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function toCsvLine(cells: string[]): string {
  return cells
    .map((c) => {
      const s = String(c ?? "");
      // Sempre escapa: aspas duplas + quote se tiver vírgula/aspa/quebra
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}
