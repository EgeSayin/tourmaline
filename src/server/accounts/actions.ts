"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { type FormState, formFields } from "@/lib/form-state";
import { formatDuration } from "@/lib/time/format";
import {
  createAccount,
  findAccount,
  recordFailedSignIn,
  recordSignIn,
  savePassword,
  saveSignUpOpen,
} from "@/server/db/accounts-repository";
import { db } from "@/server/db/client";
import { createSession, deleteAccountSessions, deleteSession } from "@/server/db/workspaces-repository";
import { currentAccount, DEMO_MODE, SIGN_IN_PATH } from "@/server/workspaces/current-workspace";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/workspaces/session-cookie";
import { ACCOUNT_COOKIE_DAYS } from "./account-limits";
import { parseChangePassword, parseSignIn, parseSignUp, WRONG_PASSWORD, WRONG_SIGN_IN } from "./parse-account-forms";
import { hashPassword, unusedHash, verifyPassword } from "./passwords";

function refuseInDemo() {
  if (DEMO_MODE) throw new Error("Accounts are disabled in the demo");
}

/** The form then opens the app. */
async function signInWith(token: string): Promise<FormState> {
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(ACCOUNT_COOKIE_DAYS, https));
  return { status: "saved" };
}

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  refuseInDemo();
  const fields = formFields(formData);
  const parsed = parseSignUp(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  const { username, password } = parsed.value;
  const account = await createAccount(db, username, await hashPassword(password));
  if (!account.ok) {
    const message = account.reason === "taken" ? "This username is taken" : "Sign-up is closed";
    return { status: "invalid", errors: { username: [message] }, fields };
  }
  return signInWith(account.token);
}

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  refuseInDemo();
  const fields = formFields(formData);
  const parsed = parseSignIn(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };
  const wrong = (message: string): FormState => ({ status: "invalid", errors: { password: [message] }, fields });

  const { username, password } = parsed.value;
  const now = new Date();
  const account = await findAccount(db, username);
  if (!account) {
    await verifyPassword(password, await unusedHash());
    return wrong(WRONG_SIGN_IN);
  }
  if (account.signInPausedUntil && account.signInPausedUntil > now)
    return wrong(pausedMessage(account.signInPausedUntil, now));
  if (!(await verifyPassword(password, account.passwordHash))) {
    const pausedUntil = await recordFailedSignIn(db, account.id, now);
    return wrong(pausedUntil ? `${WRONG_SIGN_IN}. ${pausedMessage(pausedUntil, now)}` : WRONG_SIGN_IN);
  }

  await recordSignIn(db, account.id);
  return signInWith(await createSession(db, account.workspaceId, account.id));
}

function pausedMessage(until: Date, now: Date): string {
  const minutes = Math.ceil((until.getTime() - now.getTime()) / 60_000);
  return `Too many wrong passwords: try again in ${formatDuration(minutes)}.`;
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(db, token);
  cookieStore.delete(SESSION_COOKIE);
  redirect(SIGN_IN_PATH);
}

/** Signs the account out everywhere else. */
export async function changePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = parseChangePassword(fields);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, fields };

  const account = await signedInAccount();
  const { currentPassword, newPassword } = parsed.value;
  const stored = (await findAccount(db, account.username))!;
  if (!(await verifyPassword(currentPassword, stored.passwordHash))) {
    return { status: "invalid", errors: { currentPassword: [WRONG_PASSWORD] }, fields };
  }
  await savePassword(db, account.id, await hashPassword(newPassword));
  await deleteAccountSessions(db, account.id, (await cookies()).get(SESSION_COOKIE)?.value);
  return { status: "saved" };
}

export async function setSignUpOpenAction(open: boolean): Promise<void> {
  const account = await signedInAccount();
  if (!account.isAdmin) throw new Error("Only the admin can open or close sign-up");
  await saveSignUpOpen(db, open);
  refresh();
}

async function signedInAccount() {
  return (await currentAccount()) ?? redirect(SIGN_IN_PATH);
}
