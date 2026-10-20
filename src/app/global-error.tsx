"use client";

import { ErrorScreen } from "@/components/shell/error-screen";
import "./globals.css";

/** The root layout itself failed, so this page brings its own document. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <div className="mx-auto max-w-xl px-4">
          <ErrorScreen error={error} retry={retry} />
        </div>
      </body>
    </html>
  );
}
