import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "@/lib/accounts";
import type { FormErrors } from "@/lib/form-state";

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FormErrors };

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, `Use ${USERNAME_MIN}–${USERNAME_MAX} letters, digits, dots, dashes or underscores`);

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Keep it to ${PASSWORD_MAX} characters`);

export const WRONG_SIGN_IN = "Wrong username or password";
export const WRONG_PASSWORD = "Wrong password";

/** A password too long to be anyone's is simply wrong. */
const enteredPassword = (wrong: string) => z.string().min(1, "Enter your password").max(PASSWORD_MAX, wrong);

const signUpSchema = z.object({ username, password: newPassword });
const signInSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username"),
  password: enteredPassword(WRONG_SIGN_IN),
});
const changePasswordSchema = z.object({ currentPassword: enteredPassword(WRONG_PASSWORD), newPassword });

function parse<T>(schema: z.ZodType<T>, fields: Record<string, unknown>): Parsed<T> {
  const parsed = schema.safeParse(fields);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: z.flattenError(parsed.error).fieldErrors as FormErrors };
}

export const parseSignUp = (fields: Record<string, unknown>) => parse(signUpSchema, fields);
export const parseSignIn = (fields: Record<string, unknown>) => parse(signInSchema, fields);
export const parseChangePassword = (fields: Record<string, unknown>) => parse(changePasswordSchema, fields);
