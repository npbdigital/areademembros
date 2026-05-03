import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";

/**
 * Manifest dinâmico do PWA. Lê platform_settings (nome + logo) pra que o
 * app instalado fique com a identidade da plataforma. Quando admin troca
 * o nome ou logo em /admin/settings, o manifest reflete na próxima visita.
 *
 * Cache curto pra atualizar rapidamente sem bater no banco a cada request.
 */
export async function GET(request: Request) {
  let platformName = "Academia NPB";
  let logoUrl: string | null = null;

  try {
    const supabase = createClient();
    const settings = await getPlatformSettings(supabase);
    platformName = settings.platformName;
    logoUrl = settings.platformLogoUrl;
  } catch {
    // segue com defaults se não conseguir ler settings
  }

  const origin = new URL(request.url).origin;

  // Estratégia de ícones:
  //  - Se admin setou logo customizada (PNG/JPEG): usa ela (assumindo que é
  //    raster). Cobre a maioria dos clients OK.
  //  - Senão: usa nossos endpoints PNG dinâmicos /icons/pwa-{192,512}.png.
  //    Chrome Android REJEITA ícone SVG pra PWA install — por isso PNG é
  //    obrigatório pelo menos como fallback.
  const customIsRaster =
    logoUrl !== null && !logoUrl.toLowerCase().split("?")[0].endsWith(".svg");
  const icon192 = customIsRaster ? logoUrl! : `${origin}/icons/pwa-192.png`;
  const icon512 = customIsRaster ? logoUrl! : `${origin}/icons/pwa-512.png`;
  const iconType = customIsRaster ? guessImageType(logoUrl!) : "image/png";

  const manifest = {
    name: platformName,
    short_name:
      platformName.length > 12 ? platformName.slice(0, 12) : platformName,
    description: `${platformName} — Área de Membros`,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    lang: "pt-BR",
    dir: "ltr",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: iconType,
        purpose: "any",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: iconType,
        purpose: "any",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: iconType,
        purpose: "maskable",
      },
    ],
    categories: ["education"],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Cache 5min no browser, 1h no edge — admin verá atualização rápido
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}

function guessImageType(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}
