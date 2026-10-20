/** The most characters of any one text logged, so a huge message or a flood of reports can't fill the log. */
const MAX_TEXT_LENGTH = 4000;

/** One error as written to the server log. */
export interface ErrorEntry {
  /** Where it happened: on the server, or in a visitor's browser. */
  source: "server" | "browser";
  message: string;
  stack?: string;
  /** Next's id for a server error, which the error screen shows, to find its log line. */
  digest?: string;
  path?: string;
  method?: string;
  /** The route file it happened in, e.g. "/(app)/tasks". */
  route?: string;
  /** Rendering a page, a route handler, or a server action. */
  kind?: string;
}

/** Writes `entry` to standard error as one JSON line, which the host's logs (e.g. Docker's) keep. */
export function logError(entry: ErrorEntry, now = new Date()): void {
  const cut = Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : value,
    ]),
  );
  console.error(JSON.stringify({ level: "error", time: now.toISOString(), ...cut }));
}
