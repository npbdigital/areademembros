/**
 * Avatar com decoração sobreposta (estilo Discord).
 *
 * Renderiza:
 *   - Container relativo
 *   - Avatar circular abaixo (z-0). Se não tiver `src`, mostra inicial do nome.
 *   - PNG da decoração absoluta sobreposta (z-1, ~30% maior pra "abraçar"
 *     o avatar). Centro da decoração tem que ser TRANSPARENTE pro avatar
 *     passar por baixo.
 *
 * Server-friendly — não usa hooks, só JSX. Pode ser usado em RSC.
 */

interface Props {
  src?: string | null;
  decorationUrl?: string | null;
  name?: string | null;
  /** Tamanho do avatar em pixels (decoração escala automático). */
  size?: number;
  className?: string;
}

export function DecoratedAvatar({
  src,
  decorationUrl,
  name,
  size = 36,
  className,
}: Props) {
  // Decoração estende ~30% além do avatar pra cobrir as bordas
  const decoSize = Math.round(size * 1.3);
  const decoOffset = Math.round((decoSize - size) / 2);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div
      className={`relative flex-shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {/* Avatar base (z-0) */}
      <div
        className="relative z-0 overflow-hidden rounded-full bg-npb-bg3"
        style={{ width: size, height: size }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-bold text-npb-gold"
            style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Decoração sobreposta (z-1) */}
      {decorationUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={decorationUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute z-10 select-none"
          style={{
            width: decoSize,
            height: decoSize,
            top: -decoOffset,
            left: -decoOffset,
          }}
        />
      )}
    </div>
  );
}
