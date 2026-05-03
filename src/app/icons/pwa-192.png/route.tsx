import { ImageResponse } from "next/og";

/**
 * Ícone PWA 192x192 PNG gerado dinamicamente. Necessário porque Chrome
 * Android rejeita ícones SVG no manifest pra qualificar como PWA
 * instalável (iOS/Desktop toleram SVG, Android exige PNG).
 *
 * Renderiza um escudo arredondado dourado com a letra "A" (Academia) no
 * meio — fallback quando admin não setou logo customizada.
 */
export const runtime = "edge";

export async function GET() {
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
    { width: 192, height: 192 },
  );
}
