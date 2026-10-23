import { hasAccounts, loadSignUpOpen } from "@/server/db/accounts-repository";
import { db } from "@/server/db/client";

/** `first` until an account exists; its creator becomes the admin. */
export type SignUpState = "first" | "open" | "closed";

export async function loadSignUpState(): Promise<SignUpState> {
  if (!(await hasAccounts(db))) return "first";
  return (await loadSignUpOpen(db)) ? "open" : "closed";
}
