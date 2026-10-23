import { randomBytes } from "node:crypto";
import { findAccount, recordSignIn, savePassword } from "@/server/db/accounts-repository";
import { db } from "@/server/db/client";
import { deleteAccountSessions } from "@/server/db/workspaces-repository";
import { hashPassword } from "./passwords";

/** Gives an account a new random password and signs it out everywhere; the owner changes it in Settings. */
async function resetPassword([username]: string[]) {
  if (!username) throw new Error("Usage: npm run user:reset-password -- <username>");
  const account = await findAccount(db, username.toLowerCase());
  if (!account) throw new Error(`No account "${username}"`);

  const password = randomBytes(12).toString("base64url");
  await savePassword(db, account.id, await hashPassword(password));
  await recordSignIn(db, account.id); // lifts any sign-in pause
  await deleteAccountSessions(db, account.id);
  console.log(`New password for ${account.username}: ${password}`);
}

resetPassword(process.argv.slice(2))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
