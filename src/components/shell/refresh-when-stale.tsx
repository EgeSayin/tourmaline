"use client";

import { useRefreshWhenStale } from "@/hooks/use-refresh-when-stale";

export function RefreshWhenStale() {
  useRefreshWhenStale();
  return null;
}
