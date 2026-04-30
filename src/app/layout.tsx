import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academia NPB — Área de Membros",
  description: "Plataforma de cursos e conteúdo da No Plan B Digital",
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
