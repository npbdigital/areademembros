import { Search } from "lucide-react";
import {
  NotificationsDropdown,
  type NotificationItem,
} from "@/components/notifications-dropdown";
import { UserDropdown, type UserDropdownProps } from "@/components/user-dropdown";
import { XpPill } from "@/components/xp-pill";

interface XpInfo {
  totalXp: number;
  level: number;
  levelLabel: string;
  progressPct: number;
  currentStreak: number;
}

interface TopbarProps {
  user: UserDropdownProps;
  /** ID do user atual — usado pelo NotificationsDropdown pra subscribe realtime. */
  currentUserId?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  notificationsCount?: number;
  notificationsItems?: NotificationItem[];
  /** Slot opcional para botão de menu mobile (renderizado à esquerda). */
  mobileNav?: React.ReactNode;
  /** Quando passado, renderiza o pill de XP entre o conteúdo central e o sino. */
  xp?: XpInfo;
}

export function Topbar({
  user,
  currentUserId,
  showSearch = false,
  searchPlaceholder = "Pesquisar",
  notificationsCount = 0,
  notificationsItems = [],
  mobileNav,
  xp,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center gap-3 border-b border-[#222] bg-npb-bg2 px-4 md:px-6">
      {mobileNav}
      <div className="ml-auto flex items-center gap-3.5">
        {xp && <XpPill {...xp} />}
        {showSearch && (
          <label className="hidden md:flex items-center gap-2 rounded-lg border border-npb-border bg-npb-bg3 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-npb-text-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-40 bg-transparent text-sm text-npb-text outline-none placeholder:text-npb-text-muted"
            />
          </label>
        )}

        <NotificationsDropdown
          currentUserId={currentUserId}
          count={notificationsCount}
          items={notificationsItems}
        />
        <UserDropdown {...user} />
      </div>
    </header>
  );
}
