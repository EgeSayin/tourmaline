"use client";

import { ErrorScreen } from "@/components/shell/error-screen";

/** Anything outside the app's pages that failed, the shell around them included. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4">
      <ErrorScreen error={error} retry={retry} />
    </div>
  );
}
