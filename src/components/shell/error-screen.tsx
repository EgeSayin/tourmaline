"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportBrowserErrorAction } from "@/server/errors/actions";

type ShownError = Error & { digest?: string };

/**
 * Reports `error` to the server log once, unless it came from the server: those have a `digest` and are logged there
 * already.
 */
export function useReportError(error: unknown) {
  useEffect(() => {
    const { message, stack, digest }: ShownError = error instanceof Error ? error : new Error(String(error));
    if (digest) return;
    reportBrowserErrorAction({ message, stack, path: location.pathname }).catch(() => {});
  }, [error]);
}

/** In place of a page that failed to show: try it again or reload, with the reference its log line has. */
export function ErrorScreen({ error, retry }: { error: ShownError; retry: () => void }) {
  useReportError(error);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">This page couldn&apos;t be shown. Try again, or reload the page.</p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground tabular-nums">Reference: {error.digest}</p>}
    </div>
  );
}
