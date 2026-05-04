"use client";

import { createContext, useContext } from "react";
import { NpbLogo } from "@/components/npb-logo";

interface AuthLogoContextValue {
  loginLogoUrl: string | null;
  platformName: string;
}

const AuthLogoContext = createContext<AuthLogoContextValue>({
  loginLogoUrl: null,
  platformName: "Academia NPB",
});

/**
 * Provider colocado no layout do (auth) — recebe a logo customizada vinda
 * dos platform_settings (server-side fetch) e disponibiliza pra qualquer
 * page client filha via useAuthLogo().
 */
export function AuthLogoProvider({
  loginLogoUrl,
  platformName,
  children,
}: {
  loginLogoUrl: string | null;
  platformName: string;
  children: React.ReactNode;
}) {
  return (
    <AuthLogoContext.Provider value={{ loginLogoUrl, platformName }}>
      {children}
    </AuthLogoContext.Provider>
  );
}

export function useAuthLogo() {
  return useContext(AuthLogoContext);
}

/**
 * Componente da logo nas telas de auth (login/migracao/forgot/reset).
 * Quando admin configurou uma logo retangular em /admin/settings, mostra
 * a imagem (proporção horizontal preservada). Senão, fallback NpbLogo
 * dourado padrão.
 */
export function AuthLogo() {
  const { loginLogoUrl, platformName } = useAuthLogo();

  if (loginLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={loginLogoUrl}
        alt={platformName}
        className="block h-14 max-w-[280px] object-contain sm:h-16"
      />
    );
  }
  return <NpbLogo size="lg" />;
}
