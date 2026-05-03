import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";

/** Ícone PWA 512x512 — mesma identidade do 192. Redirect pro favicon
 *  customizado quando setado, senão gera default gold "A". */
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
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c9922a 0%, #a87a1d 100%)",
          color: "#1a1300",
          fontSize: 350,
          fontWeight: 900,
          fontFamily: "Georgia, serif",
          borderRadius: 100,
        }}
      >
        A
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    },
  );
}
