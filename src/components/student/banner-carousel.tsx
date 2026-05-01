"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BannerItem {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  linkTarget: string;
}

interface Props {
  banners: BannerItem[];
}

export function BannerCarousel({ banners }: Props) {
  const [index, setIndex] = useState(0);
  const total = banners.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [total]);

  if (total === 0) return null;
  const current = banners[index];

  const Image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.imageUrl}
      alt=""
      className="h-full w-full object-cover"
    />
  );

  return (
    <div className="relative aspect-[16/5] overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2">
      {current.linkUrl ? (
        <a
          href={current.linkUrl}
          target={current.linkTarget || "_blank"}
          rel="noopener noreferrer"
          className="block h-full w-full"
        >
          {Image}
        </a>
      ) : (
        Image
      )}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % total)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-npb-gold" : "w-1.5 bg-white/50"
                }`}
                aria-label={`Ir para banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
