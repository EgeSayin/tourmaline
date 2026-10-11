import { formatter } from "@/lib/time/format";
import { toTimeInputValue } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";

export interface LocalDateTime {
  /** `YYYY-MM-DD` */
  date: string;
  minuteOfDay: number;
}

export function toLocal(date: Date, timeZone: TimeZone): LocalDateTime {
  const parts = Object.fromEntries(
    formatter({
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function toDateTimeInputValue(date: Date, timeZone: TimeZone): string {
  const { date: day, minuteOfDay } = toLocal(date, timeZone);
  return `${day}T${toTimeInputValue(minuteOfDay)}`;
}
