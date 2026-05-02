"use client";

import { usePathname } from "next/navigation";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";

interface Props {
  children: React.ReactNode;
}

/**
 * Wrapper do hamburger principal. Esconde quando o usuário está dentro de
 * /community/*, porque lá a CommunityMobileBar mostra o seu próprio
 * hamburger (com os espaços + link "Voltar ao menu principal" no topo).
 *
 * Evita ter dois hamburgers empilhados no mobile da comunidade.
 */
export function StudentMobileNav({ children }: Props) {
  const pathname = usePathname();
  if (pathname?.startsWith("/community")) return null;
  return <MobileNavToggle ariaLabel="Abrir menu">{children}</MobileNavToggle>;
}
