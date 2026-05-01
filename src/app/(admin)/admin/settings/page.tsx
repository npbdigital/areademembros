import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = createClient();
  const settings = await getPlatformSettings(supabase);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Settings className="h-3.5 w-3.5" />
          Configurações
        </div>
        <h1 className="text-2xl font-bold text-npb-text">Whitelabel</h1>
        <p className="text-sm text-npb-text-muted">
          Identidade da plataforma, e-mail transacional e canais de suporte.
        </p>
      </header>

      <PlatformSettingsForm initialValues={settings} />
    </div>
  );
}
