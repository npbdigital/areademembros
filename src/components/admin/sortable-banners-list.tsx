"use client";

import { useTransition } from "react";
import { ExternalLink, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SortableList } from "@/components/admin/sortable-list";
import { BannerActiveToggle } from "@/components/admin/banner-active-toggle";
import { deleteBannerAction } from "@/app/(admin)/admin/courses/actions";

export interface SortableBanner {
  id: string;
  image_url: string;
  link_url: string | null;
  link_target: string | null;
  is_active: boolean;
  position: number;
}

interface Props {
  courseId: string;
  banners: SortableBanner[];
}

export function SortableBannersList({ courseId, banners }: Props) {
  return (
    <SortableList
      table="banners"
      items={banners}
      revalidatePaths={[`/admin/courses/${courseId}`, `/courses/${courseId}`]}
      className="space-y-2"
      renderItem={(b) => <BannerRowContent banner={b} courseId={courseId} />}
    />
  );
}

function BannerRowContent({
  banner,
  courseId,
}: {
  banner: SortableBanner;
  courseId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Excluir esse banner? Não dá pra desfazer.")) return;
    startTransition(async () => {
      try {
        await deleteBannerAction(banner.id, courseId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg3 p-3">
      <div className="h-14 w-44 flex-shrink-0 overflow-hidden rounded bg-npb-bg4">
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-npb-text-muted">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {banner.link_url ? (
          <a
            href={banner.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 truncate text-xs text-npb-text-muted hover:text-npb-gold"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{banner.link_url}</span>
          </a>
        ) : (
          <span className="text-xs italic text-npb-text-muted">Sem link</span>
        )}
        <div className="mt-1 text-[10px] uppercase tracking-wide text-npb-text-muted">
          {banner.link_target === "_self" ? "Mesma aba" : "Nova aba"}
        </div>
      </div>

      <BannerActiveToggle
        bannerId={banner.id}
        courseId={courseId}
        initialActive={banner.is_active}
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Excluir banner"
        aria-label="Excluir banner"
        className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
