import { ImageResponse } from "next/og";

/** Ícone PWA 512x512 PNG (mesma identidade do 192). */
export const runtime = "edge";

export async function GET() {
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
    { width: 512, height: 512 },
  );
}
