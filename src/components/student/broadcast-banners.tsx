import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { getActiveBannersForUser } from "@/lib/push";
import { DismissBannerButton } from "@/components/student/dismiss-banner-button";

/**
 * Server component. Carrega banners ativos do user (broadcasts com
 * `deliver_banner=true` que ele é elegível e ainda não dispensou) e
 * renderiza no topo de TODAS as telas via student layout.
 *
 * Múltiplos banners empilham (mais novos em cima). Cada um tem botão X
 * pra dispensar individualmente — chama DismissBannerButton (client).
 *
 * Visual: card dourado com margem lateral, cantos rounded-2xl, espaçamento
 * generoso no desktop. Mobile fica edge-to-edge sem margem pra economizar
 * espaço da tela. Quando broadcast tem `link`, renderiza CTA dourado com o
 * texto definido em `link_label` (default "Saiba mais").
 */
export async function BroadcastBanners({ userId }: { userId: string }) {
  const banners = await getActiveBannersForUser(userId);
  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-0 pt-2 md:px-6 md:pt-3">
      {banners.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 border-y border-npb-gold/30 bg-gradient-to-r from-npb-gold/15 via-npb-gold/10 to-npb-gold/15 px-4 py-3 text-sm shadow-sm md:rounded-2xl md:border md:px-5 md:py-4"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/20 md:h-10 md:w-10">
            <Megaphone className="h-4 w-4 text-npb-gold md:h-5 md:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {b.link ? (
              <Link href={b.link} className="block sm:pointer-events-none">
                <p className="font-semibold text-npb-text">{b.title}</p>
                {b.body && (
                  <p className="mt-0.5 text-xs text-npb-text-muted md:text-sm">
                    {b.body}
                  </p>
                )}
              </Link>
            ) : (
              <>
                <p className="font-semibold text-npb-text">{b.title}</p>
                {b.body && (
                  <p className="mt-0.5 text-xs text-npb-text-muted md:text-sm">
                    {b.body}
                  </p>
                )}
              </>
            )}
          </div>
          {b.link && (
            <Link
              href={b.link}
              className="hidden flex-shrink-0 items-center gap-1.5 rounded-full bg-npb-gold px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light sm:inline-flex md:text-sm"
            >
              {b.linkLabel?.trim() || "Saiba mais"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <DismissBannerButton broadcastId={b.id} />
        </div>
      ))}
    </div>
  );
}
