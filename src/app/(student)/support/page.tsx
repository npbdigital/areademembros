import { AtSign, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import {
  SupportForm,
  type SupportEnrollmentOption,
} from "@/components/student/support-form";

export const dynamic = "force-dynamic";

const FALLBACK_WHATSAPP = "5548988757616";
const FALLBACK_EMAIL = "suporte@felipesempe.com.br";

export default async function SupportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getPlatformSettings(supabase);

  // Matrículas ativas pra montar o select de "sobre qual curso"
  const nowIso = new Date().toISOString();
  const { data: enrollmentsRaw } = await supabase
    .schema("membros")
    .from("enrollments")
    .select("id, cohorts(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("enrolled_at", { ascending: false });

  const enrollments: SupportEnrollmentOption[] = (
    (enrollmentsRaw ?? []) as unknown as Array<{
      id: string;
      cohorts: { name: string } | { name: string }[] | null;
    }>
  )
    .map((e) => {
      const c = Array.isArray(e.cohorts) ? e.cohorts[0] : e.cohorts;
      if (!c) return null;
      return { id: e.id, label: c.name };
    })
    .filter((x): x is SupportEnrollmentOption => x !== null);

  const supportEmail = settings.supportEmail?.trim() || FALLBACK_EMAIL;
  const whatsappRaw = settings.supportWhatsapp?.trim() || FALLBACK_WHATSAPP;
  const whatsappDigits = whatsappRaw.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappDigits}`;
  const whatsappDisplay = formatWhatsAppDisplay(whatsappDigits);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <AtSign className="h-3.5 w-3.5" />
          Suporte
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Como podemos te ajudar?
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Use o WhatsApp para uma resposta mais rápida ou envie um pedido por
          e-mail abaixo.
        </p>
      </header>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-2xl border border-green-500/30 bg-green-500/5 p-5 transition hover:border-green-500/60 hover:bg-green-500/10"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-400">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-400">
            WhatsApp
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-npb-text">
            {whatsappDisplay}
          </h3>
          <p className="text-xs text-npb-text-muted">
            Abre uma conversa direto com o time de suporte.
          </p>
        </div>
      </a>

      <section>
        <h2 className="mb-3 text-lg font-bold text-npb-text">Enviar e-mail</h2>
        <p className="mb-4 text-xs text-npb-text-muted">
          Sua mensagem chega em <code>{supportEmail}</code>. Vamos responder no
          seu e-mail cadastrado.
        </p>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <SupportForm enrollments={enrollments} />
        </div>
      </section>
    </div>
  );
}

function formatWhatsAppDisplay(digits: string): string {
  // +55 (48) 98875-7616
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}
