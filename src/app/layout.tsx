import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = createClient();
    const settings = await getPlatformSettings(supabase);
    return {
      title: `${settings.platformName} — Área de Membros`,
      description: `Plataforma de cursos e conteúdo de ${settings.platformName}`,
    };
  } catch {
    return {
      title: "Área de Membros",
      description: "Plataforma de cursos e conteúdo",
    };
  }
}

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
