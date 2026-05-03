import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  let platformName = "Academia NPB";
  let logoUrl: string | null = null;
  try {
    const supabase = createClient();
    const settings = await getPlatformSettings(supabase);
    platformName = settings.platformName;
    logoUrl = settings.platformLogoUrl;
  } catch {
    // segue com defaults
  }

  // Apple touch icon e favicon: usam o endpoint dinâmico /icons/pwa-192.png
  // que redireciona pro favicon customizado quando admin setou. logoUrl não
  // é referenciado aqui — logo é horizontal pra topbar/sidebar.
  void logoUrl;

  return {
    title: `${platformName} — Área de Membros`,
    description: `Plataforma de cursos e conteúdo de ${platformName}`,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: platformName,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [
        { url: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icons/pwa-192.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
