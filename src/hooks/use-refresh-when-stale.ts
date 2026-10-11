"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CLIENT_CACHE_SECONDS } from "@/lib/client-cache";

const CHECK_EVERY_MS = 60_000;

/**
 * Fetches the shown page again once it is `CLIENT_CACHE_SECONDS` old while the tab is in view, or when the tab
 * comes back into view after that, so edits from elsewhere and blocks coming up for review show without a reload.
 */
export function useRefreshWhenStale() {
  const router = useRouter();
  useEffect(() => {
    let fetchedAt = Date.now();
    const refreshIfStale = () => {
      if (document.hidden || Date.now() - fetchedAt < CLIENT_CACHE_SECONDS * 1000) return;
      fetchedAt = Date.now();
      router.refresh();
    };
    const timer = setInterval(refreshIfStale, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [router]);
}
