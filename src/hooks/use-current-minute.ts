"use client";

import { useSyncExternalStore } from "react";

const MS_PER_MINUTE = 60_000;
const TICK_MS = 10_000;

const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
};

/** The current time, to the minute, updating as minutes pass; `null` during server rendering and hydration. */
export function useCurrentMinute(): Date | null {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MS_PER_MINUTE),
    () => null,
  );
  return minute === null ? null : new Date(minute * MS_PER_MINUTE);
}
