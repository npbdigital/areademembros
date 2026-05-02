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

  // Apple touch icon: prefere logo customizado, senão SVG default.
  const appleIcon = logoUrl ?? "/pwa-icon.svg";

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
      icon: "/pwa-icon.svg",
      apple: appleIcon,
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
