import { connection } from "next/server";
import { TimeZoneForm } from "@/components/settings/time-zone-form";
import { WeekSettingsForm } from "@/components/settings/week-settings-form";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { timeZoneOptions } from "@/server/settings/time-zone-options";

export default async function Settings() {
  await connection();
  const now = new Date();
  const calendar = await inPlanTransaction(db, (tx) => loadCalendar(tx, now));

  return (
    <Workspace
      page="settings"
      calendar={calendar}
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <TimeZoneForm key={calendar.timeZone} timeZone={calendar.timeZone} options={timeZoneOptions(now)} />
          <WeekSettingsForm downtime={calendar.downtime} focusCaps={calendar.focusCaps} />
        </>
      }
    />
  );
}
