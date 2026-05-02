import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { StudentSidebar } from "@/components/student-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeModal } from "@/components/student/welcome-modal";

export default async function StudentLayout({
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
    .select("full_name, avatar_url, role, welcome_accepted_at")
    .eq("id", user.id)
    .single();

  const { count: notificationsCount } = await supabase
    .schema("membros")
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const settings = await getPlatformSettings(supabase);
  const showWelcome =
    settings.welcomeEnabled &&
    !profile?.welcome_accepted_at &&
    profile?.role === "student";

  return (
    <div className="flex min-h-screen bg-npb-bg">
      <StudentSidebar
        platformName={settings.platformName}
        platformLogoUrl={settings.platformLogoUrl}
      />
      <div className="flex flex-1 flex-col pl-16">
        <Topbar
          user={{
            fullName: profile?.full_name ?? "",
            email: user.email ?? "",
            avatarUrl: profile?.avatar_url ?? null,
            isAdmin: profile?.role === "admin",
            isModerator: profile?.role === "moderator",
          }}
          notificationsCount={notificationsCount ?? 0}
        />
        <main className="flex-1 overflow-y-auto npb-scrollbar p-6 md:p-8">
          {children}
        </main>
      </div>
      {showWelcome && (
        <WelcomeModal
          title={settings.welcomeTitle}
          description={settings.welcomeDescription}
          videoId={settings.welcomeVideoId}
          terms={settings.welcomeTerms}
          buttonLabel={settings.welcomeButtonLabel}
        />
      )}
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
