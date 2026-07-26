import { Dumbbell, House, ScanFace, ListChecks, Settings, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  /** Sidebar label. */
  label: string;
  /** Tab-bar label — has to survive a fifth of a phone's width. */
  short: string;
  icon: LucideIcon;
  /** The one destination that gets the raised centre slot in the tab bar. */
  primary?: boolean;
}

/**
 * The app's primary destinations, in tab order. Shared by the desktop
 * sidebar and the mobile tab bar so the two can never drift apart — and
 * ordered for the tab bar, which raises the primary action out of the middle
 * of the row, inside easy thumb reach.
 */
export const NAV_ITEMS: NavItem[] = [
  // "Home", not "Dashboard": on a phone this screen answers "what should I
  // do today?", which is a different job from a desktop dashboard's wall of
  // readouts. The route keeps its original path.
  { href: "/dashboard", label: "Home", short: "Home", icon: House },
  // Also the parent of /scans/[scanId], so viewing any past result keeps
  // "Progress" highlighted rather than leaving the nav with nothing active.
  { href: "/scans", label: "Progress", short: "Progress", icon: TrendingUp },
  { href: "/check-in", label: "Check-in", short: "Scan", icon: ScanFace, primary: true },
  { href: "/routine", label: "Routine", short: "Routine", icon: ListChecks },
  // Next to Routine on purpose: both are "do the work today" screens, as
  // opposed to the measuring the two on the left do.
  { href: "/face-gym", label: "Face Gym", short: "Gym", icon: Dumbbell },
  { href: "/settings", label: "Settings", short: "You", icon: Settings },
];

/** Root-level destinations, used to tell a tab from a pushed sub-screen. */
export const ROOT_PATHS = NAV_ITEMS.map((item) => item.href);

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * True when `pathname` is a screen pushed on top of a tab (a scan result, a
 * comparison, billing) rather than a tab root. Those get a back affordance
 * and an edge-swipe-to-go-back gesture; tab roots don't.
 */
export function isSubScreen(pathname: string) {
  return !ROOT_PATHS.includes(pathname);
}

/**
 * The tab root a sub-screen belongs to — where "back" should land when
 * there's no in-app history to pop (a deep link, a shared URL, a PWA cold
 * start on a scan result).
 */
export function parentPath(pathname: string) {
  const parent = pathname.replace(/\/[^/]+\/?$/, "");
  return ROOT_PATHS.includes(parent) ? parent : "/dashboard";
}

/**
 * Tab order for the horizontal swipe gesture between tab roots.
 *
 * The check-in tab is deliberately absent: it opens the camera, which isn't
 * somewhere you want to land by flicking sideways. Swiping therefore moves
 * Home ↔ Progress ↔ Routine ↔ Settings, and taking a scan stays an explicit
 * tap on the raised centre button.
 */
export const SWIPE_PATHS = NAV_ITEMS.filter((item) => !item.primary).map((item) => item.href);

/**
 * The tab a swipe should land on — `direction` is 1 for a leftward swipe
 * (forwards through the tabs) and -1 for a rightward one. Null at either end
 * of the list, which the caller turns into a rubber-band instead of a move.
 */
export function adjacentTab(pathname: string, direction: 1 | -1): string | null {
  const index = SWIPE_PATHS.indexOf(pathname);
  if (index === -1) return null;
  return SWIPE_PATHS[index + direction] ?? null;
}

/** Title for the mobile app bar on a pushed sub-screen. */
export function screenTitle(pathname: string): string {
  if (pathname.startsWith("/scans/compare")) return "Compare";
  if (pathname.startsWith("/scans/")) return "Results";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  const match = NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "";
}
