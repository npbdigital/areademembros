"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, MoreVertical, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type InstallState =
  | "loading"
  | "installed"
  | "promptable"
  | "ios"
  | "android-manual"
  | "desktop-manual"
  | "unsupported";

/**
 * Botão de instalar PWA. Comportamento:
 * - Chrome/Edge/Android: captura `beforeinstallprompt` → click dispara prompt nativo
 * - iOS Safari: sem evento; abre modal explicando "Compartilhar → Adicionar à Tela"
 * - Já instalado (display-mode standalone): mostra check "Instalado"
 * - Browser sem suporte: oculta o botão (retorna null)
 *
 * Registra o service worker uma vez no mount (idempotente).
 */
export function PwaInstallButton({ className }: { className?: string }) {
  const [state, setState] = useState<InstallState>("loading");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [androidModalOpen, setAndroidModalOpen] = useState(false);
  const [desktopModalOpen, setDesktopModalOpen] = useState(false);

  // Registra SW (idempotente — browser ignora se já registrado)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // sem SW = não instalável; UI vai pra "unsupported"
      });
  }, []);

  // Detecta estado do PWA
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Já está rodando como app instalado?
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS marca via navigator.standalone
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setState("installed");
      return;
    }

    // iOS Safari não dispara beforeinstallprompt — detecta pra mostrar modal
    const ua = window.navigator.userAgent;
    const isIosSafari =
      /iPhone|iPad|iPod/.test(ua) &&
      !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIosSafari) {
      setState("ios");
      return;
    }

    // Chrome/Edge/Android — escuta o evento. Pode demorar (Chrome exige
    // critérios de engagement antes de disparar — ~30s + visita prévia).
    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState("promptable");
    };
    const onInstalled = () => {
      setState("installed");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Fallback: detecta plataforma pra mostrar instruções manuais quando o
    // browser não dispara o evento. Antes a gente escondia após 3s — Chrome
    // pode demorar muito mais e o user perdia o acesso ao botão.
    const isAndroid = /Android/i.test(ua);
    const isMobile = /Mobi|Android/i.test(ua);
    const fallbackTimer = window.setTimeout(() => {
      setState((s) => {
        if (s !== "loading") return s;
        if (isAndroid) return "android-manual";
        if (isMobile) return "unsupported"; // outros mobiles sem suporte
        return "desktop-manual";
      });
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  async function handleClick() {
    if (state === "ios") {
      setIosModalOpen(true);
      return;
    }
    if (state === "android-manual") {
      setAndroidModalOpen(true);
      return;
    }
    if (state === "desktop-manual") {
      setDesktopModalOpen(true);
      return;
    }
    if (state === "promptable" && deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setState("installed");
      }
      setDeferredPrompt(null);
    }
  }

  // Sem suporte ou ainda carregando — não renderiza
  if (state === "loading" || state === "unsupported") return null;

  if (state === "installed") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-green-400",
          className,
        )}
      >
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">App instalado</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
          className,
        )}
      >
        <Download className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">Instalar aplicativo</span>
      </button>

      {iosModalOpen && <IosInstructionsModal onClose={() => setIosModalOpen(false)} />}
      {androidModalOpen && (
        <AndroidInstructionsModal onClose={() => setAndroidModalOpen(false)} />
      )}
      {desktopModalOpen && (
        <DesktopInstructionsModal onClose={() => setDesktopModalOpen(false)} />
      )}
    </>
  );
}

function IosInstructionsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <h2 className="text-base font-bold text-npb-text">
            Instalar no iPhone/iPad
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-4 p-5 text-sm text-npb-text">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/20 text-xs font-bold text-npb-gold">
              1
            </span>
            <span>
              Toque no botão de{" "}
              <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-npb-text">
                <Share className="h-3 w-3" /> Compartilhar
              </span>{" "}
              na barra inferior do Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/20 text-xs font-bold text-npb-gold">
              2
            </span>
            <span>
              Role pra baixo e selecione{" "}
              <strong className="text-npb-gold">
                Adicionar à Tela de Início
              </strong>
              .
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/20 text-xs font-bold text-npb-gold">
              3
            </span>
            <span>
              Confirme em <strong className="text-npb-gold">Adicionar</strong>.
              O ícone aparece na sua tela.
            </span>
          </li>
        </ol>
        <div className="border-t border-npb-border bg-npb-bg3 px-5 py-3 text-[11px] text-npb-text-muted">
          Funciona apenas no Safari (não no Chrome iOS).
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ManualInstallModal({
  title,
  steps,
  footer,
  onClose,
}: {
  title: string;
  steps: React.ReactNode[];
  footer: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <h2 className="text-base font-bold text-npb-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-4 p-5 text-sm text-npb-text">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-npb-gold/20 text-xs font-bold text-npb-gold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="border-t border-npb-border bg-npb-bg3 px-5 py-3 text-[11px] text-npb-text-muted">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AndroidInstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <ManualInstallModal
      onClose={onClose}
      title="Instalar no Android"
      footer="Funciona melhor no Chrome. Se nada aparecer, navegue um pouco pela plataforma e tente de novo — Chrome libera a opção após você usar o site."
      steps={[
        <span key="1">
          Toque no botão{" "}
          <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-npb-text">
            <MoreVertical className="h-3 w-3" /> menu
          </span>{" "}
          (3 pontinhos no canto superior direito do Chrome).
        </span>,
        <span key="2">
          Selecione{" "}
          <strong className="text-npb-gold">Instalar app</strong> ou{" "}
          <strong className="text-npb-gold">Adicionar à tela inicial</strong>.
        </span>,
        <span key="3">
          Confirme em <strong className="text-npb-gold">Instalar</strong>. O
          atalho aparece na sua tela como um app.
        </span>,
      ]}
    />
  );
}

function DesktopInstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <ManualInstallModal
      onClose={onClose}
      title="Instalar no computador"
      footer="Disponível em Chrome, Edge e Brave. Firefox não tem instalação de PWA."
      steps={[
        <span key="1">
          Procure o ícone <strong className="text-npb-gold">⊕</strong> ou{" "}
          <strong className="text-npb-gold">monitor com seta</strong> no canto
          direito da barra de endereço.
        </span>,
        <span key="2">
          Se não aparecer, abra o menu{" "}
          <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-npb-text">
            <MoreVertical className="h-3 w-3" /> ⋮
          </span>{" "}
          e procure{" "}
          <strong className="text-npb-gold">Instalar Academia NPB…</strong>
        </span>,
        <span key="3">
          Clique em <strong className="text-npb-gold">Instalar</strong> e o
          app abre numa janela própria, separada do navegador.
        </span>,
      ]}
    />
  );
}
