import { describe, expect } from "vitest";
import type { TimeZone } from "@/lib/time-zone";
import { settings } from "@/server/db/schema";
import { loadSettings } from "@/server/db/settings-repository";
import { dbTest as it } from "../../support/database";

describe("settings repository", { tags: ["integration", "critical"] }, () => {
  it("loads saved settings, returns null when none exist, and rejects unsupported time zones", async ({ tx }) => {
    expect(await loadSettings(tx)).toBeNull();

    await tx.insert(settings).values({ timeZone: "Europe/Istanbul", downtimeStartMinute: 23 * 60, downtimeEndMinute: 9 * 60 });
    expect(await loadSettings(tx)).toEqual({
      timeZone: "Europe/Istanbul",
      downtime: { startMinute: 23 * 60, endMinute: 9 * 60 },
    });

    await tx.update(settings).set({ timeZone: "Mars/Olympus" as TimeZone });
    await expect(loadSettings(tx)).rejects.toThrow('Unsupported time zone in settings: "Mars/Olympus"');
  });
});
