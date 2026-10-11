/** An IANA time zone name, such as "America/New_York". */
export type TimeZone = string;

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
