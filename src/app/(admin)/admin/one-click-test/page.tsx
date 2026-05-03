import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { OneClickTestForm } from "@/components/admin/one-click-test-form";

export const dynamic = "force-dynamic";

export default function OneClickTestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <Sparkles className="h-5 w-5 text-npb-gold" />
          Teste de One-Click Login
        </h1>
        <p className="text-sm text-npb-text-muted">
          Gera um link mágico de 7 dias pra testar o fluxo que vai pelo
          WhatsApp via Unnichat. Use email novo (cria user fictício) ou
          existente (gera token sem mexer no profile).
        </p>
      </div>

      <OneClickTestForm />

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="mb-3 text-base font-bold text-npb-text">
          Como funciona em produção
        </h2>
        <ol className="space-y-2 text-sm text-npb-text-muted">
          <li>
            <strong className="text-npb-text">1.</strong> Aluno compra na
            Kiwify/Hotmart.
          </li>
          <li>
            <strong className="text-npb-text">2.</strong> Webhook
            (<code>POST /api/webhooks/enrollment</code>) cria o aluno na
            área de membros.
          </li>
          <li>
            <strong className="text-npb-text">3.</strong> A resposta JSON
            inclui <code>one_click_login_url</code> com link de 7d
            reutilizável.
          </li>
          <li>
            <strong className="text-npb-text">4.</strong> Unnichat lê esse
            campo do JSON de resposta e envia no WhatsApp do aluno.
          </li>
          <li>
            <strong className="text-npb-text">5.</strong> Aluno clica → cai em{" "}
            <code>/api/auth/one-click</code> → cria sessão → vai pra{" "}
            <code>/onboarding</code> (definir senha + foto) → depois{" "}
            <code>/dashboard</code>.
          </li>
          <li>
            <strong className="text-npb-text">6.</strong> Da segunda vez em
            diante, o link já não pede onboarding e cai direto no dashboard.
          </li>
        </ol>
      </div>
    </div>
  );
}
