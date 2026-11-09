import { format, parseISO, isToday, isYesterday } from "date-fns";

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDayKey(dayKey: string): string {
  const date = parseISO(dayKey);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d, yyyy");
}

/**
 * A day's page head: a short name and the full date beside it.
 * "Today" + "Monday, November 9"; older days: "Thursday" + "November 5, 2026".
 */
export function formatDayParts(dayKey: string, now: Date = new Date()): { name: string; detail: string } {
  const date = parseISO(dayKey);
  const today = format(now, "yyyy-MM-dd");
  const yesterday = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), "yyyy-MM-dd");
  if (dayKey === today) return { name: "Today", detail: format(date, "EEEE, MMMM d") };
  if (dayKey === yesterday) return { name: "Yesterday", detail: format(date, "EEEE, MMMM d") };
  return { name: format(date, "EEEE"), detail: format(date, "MMMM d, yyyy") };
}

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), "h:mm a");
}
