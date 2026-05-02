import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { ensureUserXp, levelFromXp } from "@/lib/gamification";
import { StudentSidebar } from "@/components/student-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeModal } from "@/components/student/welcome-modal";
import { StudentMobileNav } from "@/components/student-mobile-nav";

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

  const [
    { count: notificationsCount },
    { data: notificationsRaw },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
    supabase
      .schema("membros")
      .from("notifications")
      .select("id, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const notificationsItems = (
    (notificationsRaw ?? []) as Array<{
      id: string;
      title: string;
      body: string | null;
      link: string | null;
      is_read: boolean;
      created_at: string;
    }>
  ).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));

  const settings = await getPlatformSettings(supabase);
  const showWelcome =
    settings.welcomeEnabled &&
    !profile?.welcome_accepted_at &&
    profile?.role === "student";

  // Carrega XP/streak pra mostrar no topbar (silent-fail se não der)
  let xpInfo:
    | {
        totalXp: number;
        level: number;
        levelLabel: string;
        progressPct: number;
        currentStreak: number;
      }
    | undefined;
  if (settings.gamificationEnabled) {
    try {
      const adminSb = createAdminClient();
      const xp = await ensureUserXp(adminSb, user.id);
      const lvl = levelFromXp(xp.total_xp);
      xpInfo = {
        totalXp: xp.total_xp,
        level: lvl.level,
        levelLabel: lvl.label,
        progressPct: lvl.progressPct,
        currentStreak: xp.current_streak,
      };
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-screen bg-npb-bg">
      {/* Sidebar fixa em desktop; em mobile fica oculta — abre via drawer no topbar */}
      <div className="hidden md:flex">
        <StudentSidebar
          platformName={settings.platformName}
          platformLogoUrl={settings.platformLogoUrl}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <Topbar
          user={{
            fullName: profile?.full_name ?? "",
            email: user.email ?? "",
            avatarUrl: profile?.avatar_url ?? null,
            isAdmin: profile?.role === "admin",
            isModerator: profile?.role === "moderator",
          }}
          currentUserId={user.id}
          notificationsCount={notificationsCount ?? 0}
          notificationsItems={notificationsItems}
          xp={xpInfo}
          mobileNav={
            <StudentMobileNav>
              <StudentSidebar
                platformName={settings.platformName}
                platformLogoUrl={settings.platformLogoUrl}
              />
            </StudentMobileNav>
          }
        />
        <main className="flex-1 overflow-y-auto npb-scrollbar p-4 md:p-8">
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
