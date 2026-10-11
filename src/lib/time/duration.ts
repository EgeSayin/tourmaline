const MS_PER_MINUTE = 60_000;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MS_PER_MINUTE;
}

const DURATION = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*(?:m(?:in(?:ute)?s?)?)?)?$/;

/** Whole minutes from text like "90", "45m", "1h 30m", "1h30", "1.5h" or "1:30", or `null` for anything else. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  const clock = /^(\d+):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const match = DURATION.exec(value);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  return Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
}
