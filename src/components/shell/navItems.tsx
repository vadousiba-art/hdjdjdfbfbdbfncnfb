import {
  Bell,
  Bookmark,
  Bot,
  Clapperboard,
  Compass,
  FolderHeart,
  House,
  MessageCircle,
  Moon,
  Orbit,
  Palette,
  Settings,
  ShieldCheck,
  TowerControl,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useOpenGates } from "@/lib/client/gates";
import { useShell } from "./AppShell";

export type NavItem = { href: string; label: string; icon: typeof House; badge?: number; group: "main" | "more" };

export const isStaff = (role?: string) => role === "owner" || role === "admin" || role === "moderator";

// Navigation, in the person's language. "main" is what the rail and bottom
// bar show; "more" lives behind the More menu. Collections, Creators and Pro
// appear once the Open Gates migration is on the database.
export function useNavItems(): NavItem[] {
  const { me } = useShell();
  const t = useT();
  const { available } = useOpenGates();
  const items: (NavItem | false)[] = [
    { href: "/", label: t("nav.home"), icon: House, group: "main" },
    { href: "/watch", label: t("nav.watch"), icon: Clapperboard, group: "main" },
    { href: "/explore", label: t("nav.explore"), icon: Compass, group: "main" },
    { href: "/atlas", label: t("nav.atlas"), icon: Orbit, group: "main" },
    { href: "/chat", label: t("nav.inbox"), icon: MessageCircle, badge: me.unread_messages, group: "main" },
    { href: "/notifications", label: t("nav.notifications"), icon: Bell, badge: me.unread_notifications, group: "main" },
    { href: `/u/${me.username}`, label: t("nav.profile"), icon: User, group: "main" },
    available && { href: "/creators", label: t("nav.creators"), icon: Palette, group: "more" },
    available && { href: "/collections", label: t("nav.collections"), icon: FolderHeart, group: "more" },
    { href: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, group: "more" },
    available && { href: "/pro", label: t("nav.pro"), icon: Moon, group: "more" },
    { href: "/menace", label: t("nav.menace"), icon: Bot, group: "more" },
    { href: "/chaos", label: t("nav.chaos"), icon: Zap, group: "more" },
    { href: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy, group: "more" },
    { href: "/standing", label: t("nav.standing"), icon: ShieldCheck, group: "more" },
    { href: "/settings", label: t("nav.settings"), icon: Settings, group: "more" },
    isStaff(me.role) && { href: "/admin", label: t("nav.watchtower"), icon: TowerControl, group: "more" },
  ];
  return items.filter(Boolean) as NavItem[];
}
