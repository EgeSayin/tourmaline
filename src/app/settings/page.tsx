import { connection } from "next/server";
import { FocusCapForm } from "@/components/settings/focus-cap-form";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";

export default async function Settings() {
  await connection();
  const calendar = await inPlanTransaction(db, (tx) => loadCalendar(tx, new Date()));

  return (
    <Workspace
      page="settings"
      calendar={calendar}
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <FocusCapForm focusCaps={calendar.focusCaps} />
        </>
      }
    />
  );
}
