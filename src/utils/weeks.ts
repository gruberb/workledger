// ISO-8601 week helpers. All inputs and outputs are local calendar dates:
// dayKeys are local "yyyy-MM-dd" strings, so mixing in UTC (toISOString,
// Date.UTC) shifts results by a day for users east or west of UTC.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local Monday of the week containing `date`, as a dayKey. */
export function weekStartDayKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return toDayKey(monday);
}

/** ISO week key, e.g. "2026-W41", for a local dayKey. */
export function isoWeekKey(dayKey: string): string {
  const date = parseDayKey(dayKey);
  // The ISO week-year is the year of the week's Thursday.
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week1Monday = new Date(jan4.getFullYear(), 0, 4 - ((jan4.getDay() + 6) % 7));
  // Thursday of week n is 7(n-1)+3 days after week 1's Monday; rounding
  // absorbs the DST hour that can sit inside the difference.
  const days = Math.round((thursday.getTime() - week1Monday.getTime()) / 86400000);
  const weekNo = (days - 3) / 7 + 1;
  return `${thursday.getFullYear()}-W${pad(weekNo)}`;
}

/** Local midnight of the Monday that starts an ISO week key. */
export function mondayOfIsoWeek(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
}

export function previousIsoWeekKey(weekKey: string): string {
  const monday = mondayOfIsoWeek(weekKey);
  monday.setDate(monday.getDate() - 7);
  return isoWeekKey(toDayKey(monday));
}
