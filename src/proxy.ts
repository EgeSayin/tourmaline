import { type NextRequest, NextResponse } from "next/server";
import { ACCOUNT_COOKIE_DAYS } from "@/server/accounts/account-limits";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/workspaces/session-cookie";

/** Renews an account's session cookie on each visit, so a session in use never ends; a guest's keeps its expiry. */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && process.env.DEMO_MODE !== "true") {
    const https = request.headers.get("x-forwarded-proto") === "https";
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(ACCOUNT_COOKIE_DAYS, https));
  }
  return response;
}

export const config = {
  // Pages only: not static files, and not server actions, which may set the cookie themselves.
  matcher: [{ source: "/((?!_next/|.*\\..*).*)", missing: [{ type: "header", key: "next-action" }] }],
};
