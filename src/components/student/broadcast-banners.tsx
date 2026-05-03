import Link from "next/link";
import { Megaphone } from "lucide-react";
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
 * Se broadcast tem `link`, o título vira clicável.
 */
export async function BroadcastBanners({ userId }: { userId: string }) {
  const banners = await getActiveBannersForUser(userId);
  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col">
      {banners.map((b) => (
        <div
          key={b.id}
          className="flex items-start gap-3 border-b border-npb-gold/30 bg-gradient-to-r from-npb-gold/15 via-npb-gold/10 to-npb-gold/15 px-4 py-2.5 text-sm md:px-6"
        >
          <Megaphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-npb-gold" />
          <div className="min-w-0 flex-1">
            {b.link ? (
              <Link
                href={b.link}
                className="font-semibold text-npb-text hover:text-npb-gold"
              >
                {b.title}
              </Link>
            ) : (
              <span className="font-semibold text-npb-text">{b.title}</span>
            )}
            {b.body && (
              <span className="ml-2 text-npb-text-muted">{b.body}</span>
            )}
          </div>
          <DismissBannerButton broadcastId={b.id} />
        </div>
      ))}
    </div>
  );
}
