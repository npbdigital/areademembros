import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { ensureUserXp, levelFromXp } from "@/lib/gamification";
import { StudentSidebar } from "@/components/student-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeModal } from "@/components/student/welcome-modal";
import { StudentMobileNav } from "@/components/student-mobile-nav";
import { StudentChromeWrapper } from "@/components/student-chrome-wrapper";
import { PushPermissionPrompt } from "@/components/push-permission-prompt";
import { BroadcastBanners } from "@/components/student/broadcast-banners";
import { AchievementCelebrationListener } from "@/components/student/achievement-celebration";

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
    .select(
      "full_name, avatar_url, role, welcome_accepted_at, equipped_decoration_id",
    )
    .eq("id", user.id)
    .single();

  // Resolve URL da decoração equipada (pra desenhar em volta do avatar do topbar)
  let equippedDecorationUrl: string | null = null;
  const equippedId = (
    profile as { equipped_decoration_id?: string | null } | null
  )?.equipped_decoration_id;
  if (equippedId) {
    const { data: deco } = await createAdminClient()
      .schema("membros")
      .from("avatar_decorations")
      .select("image_url, is_active")
      .eq("id", equippedId)
      .maybeSingle();
    const d = deco as { image_url: string | null; is_active: boolean } | null;
    if (d?.is_active && d.image_url) equippedDecorationUrl = d.image_url;
  }

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

  // Carrega XP/streak pra mostrar no topbar (silent-fail se não der).
  // Admin não tem gamification — não faz sentido pra quem gerencia a plataforma.
  const isAdminUser = profile?.role === "admin";
  let xpInfo:
    | {
        totalXp: number;
        level: number;
        levelLabel: string;
        levelIconUrl: string;
        progressPct: number;
        currentStreak: number;
      }
    | undefined;
  if (settings.gamificationEnabled && !isAdminUser) {
    try {
      const adminSb = createAdminClient();
      const xp = await ensureUserXp(adminSb, user.id);
      const lvl = levelFromXp(xp.total_xp, xp.min_level ?? 1);
      xpInfo = {
        totalXp: xp.total_xp,
        level: lvl.level,
        levelLabel: lvl.label,
        levelIconUrl: lvl.iconUrl,
        progressPct: lvl.progressPct,
        currentStreak: xp.current_streak,
      };
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-screen bg-npb-bg">
      {/* Em /community/* o desktop esconde a StudentSidebar e tira o padding
          equivalente — a CommunitySidebar fica como sidebar única. */}
      <StudentChromeWrapper
        sidebar={
          <StudentSidebar
            platformName={settings.platformName}
            platformLogoUrl={settings.platformLogoUrl}
          />
        }
        mainArea={
          <>
            <Topbar
              user={{
                fullName: profile?.full_name ?? "",
                email: user.email ?? "",
                avatarUrl: profile?.avatar_url ?? null,
                decorationUrl: equippedDecorationUrl,
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
            {/* Banners fixos de broadcast (admin pode disparar via /admin/notifications/broadcast). Cada um tem X pra dispensar — somem só pra esse user. */}
            <BroadcastBanners userId={user.id} />
            <main className="flex-1 overflow-y-auto npb-scrollbar p-4 md:p-8">
              {children}
            </main>
          </>
        }
      />
      {showWelcome && (
        <WelcomeModal
          title={settings.welcomeTitle}
          description={settings.welcomeDescription}
          videoId={settings.welcomeVideoId}
          terms={settings.welcomeTerms}
          buttonLabel={settings.welcomeButtonLabel}
        />
      )}
      <PushPermissionPrompt
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        enabled={settings.pushNotificationsEnabled}
      />
      {settings.gamificationEnabled && (
        <AchievementCelebrationListener userId={user.id} />
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
