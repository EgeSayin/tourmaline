import { describe, expect } from "vitest";
import { signInPauseMin } from "@/server/accounts/account-limits";
import { parseSignIn, parseSignUp } from "@/server/accounts/parse-account-forms";
import { hashPassword, verifyPassword } from "@/server/accounts/passwords";
import {
  createAccount,
  findAccount,
  recordFailedSignIn,
  recordSignIn,
  saveSignUpOpen,
} from "@/server/db/accounts-repository";
import { createSession, deleteAccountSessions, openSession } from "@/server/db/workspaces-repository";
import { addMinutes } from "@/lib/time/duration";
import { dbTest as it } from "../../support/database";

const now = new Date("2026-10-07T16:00Z");

describe("accounts", () => {
  it("makes the first account the admin, then takes more only while sign-up is open, each in its own workspace", async ({
    tx,
  }) => {
    const admin = await createAccount(tx, "admin", "hash");
    expect(admin).toMatchObject({ ok: true });
    expect(await findAccount(tx, "admin")).toMatchObject({ isAdmin: true });
    expect(await createAccount(tx, "second", "hash")).toEqual({ ok: false, reason: "closed" });

    await saveSignUpOpen(tx, true);
    const second = await createAccount(tx, "second", "hash");
    expect(await createAccount(tx, "second", "hash")).toEqual({ ok: false, reason: "taken" });
    if (!admin.ok || !second.ok) throw new Error("Accounts weren't created");
    expect(await findAccount(tx, "second")).toMatchObject({ isAdmin: false, workspaceId: second.workspaceId });
    expect(second.workspaceId).not.toBe(admin.workspaceId);
    expect(await openSession(tx, second.token, now, 0)).toEqual({
      workspaceId: second.workspaceId,
      userId: second.userId,
    });

    // Changing the password signs out every other session.
    const other = await createSession(tx, second.workspaceId, second.userId);
    await deleteAccountSessions(tx, second.userId, second.token);
    expect(await openSession(tx, other, now, 0)).toBeUndefined();
    expect(await openSession(tx, second.token, now, 0)).toBeDefined();
  });

  it("pauses sign-in after a few wrong passwords, doubling each time up to a limit, until a right one", async ({
    tx,
  }) => {
    const account = await createAccount(tx, "someone", await hashPassword("correct horse"));
    if (!account.ok) throw new Error("The account wasn't created");
    const stored = (await findAccount(tx, "someone"))!;
    expect(await verifyPassword("correct horse", stored.passwordHash)).toBe(true);
    expect(await verifyPassword("Correct horse", stored.passwordHash)).toBe(false);

    const pauses = [];
    for (let attempt = 0; attempt < 7; attempt++) {
      const until = await recordFailedSignIn(tx, account.userId, now);
      pauses.push(until && (until.getTime() - now.getTime()) / 60_000);
    }
    expect(pauses).toEqual([null, null, null, null, 1, 2, 4]);
    expect((await findAccount(tx, "someone"))!.signInPausedUntil).toEqual(addMinutes(now, 4));
    expect(signInPauseMin(40)).toBe(24 * 60);

    await recordSignIn(tx, account.userId);
    expect((await findAccount(tx, "someone"))!.signInPausedUntil).toBeNull();
    expect(await recordFailedSignIn(tx, account.userId, now)).toBeNull();
  });
});

describe("account forms", () => {
  it("takes usernames in any case as lowercase, and rejects bad usernames and short passwords", () => {
    expect(parseSignUp({ username: " Ege.S ", password: "12345678" })).toEqual({
      ok: true,
      value: { username: "ege.s", password: "12345678" },
    });
    expect(parseSignIn({ username: "EGE.S", password: "x" })).toMatchObject({ value: { username: "ege.s" } });
    expect(parseSignUp({ username: "a b", password: "1234567" })).toEqual({
      ok: false,
      errors: {
        username: ["Use 3–32 letters, digits, dots, dashes or underscores"],
        password: ["Use at least 8 characters"],
      },
    });
  });
});
