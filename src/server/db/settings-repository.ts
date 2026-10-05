import "server-only";
import type { SchedulerSettings } from "@/lib/settings";
import { isTimeZone } from "@/lib/time/time-zone";
import type { Database, Transaction } from "./connection";

/** The saved settings, or `null` if none exist yet. Throws if the stored time zone isn't supported. */
export async function loadSettings(executor: Database | Transaction): Promise<SchedulerSettings | null> {
  const row = await executor.query.settings.findFirst();
  if (!row) return null;
  if (!isTimeZone(row.timeZone)) throw new Error(`Unsupported time zone in settings: "${row.timeZone}"`);

  return {
    timeZone: row.timeZone,
    downtime: { startMinute: row.downtimeStartMinute, endMinute: row.downtimeEndMinute },
  };
}
