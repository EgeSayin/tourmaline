"use client";

import { createContext, use } from "react";
import { type ClockFormat, DEFAULT_CLOCK_FORMAT } from "@/lib/time/clock";

const ClockFormatContext = createContext<ClockFormat>(DEFAULT_CLOCK_FORMAT);

export const ClockFormatProvider = ClockFormatContext;

/** The clock the account's times are shown and typed on. */
export function useClockFormat(): ClockFormat {
  return use(ClockFormatContext);
}
