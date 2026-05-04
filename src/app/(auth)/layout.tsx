import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { AuthLogoProvider } from "@/components/auth-logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetcha settings server-side e injeta no contexto pra <AuthLogo /> nas
  // pages filhas (que sao client components) usar.
  const supabase = createClient();
  const settings = await getPlatformSettings(supabase);

  return (
    <AuthLogoProvider
      loginLogoUrl={settings.loginLogoUrl}
      platformName={settings.platformName}
    >
      <div className="relative flex min-h-screen items-center justify-center bg-npb-bg p-6 overflow-hidden">
        {/* Glow dourado sutil de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(201,146,42,0.4) 0%, transparent 70%)",
          }}
        />
        <div className="relative w-full max-w-md">{children}</div>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e1e1e",
              border: "1px solid #2a2a2a",
              color: "#f0f0f0",
            },
          }}
        />
      </div>
    </AuthLogoProvider>
  );
}
