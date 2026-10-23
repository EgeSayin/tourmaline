import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";

export const SESSION_COOKIE = "session";

/** The session cookie's options; `https` says whether the request came over HTTPS, as a proxy may terminate it. */
export function sessionCookieOptions(days: number, https: boolean) {
  return { httpOnly: true, secure: https, sameSite: "lax", path: "/", maxAge: days * MINUTES_PER_DAY * 60 } as const;
}
