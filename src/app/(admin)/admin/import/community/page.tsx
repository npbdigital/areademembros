import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { CircleImportPanel } from "@/components/admin/circle-import-panel";

export const dynamic = "force-dynamic";

export default function CircleImportPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <MessageCircle className="h-3.5 w-3.5" />
          Importar posts do Circle
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Migrar comunidade da Circle
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Sobe os 3 CSVs do export (posts, comments, members), revisa cada
          autor e cada post, aprova só o que quiser e o sistema importa.
          Nada entra sem você marcar. Posts do Felipe são automaticamente
          excluídos. Imagens hospedadas no Circle podem ser migradas pro nosso
          Storage no momento do import.
        </p>
      </header>

      <CircleImportPanel />
    </div>
  );
}
