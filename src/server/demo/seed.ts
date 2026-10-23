import { createAccount, findAccount } from "@/server/db/accounts-repository";
import { db } from "@/server/db/client";
import { inWorkspace } from "@/server/db/workspace-transaction";
import { hashPassword } from "@/server/accounts/passwords";
import { seedWorkspace } from "./seed-workspace";

/**
 * Replaces an account's data with the sample week (see `seedWorkspace`), creating the account with `password` if
 * there is none by that name.
 */
async function seed([username, password]: string[]) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");
  if (!username) throw new Error("Usage: npm run db:seed -- <username> [password for a new account]");

  let workspaceId = (await findAccount(db, username))?.workspaceId;
  if (!workspaceId) {
    if (!password) throw new Error(`No account "${username}": give a password to create it`);
    const account = await createAccount(db, username, await hashPassword(password));
    if (!account.ok) throw new Error(`Couldn't create "${username}": sign-up is ${account.reason}`);
    workspaceId = account.workspaceId;
  }
  const plan = await inWorkspace(db, workspaceId, (tx) => seedWorkspace(tx, new Date()));
  console.log(`Seeded ${plan.tasks.length} tasks and ${plan.placements.length} placements for ${username}.`);
}

seed(process.argv.slice(2))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
