import { describe, expect } from "vitest";
import { NO_FOCUS_CAPS } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import { settings } from "@/server/db/schema";
import { loadSettings, saveFocusCaps } from "@/server/db/settings-repository";
import { dbTest as it } from "../../support/database";

describe("settings repository", () => {
  it("loads saved settings with no focus caps at first, saves caps, returns null when none exist, and rejects unsupported time zones", async ({
    tx,
  }) => {
    expect(await loadSettings(tx)).toBeNull();
    expect(await saveFocusCaps(tx, NO_FOCUS_CAPS)).toBe(false);

    await tx
      .insert(settings)
      .values({ timeZone: "Europe/Istanbul", downtimeStartMinute: 23 * 60, downtimeEndMinute: 9 * 60 });
    expect(await loadSettings(tx)).toEqual({
      timeZone: "Europe/Istanbul",
      downtime: { startMinute: 23 * 60, endMinute: 9 * 60 },
      focusCaps: NO_FOCUS_CAPS,
    });

    const caps = [480, 480, 480, 480, 360, null, 0];
    expect(await saveFocusCaps(tx, caps)).toBe(true);
    expect(await loadSettings(tx)).toMatchObject({ focusCaps: caps });

    await tx.update(settings).set({ timeZone: "Mars/Olympus" as TimeZone });
    await expect(loadSettings(tx)).rejects.toThrow('Unsupported time zone in settings: "Mars/Olympus"');
  });
});
