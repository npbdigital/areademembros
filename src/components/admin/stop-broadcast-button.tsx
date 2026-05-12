"use client";

import { useTransition } from "react";
import { Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { stopBroadcastDeliveryAction } from "@/app/(admin)/admin/notifications/actions";

interface Props {
  broadcastId: string;
  title: string;
  channels: { banner: boolean; popup: boolean };
}

export function StopBroadcastButton({ broadcastId, title, channels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const labels: string[] = [];
  if (channels.banner) labels.push("barra fixa");
  if (channels.popup) labels.push("popup grande");
  const what = labels.join(" + ");

  function handleClick() {
    const ok = confirm(
      `Interromper "${title}"?\n\nIsso para de mostrar ${what} pra quem ainda não viu. ` +
        "Push e in-app não dá pra desfazer (já foram entregues no envio).",
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await stopBroadcastDeliveryAction(broadcastId);
      if (res.ok) {
        toast.success("Anúncio interrompido.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao interromper.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={`Interromper ${what}`}
      className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <StopCircle className="h-3 w-3" />
      )}
      Interromper
    </button>
  );
}
