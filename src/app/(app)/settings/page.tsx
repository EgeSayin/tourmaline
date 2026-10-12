import { connection } from "next/server";
import { DemoReset } from "@/components/settings/demo-reset";
import { TimeZoneForm } from "@/components/settings/time-zone-form";
import { WeekSettingsForm } from "@/components/settings/week-settings-form";
import { Workspace } from "@/components/workspace/workspace";
import { loadSettings } from "@/server/db/settings-repository";
import { DEMO_MODE, readWorkspace } from "@/server/workspaces/current-workspace";
import { GUEST_IDLE_DAYS } from "@/server/workspaces/guest-limits";
import { timeZoneOptions } from "@/server/settings/time-zone-options";

export default async function Settings() {
  await connection();
  const { settings, timeZones } = await readWorkspace(async (tx, now) => ({
    settings: await loadSettings(tx),
    timeZones: timeZoneOptions(now),
  }));

  return (
    <Workspace
      page="settings"
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <TimeZoneForm key={settings.timeZone} timeZone={settings.timeZone} options={timeZones} />
          <WeekSettingsForm downtime={settings.downtime} focusCaps={settings.focusCaps} />
          {DEMO_MODE && <DemoReset idleDays={GUEST_IDLE_DAYS} />}
        </>
      }
    />
  );
}
