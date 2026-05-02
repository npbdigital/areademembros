import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const settings = await getPlatformSettings(supabase);

  return (
    <div className="flex min-h-screen bg-npb-bg">
      {/* Sidebar fixa em desktop; em mobile fica oculta — abre via drawer no topbar */}
      <div className="hidden md:flex">
        <AdminSidebar
          platformName={settings.platformName}
          platformLogoUrl={settings.platformLogoUrl}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <Topbar
          user={{
            fullName: profile.full_name ?? "",
            email: user.email ?? "",
            avatarUrl: profile.avatar_url ?? null,
            isAdmin: true,
          }}
          currentUserId={user.id}
          mobileNav={
            <MobileNavToggle ariaLabel="Abrir menu admin">
              <AdminSidebar
                platformName={settings.platformName}
                platformLogoUrl={settings.platformLogoUrl}
              />
            </MobileNavToggle>
          }
        />
        <main className="flex-1 overflow-y-auto npb-scrollbar p-4 md:p-8">
          {children}
        </main>
      </div>
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
  );
}
