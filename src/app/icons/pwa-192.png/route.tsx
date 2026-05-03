import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";

/**
 * Ícone PWA 192x192. Quando admin setou `platform_favicon_url`, faz redirect
 * pra essa URL (browser/SW seguem o redirect transparentemente). Caso
 * contrário, gera default gold "A" via ImageResponse.
 *
 * Necessário porque Chrome Android rejeita SVG no manifest pra qualificar
 * como PWA instalável (iOS/Desktop toleram, Android exige raster).
 *
 * Cache curto pra refletir troca rápida do favicon pelo admin.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let faviconUrl: string | null = null;
  try {
    const supabase = createClient();
    const settings = await getPlatformSettings(supabase);
    faviconUrl = settings.platformFaviconUrl;
  } catch {
    // segue com default
  }

  if (faviconUrl) {
    return NextResponse.redirect(faviconUrl, {
      status: 302,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c9922a 0%, #a87a1d 100%)",
          color: "#1a1300",
          fontSize: 130,
          fontWeight: 900,
          fontFamily: "Georgia, serif",
          borderRadius: 38,
        }}
      >
        A
      </div>
    ),
    {
      width: 192,
      height: 192,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    },
  );
}
