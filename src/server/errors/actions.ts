"use server";

import { z } from "zod";
import { logError } from "./error-log";

const browserError = z.object({ message: z.string(), stack: z.string().optional(), path: z.string() });

/** Logs an error a visitor's browser hit while rendering, which the server never sees otherwise. */
export async function reportBrowserErrorAction(report: z.input<typeof browserError>): Promise<void> {
  const parsed = browserError.safeParse(report);
  if (parsed.success) logError({ source: "browser", ...parsed.data });
}
