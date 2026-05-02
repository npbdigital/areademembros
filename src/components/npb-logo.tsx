import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface NpbLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  /** Nome customizado da plataforma (default "Academia NPB"). */
  name?: string;
  /** URL de logo (PNG/SVG/WebP). Quando preenchida, substitui o escudo. */
  logoUrl?: string | null;
}

const sizes = {
  sm: { box: "h-9 w-9", icon: 18, text: "text-base" },
  md: { box: "h-12 w-12", icon: 24, text: "text-lg" },
  lg: { box: "h-14 w-14", icon: 28, text: "text-xl" },
};

/**
 * Logo Academia NPB — escudo dourado com gradiente.
 * Replica o ícone do design original (fa-shield-halved → Lucide Shield).
 */
export function NpbLogo({
  size = "md",
  showWordmark = false,
  className,
  name = "Academia NPB",
  logoUrl = null,
}: NpbLogoProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-[10px]",
          logoUrl ? "" : "text-white shadow-npb-gold bg-npb-gold-gradient",
          s.box,
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="h-full w-full object-contain"
          />
        ) : (
          <Shield size={s.icon} fill="currentColor" />
        )}
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              "font-bold tracking-tight text-npb-text",
              s.text,
            )}
          >
            {name}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-npb-text-muted">
            Área de Membros
          </span>
        </div>
      )}
    </div>
  );
}
