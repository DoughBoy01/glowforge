import { Dumbbell, House, ListChecks, Settings, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  /** Sidebar label. */
  label: string;
  /** Tab-bar label — has to survive a fifth of a phone's width. */
  short: string;
  icon: LucideIcon;
}

/**
 * The app's primary destinations, in tab order. Shared by the desktop
 * sidebar and the mobile tab bar so the two can never drift apart.
 *
 * Check-in is deliberately *not* here, even though it's the app's headline
 * feature. A scan is due once every `CHECK_IN_INTERVAL_DAYS` — on twenty-seven
 * days out of twenty-eight, a permanent raised camera button is an invitation
 * to do the one thing we don't want done: burn a scan early, against skin that
 * hasn't had time to change, and flatten the trend line the whole product is
 * built on. So it's a pushed screen reached from wherever it's actually
 * warranted: the day's board when it comes due, the Progress header, and the
 * home-screen prompt. Everything left in this list is somewhere you might go
 * on any given day.
 */
export const NAV_ITEMS: NavItem[] = [
  // "Home", not "Dashboard": on a phone this screen answers "what should I
  // do today?", which is a different job from a desktop dashboard's wall of
  // readouts. The route keeps its original path.
  { href: "/dashboard", label: "Home", short: "Home", icon: House },
  // Also the parent of /scans/[scanId], so viewing any past result keeps
  // "Progress" highlighted rather than leaving the nav with nothing active.
  { href: "/scans", label: "Progress", short: "Progress", icon: TrendingUp },
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
 * Tab order for the horizontal swipe gesture between tab roots — the same
 * order as the tab bar, so the gesture matches what the eye already sees.
 *
 * Nothing here opens the camera, which is a property worth keeping: landing on
 * a viewfinder by flicking sideways is the one navigation accident that costs
 * the user something.
 */
export const SWIPE_PATHS = NAV_ITEMS.map((item) => item.href);

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
  // No longer a tab, so it needs its title spelling out here — and it needs
  // one, because this is the screen where a back button matters most.
  if (pathname.startsWith("/check-in")) return "Check-in";
  if (pathname.startsWith("/scans/compare")) return "Compare";
  if (pathname.startsWith("/scans/")) return "Results";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  const match = NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "";
}
