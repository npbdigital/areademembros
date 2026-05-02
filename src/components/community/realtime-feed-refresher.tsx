"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /**
   * Quando passado, escuta só posts dessa página específica. Sem isso,
   * escuta INSERTs de qualquer página (uso no /community/feed agregado).
   */
  pageId?: string;
  /**
   * Quando passado, escuta também novos comentários nesse tópico (usado no
   * detalhe do post pra atualizar contagem de replies em tempo real).
   */
  topicId?: string;
}

/**
 * Subscribe Supabase realtime — quando chega INSERT/UPDATE em
 * `community_topics` (filtra `page_id` se setado), chama `router.refresh()`.
 * Idem pra `community_replies` (filtra por `topic_id`).
 *
 * Componente sem render (retorna null). Inclua na page que quer auto-refresh.
 *
 * Limitações:
 * - Não filtra approved-only no canal — vai fazer refresh pra
 *   pendente/rejeitado também. Como o SSR já filtra, não vaza nada — só
 *   significa um refresh "desnecessário" aqui ou ali.
 * - Tabelas `community_topics` e `community_replies` precisam estar no
 *   `supabase_realtime` publication (já adicionadas via migration).
 */
export function RealtimeFeedRefresher({ pageId, topicId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(
      `community-feed-${pageId ?? "all"}-${topicId ?? "no-topic"}`,
    );

    // Tipos do supabase-js pra postgres_changes são complicados de
    // satisfazer — usamos cast pra `any` aqui e validamos via teste.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = channel as any;

    const topicFilter = pageId ? `page_id=eq.${pageId}` : undefined;
    ch.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "membros",
        table: "community_topics",
        ...(topicFilter ? { filter: topicFilter } : {}),
      },
      () => router.refresh(),
    );
    ch.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "membros",
        table: "community_topics",
        ...(topicFilter ? { filter: topicFilter } : {}),
      },
      () => router.refresh(),
    );

    if (topicId) {
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "membros",
          table: "community_replies",
          filter: `topic_id=eq.${topicId}`,
        },
        () => router.refresh(),
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pageId, topicId, router]);

  return null;
}
