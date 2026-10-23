/** Wrong passwords in a row an account takes before sign-in pauses. */
export const FREE_SIGN_IN_ATTEMPTS = 5;

/** The pause after the first wrong password past the free ones; it doubles with each one after. */
export const FIRST_SIGN_IN_PAUSE_MIN = 1;

/** The longest pause, however many wrong passwords. */
export const MAX_SIGN_IN_PAUSE_MIN = 24 * 60;

/** How long an account's session cookie lasts unused: each visit renews it, so in use it never ends. */
export const ACCOUNT_COOKIE_DAYS = 400;

/** Minutes sign-in pauses after the `failures`th wrong password in a row. */
export function signInPauseMin(failures: number): number {
  if (failures < FREE_SIGN_IN_ATTEMPTS) return 0;
  return Math.min(FIRST_SIGN_IN_PAUSE_MIN * 2 ** (failures - FREE_SIGN_IN_ATTEMPTS), MAX_SIGN_IN_PAUSE_MIN);
}
