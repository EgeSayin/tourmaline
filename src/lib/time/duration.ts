const MS_PER_MINUTE = 60_000;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MS_PER_MINUTE;
}
