import { format } from "date-fns";

/** YYYY-MM-DD for "today", used as the grain for streaks/completions. */
export function todayLocalDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDate(date: Date | number): string {
  return format(date, "MMM d, yyyy");
}

export function formatShortDate(date: Date | number): string {
  return format(date, "MMM d");
}
