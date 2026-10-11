import type { FocusCaps, SchedulerSettings } from "@/lib/settings";
import { isTimeZone } from "@/lib/time/time-zone";
import type { Executor } from "./connection";
import { settings } from "./schema";

/** Throws if the stored time zone isn't supported. */
export async function loadSettings(executor: Executor): Promise<SchedulerSettings> {
  const row = (await executor.query.settings.findFirst())!;
  if (!isTimeZone(row.timeZone)) throw new Error(`Unsupported time zone in settings: "${row.timeZone}"`);

  return {
    timeZone: row.timeZone,
    downtime: { startMinute: row.downtimeStartMinute, endMinute: row.downtimeEndMinute },
    focusCaps: row.focusCapsMin,
  };
}

export async function saveFocusCaps(executor: Executor, focusCaps: FocusCaps): Promise<void> {
  await executor.update(settings).set({ focusCapsMin: focusCaps });
}
