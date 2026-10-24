import { headers } from "next/headers";
import { type ClockFormat, clockFormatOfLocale } from "@/lib/time/clock";

/**
 * The clock to show the request's times on: `saved`, or until the account picks one, the clock of the browser's
 * first language, read from the request so the server renders the same times as the browser would.
 */
export async function shownClockFormat(saved: ClockFormat | null): Promise<ClockFormat> {
  if (saved) return saved;
  const language = (await headers()).get("accept-language")?.split(",")[0].split(";")[0].trim();
  return clockFormatOfLocale(language === "*" ? undefined : language);
}
