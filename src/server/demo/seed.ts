import { db } from "@/server/db/client";
import { inWorkspace, PERSONAL_WORKSPACE_ID } from "@/server/db/workspace-transaction";
import { seedWorkspace } from "./seed-workspace";

/** Replaces the personal workspace's data with the sample week (see `seedWorkspace`). */
async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

  const plan = await inWorkspace(db, PERSONAL_WORKSPACE_ID, (tx) => seedWorkspace(tx, new Date()));
  console.log(`Seeded ${plan.tasks.length} tasks and ${plan.placements.length} placements.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
