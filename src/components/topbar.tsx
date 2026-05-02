import { Search } from "lucide-react";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { UserDropdown, type UserDropdownProps } from "@/components/user-dropdown";

interface TopbarProps {
  user: UserDropdownProps;
  showSearch?: boolean;
  searchPlaceholder?: string;
  notificationsCount?: number;
}

export function Topbar({
  user,
  showSearch = false,
  searchPlaceholder = "Pesquisar",
  notificationsCount = 0,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center gap-4 border-b border-[#222] bg-npb-bg2 px-6">
      <div className="ml-auto flex items-center gap-3.5">
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

        <NotificationsDropdown count={notificationsCount} />
        <UserDropdown {...user} />
      </div>
    </header>
  );
}
